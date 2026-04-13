import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

/**
 * POST /api/service-orders/seed-commissions
 * Calculates and stores item-level commissions on service orders.
 * Migrated from: supabase/functions/seedServiceOrderItemCommissions
 */

function normalizeId(value: unknown) {
  const id = String(value ?? '').trim()
  return id.length > 0 ? id : null
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const cleaned = raw.replace(/\s/g, '').replace(/R\$/gi, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: number) {
  return Number.parseFloat(Number(value || 0).toFixed(2))
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item: unknown) => normalizeId(item)).filter(Boolean) as string[]
}

function uniquePreserveOrder(ids: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) { if (!seen.has(id)) { seen.add(id); out.push(id) } }
  return out
}

function hasStoredItemCommission(item: any) {
  return item?.commission_total != null && Array.isArray(item?.commissions)
}

function getResponsiblesFromOrder(order: any) {
  const ids: string[] = []
  if (Array.isArray(order?.responsible_employees) && order.responsible_employees.length > 0) {
    for (const resp of order.responsible_employees) {
      const empId = normalizeId(resp?.employee_id)
      if (empId) ids.push(empId)
    }
  } else {
    const empId = normalizeId(order?.employee_responsible_id)
    if (empId) ids.push(empId)
  }
  return Array.from(new Set(ids)).map(empId => ({ employeeId: empId }))
}

