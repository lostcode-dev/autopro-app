import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { toNumber, qArr, parseDateStart, parseDateEnd, roundMoney, paginate, sortFactor } from '../../utils/report-helpers'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)

  const dateFrom = parseDateStart(query.dateFrom as string)
  const dateTo = parseDateEnd(query.dateTo as string)
  const clientIds = qArr(query.clientIds)
  const orderIds = qArr(query.orderIds)
  const responsibleIds = qArr(query.responsibleIds)
  const statusFilters = qArr(query.statusFilters)
  const paymentStatusFilters = qArr(query.paymentStatusFilters)
  const paymentMethodFilters = qArr(query.paymentMethodFilters)
  const categoryIds = qArr(query.categoryIds)
  const searchTerm = String(query.searchTerm || '').trim().toLowerCase()
  const viewMode = query.viewMode === 'os' ? 'os' : 'item'
  const sortBy = String(query.sortBy || 'date')
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(query.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(query.pageSize, 20))))

  const [ordersResult, clientsResult, employeesResult, productsResult, categoriesResult, commissionRecordsResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('entry_date', { ascending: false }),
    supabase.from('clients').select('id, name').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('products').select('id, name, unit_cost_price, category_id').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('product_categories').select('id, name').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employee_financial_records').select('*').eq('organization_id', organizationId).eq('record_type', 'comissao').order('reference_date', { ascending: false })
  ])

  const orders = ordersResult.data || []
  const clients = clientsResult.data || []
  const employees = employeesResult.data || []
  const products = productsResult.data || []
  const categories = categoriesResult.data || []
  const commissionRecords = commissionRecordsResult.data || []

  const clientsMap = new Map(clients.map((c: any) => [String(c.id), c]))
  const employeesMap = new Map(employees.map((e: any) => [String(e.id), e]))
  const productsMap = new Map(products.map((p: any) => [String(p.id), p]))
  const categoriesMap = new Map(categories.map((c: any) => [String(c.id), c]))

  // Filter orders
  let filteredOrders = orders.filter((o: any) => {
    if (o?.status === 'cancelled') return false
    if (statusFilters.length > 0 && !statusFilters.includes(String(o?.status || ''))) return false
    if (paymentStatusFilters.length > 0 && !paymentStatusFilters.includes(String(o?.payment_status || ''))) return false
    if (paymentMethodFilters.length > 0 && !paymentMethodFilters.includes(String(o?.payment_method || 'no_payment'))) return false
    if (clientIds.length > 0 && !clientIds.includes(String(o?.client_id || ''))) return false
    if (orderIds.length > 0 && !orderIds.includes(String(o?.id || ''))) return false
    if (dateFrom || dateTo) {
      const entryDate = o?.entry_date ? new Date(`${o.entry_date}T00:00:00`) : null
      if (!entryDate || Number.isNaN(entryDate.getTime())) return false
      if (dateFrom && entryDate < dateFrom) return false
      if (dateTo && entryDate > dateTo) return false
    }
    return true
  })

  if (responsibleIds.length > 0) {
    filteredOrders = filteredOrders.filter((o: any) => {
      const responsibles = Array.isArray(o?.responsible_employees) ? o.responsible_employees : []
      const empId = o?.employee_responsible_id
      return responsibles.some((r: any) => responsibleIds.includes(String(r?.employee_id || ''))) || (empId && responsibleIds.includes(String(empId)))
    })
  }

  // Expand to item level
  let expandedItems: any[] = []
  for (const o of filteredOrders) {
    const items = Array.isArray(o?.items) ? o.items : []
    const clientName = clientsMap.get(String(o?.client_id || ''))?.name || 'Unknown'

    for (const item of items) {
      const product = item?.product_id ? productsMap.get(String(item.product_id)) : null
      const categoryId = product?.category_id || null
      const categoryName = categoryId ? categoriesMap.get(String(categoryId))?.name || '' : ''

      if (categoryIds.length > 0 && categoryId && !categoryIds.includes(String(categoryId))) continue

      const qty = toNumber(item?.quantity, 1)
      const unitCost = toNumber(item?.cost_amount, 0) || toNumber(product?.unit_cost_price, 0)
      const totalCost = roundMoney(unitCost * qty)
      const costSource = item?.cost_amount ? 'item' : (product?.unit_cost_price ? 'product' : 'none')
      const totalValue = toNumber(item?.total_amount, 0) || (toNumber(item?.unit_price, 0) * qty)

      let commissionCost = 0
      if (Array.isArray(item?.commissions)) {
        commissionCost = item.commissions.reduce((s: number, c: any) => s + toNumber(c?.amount, 0), 0)
      }

      let responsible = ''
      if (Array.isArray(item?.commissions) && item.commissions.length > 0) {
        responsible = item.commissions.map((c: any) => employeesMap.get(String(c?.employee_id || ''))?.name || '').filter(Boolean).join(', ')
      }
      if (!responsible) {
        const responsibles = Array.isArray(o?.responsible_employees) ? o.responsible_employees : []
        responsible = responsibles.map((r: any) => employeesMap.get(String(r?.employee_id || ''))?.name || '').filter(Boolean).join(', ')
      }

      expandedItems.push({
        id: `${o.id}_${items.indexOf(item)}`,
        orderId: o.id,
        client: clientName,
        orderNumber: o?.number || '-',
        itemDescription: item?.description || item?.name || 'No description',
        quantity: qty,
        unitCost,
        totalCost,
        commissionCost: roundMoney(commissionCost),
        totalCostWithCommission: roundMoney(totalCost + commissionCost),
        totalValue: roundMoney(totalValue),
        responsible,
        status: o?.status || '',
        date: o?.entry_date || '',
        categoryId,
        categoryName,
        costSource
      })
    }
  }

  if (searchTerm) {
    expandedItems = expandedItems.filter((i: any) =>
      i.client.toLowerCase().includes(searchTerm)
      || i.orderNumber.toLowerCase().includes(searchTerm)
      || i.itemDescription.toLowerCase().includes(searchTerm)
      || i.responsible.toLowerCase().includes(searchTerm)
    )
  }

  // Group by order if viewMode = 'os'
  let tableItems: any[] = expandedItems
  if (viewMode === 'os') {
    const osMap: Record<string, any> = {}
    for (const item of expandedItems) {
      if (!osMap[item.orderId]) {
        osMap[item.orderId] = { ...item, quantity: 0, totalCost: 0, commissionCost: 0, totalCostWithCommission: 0, totalValue: 0, itemCount: 0 }
      }
      const g = osMap[item.orderId]
      g.quantity += item.quantity
      g.totalCost += item.totalCost
      g.commissionCost += item.commissionCost
      g.totalCostWithCommission += item.totalCostWithCommission
      g.totalValue += item.totalValue
      g.itemCount += 1
    }
    tableItems = Object.values(osMap)
  }

  const factor = sortFactor(sortOrder)
  tableItems.sort((a: any, b: any) => {
    if (sortBy === 'client') return a.client.localeCompare(b.client, 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'order') return String(a.orderNumber).localeCompare(String(b.orderNumber)) * factor
    if (sortBy === 'totalValue') return (a.totalValue - b.totalValue) * factor
    if (sortBy === 'totalCost') return (a.totalCost - b.totalCost) * factor
    if (sortBy === 'commissionCost') return (a.commissionCost - b.commissionCost) * factor
    if (sortBy === 'responsible') return String(a.responsible).localeCompare(String(b.responsible), 'pt-BR') * factor
    if (sortBy === 'status') return String(a.status).localeCompare(String(b.status)) * factor
    return String(b?.date || '').localeCompare(String(a?.date || '')) * factor * (sortOrder === 'asc' ? -1 : 1)
  })

  const summary = {
    totalRevenue: roundMoney(tableItems.reduce((s, i) => s + i.totalValue, 0)),
    totalCost: roundMoney(tableItems.reduce((s, i) => s + i.totalCost, 0)),
    totalCommissionCost: roundMoney(tableItems.reduce((s, i) => s + i.commissionCost, 0)),
    itemCount: expandedItems.length,
    orderCount: filteredOrders.length
  }

  const { data: paginatedItems, pagination } = paginate(tableItems, page, pageSize)

  return {
    data: {
      salesItemsReport: {
        filters: {
          availableClients: clients.map((c: any) => ({ value: c.id, label: c.name || 'No name' })),
          availableOrders: filteredOrders.map((o: any) => ({ value: o.id, label: `OS ${o.number || '-'}` })),
          availableResponsibles: employees.map((e: any) => ({ id: e.id, name: e.name || '' })),
          availableStatuses: [...new Set(orders.map((o: any) => o?.status).filter(Boolean))].map(s => ({ value: s, label: s })),
          availableCategories: categories.map((c: any) => ({ id: c.id, name: c.name || '' }))
        },
        summary,
        table: {
          items: paginatedItems,
          pagination,
          sort: { sortBy, sortOrder },
          viewMode
        }
      }
    }
  }
})
