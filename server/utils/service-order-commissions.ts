import { createError } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'

type GenerateServiceOrderCommissionsParams = {
  supabase: SupabaseClient
  organizationId: string
  orderId: string
  userEmail?: string | null
}

type EmployeeWithCommission = {
  id: string
  has_commission?: boolean | null
  commission_type?: string | null
  commission_amount?: number | string | null
  commission_base?: string | null
  commission_categories?: string[] | null
}

function asNumber(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function getItemQuantity(item: Record<string, unknown>) {
  return asNumber(item.quantity || 1) || 1
}

function getItemTotal(item: Record<string, unknown>) {
  const quantity = getItemQuantity(item)
  const rawTotal = item.total_price ?? item.total_amount
  return rawTotal != null
    ? asNumber(rawTotal)
    : asNumber(item.unit_price) * quantity
}

function getItemCost(item: Record<string, unknown>) {
  return asNumber(item.cost_price ?? item.cost_amount) * getItemQuantity(item)
}

function isMissingCommissionSnapshotColumn(error: { message?: string } | null | undefined) {
  const message = String(error?.message || '')
  if (!message) return false

  return [
    'commission_type',
    'commission_percentage',
    'commission_base',
    'item_name',
    'item_amount',
    'item_cost'
  ].some(column => message.includes(`'${column}'`) || message.includes(`"${column}"`))
}

export async function generateServiceOrderCommissions({
  supabase,
  organizationId,
  orderId,
  userEmail
}: GenerateServiceOrderCommissionsParams) {
  const warnings: string[] = []

  const { data: order } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Service order not found' })
  }

  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  const employeeMap = new Map(
    ((employees || []) as EmployeeWithCommission[]).map(employee => [employee.id, employee])
  )

  const { data: existingCommissions } = await supabase
    .from('employee_financial_records')
    .select('id, financial_transaction_id')
    .eq('service_order_id', orderId)
    .eq('record_type', 'commission')
    .eq('organization_id', organizationId)

  for (const commission of existingCommissions || []) {
    if (commission.financial_transaction_id) {
      const { data: statements } = await supabase
        .from('bank_account_statements')
        .select('id')
        .eq('financial_transaction_id', commission.financial_transaction_id)

      for (const statement of statements || []) {
        await supabase.from('bank_account_statements').delete().eq('id', statement.id)
      }

      await supabase.from('financial_transactions').delete().eq('id', commission.financial_transaction_id)
    }

    await supabase.from('employee_financial_records').delete().eq('id', commission.id)
  }

  const responsibleEmployees = Array.isArray(order.responsible_employees) ? order.responsible_employees : []
  if (responsibleEmployees.length === 0) {
    await supabase
      .from('service_orders')
      .update({ commission_amount: 0, updated_by: userEmail || null })
      .eq('id', orderId)

    return {
      orderId,
      commissions: [],
      totalCommission: 0,
      warnings: ['No responsible employees on this service order']
    }
  }

  const items = Array.isArray(order.items) ? order.items : []
  if (items.length === 0) {
    await supabase
      .from('service_orders')
      .update({ commission_amount: 0, updated_by: userEmail || null })
      .eq('id', orderId)

    return {
      orderId,
      commissions: [],
      totalCommission: 0,
      warnings: ['Service order has no items to calculate commission']
    }
  }

  const subtotal = items.reduce((sum, item) => sum + getItemTotal(item), 0)
  const discountAmount = asNumber(order.discount)
  const taxesAmount = asNumber(order.total_taxes_amount)
  const createdCommissions: unknown[] = []
  let totalCommission = 0

  for (const responsible of responsibleEmployees) {
    const employeeId = responsible.employee_id
    const employee = employeeMap.get(employeeId)

    if (!employee || !employee.has_commission) continue

    const commissionType = employee.commission_type
    const commissionValue = asNumber(employee.commission_amount)
    const commissionBase = employee.commission_base
    const commissionCategories = Array.isArray(employee.commission_categories)
      ? employee.commission_categories
      : []

    const eligibleItems = items.filter((item) => {
      if (commissionCategories.length === 0) return true

      const itemCategoryId = item.category_id
      return !itemCategoryId || commissionCategories.includes(itemCategoryId)
    })

    if (eligibleItems.length === 0) continue

    const eligibleItemAmount = eligibleItems.reduce((sum, item) => sum + getItemTotal(item), 0)
    const eligibleItemCost = eligibleItems.reduce((sum, item) => sum + getItemCost(item), 0)
    let employeeCommissionAmount = 0

    if (commissionType === 'percentage') {
      const eligibleRatio = subtotal > 0 ? eligibleItemAmount / subtotal : 0
      const eligibleDiscount = discountAmount * eligibleRatio
      const eligibleTaxes = taxesAmount * eligibleRatio

      for (const item of eligibleItems) {
        const itemTotal = getItemTotal(item)
        const fraction = eligibleItemAmount > 0 ? itemTotal / eligibleItemAmount : 1 / eligibleItems.length
        const itemDiscount = eligibleDiscount * fraction
        const itemTaxes = eligibleTaxes * fraction
        let baseAmount = itemTotal - itemDiscount

        if (commissionBase === 'profit') {
          baseAmount = Math.max(0, baseAmount - getItemCost(item) - itemTaxes)
        }

        employeeCommissionAmount += roundCurrency((baseAmount * commissionValue) / 100)
      }
    } else {
      employeeCommissionAmount = commissionValue
    }

    if (employeeCommissionAmount <= 0) continue

    const roundedAmount = roundCurrency(employeeCommissionAmount)
    const roundedEligibleItemAmount = roundCurrency(eligibleItemAmount)
    const roundedEligibleItemCost = roundCurrency(eligibleItemCost)
    const basePayload = {
      organization_id: organizationId,
      employee_id: employeeId,
      service_order_id: orderId,
      record_type: 'commission',
      amount: roundedAmount,
      status: 'pending',
      description: `Commission - OS #${order.number}`,
      reference_date: order.entry_date || new Date().toISOString().split('T')[0],
      created_by: userEmail || null,
      updated_by: userEmail || null
    }

    const snapshotPayload = {
      commission_type: commissionType,
      commission_percentage: commissionType === 'percentage' ? commissionValue : null,
      commission_base: commissionBase,
      item_name: `OS #${order.number}`,
      item_amount: roundedEligibleItemAmount,
      item_cost: roundedEligibleItemCost
    }

    let { data: commissionRecord, error: commissionError } = await supabase
      .from('employee_financial_records')
      .insert({
        ...basePayload,
        ...snapshotPayload
      })
      .select()
      .single()

    if (commissionError && isMissingCommissionSnapshotColumn(commissionError)) {
      ({ data: commissionRecord, error: commissionError } = await supabase
        .from('employee_financial_records')
        .insert(basePayload)
        .select()
        .single())
    }

    if (commissionError) {
      throw createError({ statusCode: 500, statusMessage: commissionError.message })
    }

    if (commissionRecord) {
      createdCommissions.push(commissionRecord)
      totalCommission += roundedAmount
    }
  }

  const roundedTotalCommission = roundCurrency(totalCommission)

  await supabase
    .from('service_orders')
    .update({
      commission_amount: roundedTotalCommission,
      updated_by: userEmail || null
    })
    .eq('id', orderId)

  return {
    orderId,
    commissions: createdCommissions,
    totalCommission: roundedTotalCommission,
    warnings
  }
}