function computeAndEnrichItemCommissions({ items, responsibles, employeesMap, products, orderDiscount, orderTaxes }: any) {
  const prodCategoryMap = new Map<string, string>()
  for (const product of products || []) {
    if (product?.id && product?.category_id) prodCategoryMap.set(String(product.id), String(product.category_id))
  }

  const normalizedItems = (items || []).map((item: any, idx: number) => {
    const qty = normalizeNumber(item?.quantity) || 1
    const sale = normalizeNumber(item?.total_amount) || (normalizeNumber(item?.unit_price) * qty)
    const costUnit = normalizeNumber(item?.cost_amount)
    const cost = costUnit * qty
    const categoryId = prodCategoryMap.get(String(item?.product_id || '')) || ''
    return { idx, sale, cost, categoryId }
  })

  const allItemsSale = normalizedItems.reduce((acc: number, item: any) => acc + item.sale, 0)
  const employeeResults: any[] = []

  for (const resp of responsibles || []) {
    const empId = resp.employeeId
    if (!empId) continue
    const employee = employeesMap.get(empId)
    if (!employee?.has_commission) continue

    const commType = String(employee.commission_type || '')
    const commBase = String(employee.commission_base || '')
    const commValue = normalizeNumber(employee.commission_value)
    const categories = Array.isArray(employee.commission_categories) ? employee.commission_categories.map(String) : []
    const hasCategoryFilter = categories.length > 0

    const eligible = hasCategoryFilter ? normalizedItems.filter((item: any) => categories.includes(item.categoryId)) : normalizedItems
    const perItemValues = new Array(items.length).fill(0)

    if (eligible.length === 0) {
      employeeResults.push({ employeeId: empId, perItemValues, commType, commBase, percentual: commType === 'percentual' ? commValue : 0 })
      continue
    }

    const eligibleSale = eligible.reduce((acc: number, item: any) => acc + item.sale, 0)
    const eligibleRatio = allItemsSale > 0 ? eligibleSale / allItemsSale : 0
    const eligibleDiscount = orderDiscount * eligibleRatio
    const eligibleTax = orderTaxes * eligibleRatio

    if (commType === 'percentual') {
      for (const item of eligible) {
        const fraction = eligibleSale > 0 ? item.sale / eligibleSale : 1 / eligible.length
        let itemBase = item.sale - eligibleDiscount * fraction
        if (commBase === 'lucro') itemBase = Math.max(0, itemBase - (item.cost + eligibleTax * fraction))
        perItemValues[item.idx] = roundMoney((itemBase * commValue) / 100)
      }
    } else {
      const perItem = roundMoney(commValue / eligible.length)
      const diff = roundMoney(commValue - roundMoney(perItem * eligible.length))
      eligible.forEach((item: any, index: number) => { perItemValues[item.idx] = index === 0 ? roundMoney(perItem + diff) : perItem })
    }

    employeeResults.push({ employeeId: empId, perItemValues, commType, commBase, percentual: commType === 'percentual' ? commValue : 0 })
  }

  return (items || []).map((item: any, idx: number) => {
    const commissions: any[] = []
    let commissionTotal = 0
    for (const er of employeeResults) {
      const valor = er.perItemValues[idx]
      if (valor > 0) {
        commissions.push({ employee_id: er.employeeId, amount: valor, type: er.commType, base: er.commBase, percentage: er.percentual })
        commissionTotal += valor
      }
    }
    return { ...item, commission_total: roundMoney(commissionTotal), commissions }
  })
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const body = (await readBody(event)) || {}
  const orderIds = uniquePreserveOrder(parseStringArray(body?.orderIds))

  if (orderIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'orderIds is required (non-empty array)' })
  }

  const [ordersResult, employeesResult, productsResult] = await Promise.all([
    supabase.from('service_orders').select('*').in('id', orderIds).is('deleted_at', null),
    supabase.from('employees').select('*').is('deleted_at', null),
    supabase.from('products').select('id, name, unit_cost_price, category_id').is('deleted_at', null)
  ])

  const orders = ordersResult.data || []
  const employees = employeesResult.data || []
  const products = productsResult.data || []
  const employeesMap = new Map(employees.map((e: any) => [String(e.id), e]))

  let scannedOrders = 0, updatedOrders = 0, skippedOrdersNoResponsibles = 0
  let skippedOrdersNoItems = 0, skippedOrdersAlreadySeeded = 0, skippedOrdersCancelled = 0
  let seededItems = 0, notFoundOrders = 0
  const processedOrderIds = new Set<string>()
  const results: any[] = []

  for (const order of orders) {
    scannedOrders += 1
    processedOrderIds.add(String(order.id))

    if (String(order?.status || '') === 'cancelled') {
      skippedOrdersCancelled += 1
      results.push({ id: String(order.id), orderNumber: String(order?.number || '-'), status: 'cancelled', seededItems: 0 })
      continue
    }

    const responsibles = getResponsiblesFromOrder(order)
    if (responsibles.length === 0) {
      skippedOrdersNoResponsibles += 1
      results.push({ id: String(order.id), orderNumber: String(order?.number || '-'), status: 'no_responsibles', seededItems: 0 })
      continue
    }

    const items = Array.isArray(order?.items) ? order.items : []
    if (items.length === 0) {
      skippedOrdersNoItems += 1
      results.push({ id: String(order.id), orderNumber: String(order?.number || '-'), status: 'no_items', seededItems: 0 })
      continue
    }

    const missingIndexes = items.reduce((acc: number[], item: any, index: number) => {
      if (!hasStoredItemCommission(item)) acc.push(index)
      return acc
    }, [])

    if (missingIndexes.length === 0) {
      skippedOrdersAlreadySeeded += 1
      results.push({ id: String(order.id), orderNumber: String(order?.number || '-'), status: 'already_seeded', seededItems: 0 })
      continue
    }

    const enrichedItems = computeAndEnrichItemCommissions({
      items, responsibles, employeesMap, products,
      orderDiscount: normalizeNumber(order?.discount),
      orderTaxes: normalizeNumber(order?.total_tax_amount)
    })

    let seededItemsInOrder = 0
    const nextItems = items.map((item: any, index: number) => {
      if (hasStoredItemCommission(item)) return item
      seededItems += 1
      seededItemsInOrder += 1
      return {
        ...item,
        commission_total: roundMoney(enrichedItems[index]?.commission_total || 0),
        commissions: Array.isArray(enrichedItems[index]?.commissions) ? enrichedItems[index].commissions : []
      }
    })

    const totalCommissionValue = roundMoney(nextItems.reduce((acc: number, item: any) => acc + normalizeNumber(item?.commission_total), 0))

    await supabase.from('service_orders').update({ items: nextItems, commission_amount: totalCommissionValue }).eq('id', order.id)

    updatedOrders += 1
    results.push({ id: String(order.id), orderNumber: String(order?.number || '-'), status: 'updated', seededItems: seededItemsInOrder })
  }

  notFoundOrders = orderIds.filter(id => !processedOrderIds.has(String(id))).length

  return {
    success: true,
    data: {
      scannedOrders, updatedOrders, seededItems, requestedOrders: orderIds.length,
      notFoundOrders, skippedOrdersNoResponsibles, skippedOrdersNoItems,
      skippedOrdersAlreadySeeded, skippedOrdersCancelled, results,
      message: `Seeder completed. ${updatedOrders} order(s) updated and ${seededItems} item(s) seeded.`
    }
  }
})
