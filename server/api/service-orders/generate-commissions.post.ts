import { readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/service-orders/generate-commissions
 * Generates/updates commission records from service order items.
 * Migrated from: supabase/functions/generateServiceOrderCommissions
 */
export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = await readBody(event)
  const orderId = body?.orderId

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId é obrigatório' })
  }

  const warnings: string[] = []

  // Fetch order
  const { data: order } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Ordem de serviço não encontrada' })
  }

  // Fetch employees
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  const employeeMap = new Map((employees || []).map((e: any) => [e.id, e]))

  // Delete existing commissions for this order
  const { data: existingCommissions } = await supabase
    .from('employee_financial_records')
    .select('id, financial_transaction_id')
    .eq('service_order_id', orderId)
    .eq('record_type', 'commission')
    .eq('organization_id', organizationId)

  for (const comm of existingCommissions || []) {
    if (comm.financial_transaction_id) {
      // Delete linked bank statements
      const { data: stmts } = await supabase
        .from('bank_account_statements')
        .select('id')
        .eq('financial_transaction_id', comm.financial_transaction_id)

      for (const stmt of stmts || []) {
        await supabase.from('bank_account_statements').delete().eq('id', stmt.id)
      }
      await supabase.from('financial_transactions').delete().eq('id', comm.financial_transaction_id)
    }
    await supabase.from('employee_financial_records').delete().eq('id', comm.id)
  }

  // Get responsible employees from the order
  const responsibleEmployees = order.responsible_employees || []
  if (!Array.isArray(responsibleEmployees) || responsibleEmployees.length === 0) {
    // No responsible employees — update order commission to 0
    await supabase
      .from('service_orders')
      .update({ commission_amount: 0, updated_by: authUser.email })
      .eq('id', orderId)

    return {
      data: {
        orderId,
        commissions: [],
        totalCommission: 0,
        warnings: ['Nenhum funcionário responsável na OS']
      }
    }
  }

  const items = order.items || []
  if (!Array.isArray(items) || items.length === 0) {
    await supabase
      .from('service_orders')
      .update({ commission_amount: 0, updated_by: authUser.email })
      .eq('id', orderId)

    return {
      data: {
        orderId,
        commissions: [],
        totalCommission: 0,
        warnings: ['OS sem itens para calcular comissão']
      }
    }
  }

  // Fetch product categories for commission filtering
  const { data: categories } = await supabase
    .from('product_categories')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  const categoryMap = new Map((categories || []).map((c: any) => [c.id, c]))

  const createdCommissions: unknown[] = []
  let totalCommission = 0

  // For each responsible employee, calculate commissions per item
  for (const responsible of responsibleEmployees) {
    const employeeId = responsible.employee_id
    const employee = employeeMap.get(employeeId)

    if (!employee || !employee.has_commission) continue

    const commissionType = employee.commission_type // 'percentage' or 'fixed_amount'
    const commissionValue = Number(employee.commission_amount || 0)
    const commissionBase = employee.commission_base // 'revenue' or 'profit'
    const commissionCategories = employee.commission_categories || []

    for (const item of items) {
      // Check if employee has category filter
      if (Array.isArray(commissionCategories) && commissionCategories.length > 0) {
        const itemCategoryId = item.category_id
        if (itemCategoryId && !commissionCategories.includes(itemCategoryId)) {
          continue // Skip items not matching employee's commission categories
        }
      }

      const itemTotal = Number(item.total_price || item.sale_price || 0) * Number(item.quantity || 1)
      const itemCost = Number(item.cost_price || 0) * Number(item.quantity || 1)
      const itemProfit = itemTotal - itemCost

      let commissionAmount = 0
      if (commissionType === 'percentage') {
        const base = commissionBase === 'profit' ? itemProfit : itemTotal
        commissionAmount = (base * commissionValue) / 100
      } else {
        // Fixed amount per item
        commissionAmount = commissionValue * Number(item.quantity || 1)
      }

      // Divide commission among all responsible employees
      commissionAmount = commissionAmount / responsibleEmployees.length

      if (commissionAmount <= 0) continue

      const { data: commRecord } = await supabase
        .from('employee_financial_records')
        .insert({
          organization_id: organizationId,
          employee_id: employeeId,
          service_order_id: orderId,
          record_type: 'commission',
          amount: commissionAmount,
          status: 'pending',
          description: `Comissão - OS #${order.number} - ${item.name || item.description || 'Item'}`,
          date: order.entry_date || new Date().toISOString().split('T')[0],
          commission_type: commissionType,
          commission_percentage: commissionType === 'percentage' ? commissionValue : null,
          commission_base: commissionBase,
          item_name: item.name || item.description || null,
          item_amount: itemTotal,
          item_cost: itemCost,
          created_by: authUser.email
        })
        .select()
        .single()

      if (commRecord) {
        createdCommissions.push(commRecord)
        totalCommission += commissionAmount
      }
    }
  }

  // Update order commission amount
  await supabase
    .from('service_orders')
    .update({
      commission_amount: totalCommission,
      updated_by: authUser.email
    })
    .eq('id', orderId)

  return {
    data: {
      orderId,
      commissions: createdCommissions,
      totalCommission,
      warnings
    }
  }
})
