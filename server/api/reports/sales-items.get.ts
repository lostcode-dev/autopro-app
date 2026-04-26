import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { fetchAllOrganizationRows } from '../../utils/supabase-pagination'
import { toNumber, qArr, parseDateStart, parseDateEnd, roundMoney, paginate, sortFactor, normalizeReportStatus } from '../../utils/report-helpers'

interface ClientRecord {
  id: string
  name?: string | null
}

interface EmployeeRecord {
  id: string
  name?: string | null
}

interface ProductRecord {
  id: string
  name?: string | null
  unit_cost_price?: number | string | null
  category_id?: string | null
}

interface CategoryRecord {
  id: string
  name?: string | null
}

interface CommissionRecord {
  employee_id?: string | null
  amount?: number | string | null
}

interface ServiceOrderItem {
  product_id?: string | null
  description?: string | null
  name?: string | null
  quantity?: number | string | null
  cost_amount?: number | string | null
  total_amount?: number | string | null
  unit_price?: number | string | null
  commissions?: CommissionRecord[] | null
}

interface ResponsibleEmployee {
  employee_id?: string | null
}

interface ServiceOrderRecord {
  id?: string | null
  number?: string | number | null
  client_id?: string | null
  employee_responsible_id?: string | null
  responsible_employees?: ResponsibleEmployee[] | null
  status?: string | null
  payment_status?: string | null
  payment_method?: string | null
  entry_date?: string | null
  items?: ServiceOrderItem[] | null
}

interface ExpandedItemRow {
  id: string
  orderId: string
  clientId: string | null
  client: string
  orderNumber: string
  itemDescription: string
  quantity: number
  unitCost: number
  totalCost: number
  commissionCost: number
  totalCostWithCommission: number
  totalValue: number
  profit: number
  responsible: string
  status: string
  paymentStatus: string
  paymentMethod: string
  date: string
  categoryId: string | null
  categoryName: string
  costSource: 'item' | 'product' | 'none'
}

interface GroupedOrderRow {
  id: string
  orderId: string
  clientId: string | null
  client: string
  orderNumber: string
  quantity: number
  totalCost: number
  commissionCost: number
  totalCostWithCommission: number
  totalValue: number
  profit: number
  responsible: string
  status: string
  paymentStatus: string
  paymentMethod: string
  date: string
  itemCount: number
}

interface SalesItemDetailData {
  mode: 'item' | 'os'
  id: string
  orderId: string
  currentItemId: string | null
  orderNumber: string
  client: string
  responsible: string
  status: string
  paymentStatus: string
  paymentMethod: string
  date: string
  categoryName: string
  costSource: string
  itemDescription: string
  quantity: number
  unitCost: number
  totalCost: number
  commissionCost: number
  totalCostWithCommission: number
  totalValue: number
  profit: number
  itemCount: number
  items: ExpandedItemRow[]
}

const sortableFields = new Set([
  'client',
  'orderNumber',
  'itemDescription',
  'categoryName',
  'quantity',
  'totalValue',
  'totalCost',
  'commissionCost',
  'profit',
  'responsible',
  'status',
  'paymentStatus',
  'date',
  'itemCount'
])

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)

  const dateFrom = parseDateStart(query.dateFrom as string)
  const dateTo = parseDateEnd(query.dateTo as string)
  const clientIds = qArr(query.clientIds as string | string[] | undefined)
  const orderIds = qArr(query.orderIds as string | string[] | undefined)
  const responsibleIds = qArr(query.responsibleIds as string | string[] | undefined)
  const statusFilters = qArr(query.statusFilters as string | string[] | undefined)
  const paymentStatusFilters = qArr(query.paymentStatusFilters as string | string[] | undefined)
  const paymentMethodFilters = qArr(query.paymentMethodFilters as string | string[] | undefined)
  const categoryIds = qArr(query.categoryIds as string | string[] | undefined)
  const costFilters = qArr((query.costFilters ?? query.costFilter) as string | string[] | undefined)
  const costSources = qArr((query.costSources ?? query.costSource) as string | string[] | undefined)
  const searchTerm = String(query.searchTerm || '').trim().toLowerCase()
  const viewMode = query.viewMode === 'os' ? 'os' : 'item'
  const sortBy = sortableFields.has(String(query.sortBy || '')) ? String(query.sortBy) : 'date'
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(query.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(query.pageSize, 20))))
  const includeDetails = query.includeDetails === 'true'
  const selectedItemId = String(query.selectedItemId || '').trim()
  const selectedOrderId = String(query.selectedOrderId || '').trim()

  const [orders, clients, employees, products, categories] = await Promise.all([
    fetchAllOrganizationRows<ServiceOrderRecord>(supabase, {
      table: 'service_orders',
      organizationId,
      nullColumns: ['deleted_at'],
      order: { column: 'entry_date' }
    }),
    fetchAllOrganizationRows<ClientRecord>(supabase, {
      table: 'clients',
      organizationId,
      columns: 'id, name',
      nullColumns: ['deleted_at']
    }),
    fetchAllOrganizationRows<EmployeeRecord>(supabase, {
      table: 'employees',
      organizationId,
      columns: 'id, name',
      nullColumns: ['deleted_at']
    }),
    fetchAllOrganizationRows<ProductRecord>(supabase, {
      table: 'products',
      organizationId,
      columns: 'id, name, unit_cost_price, category_id',
      nullColumns: ['deleted_at']
    }),
    fetchAllOrganizationRows<CategoryRecord>(supabase, {
      table: 'product_categories',
      organizationId,
      columns: 'id, name',
      nullColumns: ['deleted_at']
    })
  ])

  const clientsMap = new Map<string, ClientRecord>(clients.map(client => [String(client.id), client]))
  const employeesMap = new Map<string, EmployeeRecord>(employees.map(employee => [String(employee.id), employee]))
  const productsMap = new Map<string, ProductRecord>(products.map(product => [String(product.id), product]))
  const categoriesMap = new Map<string, CategoryRecord>(categories.map(category => [String(category.id), category]))

  let filteredOrders = orders.filter((order) => {
    if (order?.status === 'cancelled') return false
    if (statusFilters.length > 0 && !statusFilters.includes(String(order?.status || ''))) return false
    if (paymentStatusFilters.length > 0 && !paymentStatusFilters.includes(normalizeReportStatus(order?.payment_status))) return false
    if (paymentMethodFilters.length > 0 && !paymentMethodFilters.includes(String(order?.payment_method || 'no_payment'))) return false
    if (clientIds.length > 0 && !clientIds.includes(String(order?.client_id || ''))) return false
    if (orderIds.length > 0 && !orderIds.includes(String(order?.id || ''))) return false

    const entryDate = order?.entry_date ? new Date(`${order.entry_date}T00:00:00`) : null
    if ((dateFrom || dateTo) && (!entryDate || Number.isNaN(entryDate.getTime()))) return false
    if (dateFrom && entryDate && entryDate < dateFrom) return false
    if (dateTo && entryDate && entryDate > dateTo) return false

    return true
  })

  if (responsibleIds.length > 0) {
    filteredOrders = filteredOrders.filter((order) => {
      const responsibles = Array.isArray(order?.responsible_employees) ? order.responsible_employees : []
      const orderResponsibleId = order?.employee_responsible_id ? String(order.employee_responsible_id) : null
      return responsibles.some(responsible => responsibleIds.includes(String(responsible?.employee_id || '')))
        || (orderResponsibleId ? responsibleIds.includes(orderResponsibleId) : false)
    })
  }

  let expandedItems: ExpandedItemRow[] = []

  for (const order of filteredOrders) {
    const orderId = String(order?.id || '')
    if (!orderId) continue

    const items = Array.isArray(order?.items) ? order.items : []
    const clientId = order?.client_id ? String(order.client_id) : null
    const client = clientId ? clientsMap.get(clientId)?.name || 'Cliente sem nome' : 'Cliente sem nome'
    const orderNumber = String(order?.number || '-')
    const status = String(order?.status || '')
    const paymentStatus = normalizeReportStatus(order?.payment_status)
    const paymentMethod = String(order?.payment_method || 'no_payment')
    const date = String(order?.entry_date || '')

    for (const [index, item] of items.entries()) {
      const product = item?.product_id ? productsMap.get(String(item.product_id)) : null
      const categoryId = product?.category_id ? String(product.category_id) : null
      const categoryName = categoryId ? categoriesMap.get(categoryId)?.name || 'Sem categoria' : 'Sem categoria'
      const costSource: 'item' | 'product' | 'none' = item?.cost_amount != null && String(item.cost_amount) !== ''
        ? 'item'
        : product?.unit_cost_price != null && String(product.unit_cost_price) !== ''
          ? 'product'
          : 'none'

      if (categoryIds.length > 0 && categoryId && !categoryIds.includes(categoryId)) continue
      if (categoryIds.length > 0 && !categoryId) continue

      const quantity = toNumber(item?.quantity, 1)
      const unitCost = item?.cost_amount != null && String(item.cost_amount) !== ''
        ? toNumber(item.cost_amount, 0)
        : toNumber(product?.unit_cost_price, 0)
      const totalCost = roundMoney(unitCost * quantity)
      const commissionCost = roundMoney((Array.isArray(item?.commissions) ? item.commissions : []).reduce((sum, commission) => sum + toNumber(commission?.amount, 0), 0))
      const totalValue = roundMoney(toNumber(item?.total_amount, 0) || (toNumber(item?.unit_price, 0) * quantity))
      const totalCostWithCommission = roundMoney(totalCost + commissionCost)
      const profit = roundMoney(totalValue - totalCostWithCommission)

      let responsible = ''
      if (Array.isArray(item?.commissions) && item.commissions.length > 0) {
        responsible = item.commissions
          .map(commission => employeesMap.get(String(commission?.employee_id || ''))?.name || '')
          .filter(Boolean)
          .join(', ')
      }
      if (!responsible) {
        const responsibles = Array.isArray(order?.responsible_employees) ? order.responsible_employees : []
        responsible = responsibles
          .map(itemResponsible => employeesMap.get(String(itemResponsible?.employee_id || ''))?.name || '')
          .filter(Boolean)
          .join(', ')
      }
      if (!responsible && order?.employee_responsible_id) {
        responsible = employeesMap.get(String(order.employee_responsible_id))?.name || ''
      }

      expandedItems.push({
        id: `${orderId}_${index}`,
        orderId,
        clientId,
        client,
        orderNumber,
        itemDescription: String(item?.description || item?.name || 'Item sem descrição'),
        quantity,
        unitCost,
        totalCost,
        commissionCost,
        totalCostWithCommission,
        totalValue,
        profit,
        responsible,
        status,
        paymentStatus,
        paymentMethod,
        date,
        categoryId,
        categoryName,
        costSource
      })
    }
  }

  if (costFilters.length > 0) {
    expandedItems = expandedItems.filter((item) => {
      if (costFilters.includes('withCost') && item.totalCost <= 0) return false
      if (costFilters.includes('zeroCost') && item.totalCost > 0) return false
      return true
    })
  }

  if (costSources.length > 0) {
    expandedItems = expandedItems.filter(item => costSources.includes(item.costSource))
  }

  if (searchTerm) {
    expandedItems = expandedItems.filter(item =>
      item.client.toLowerCase().includes(searchTerm)
      || item.orderNumber.toLowerCase().includes(searchTerm)
      || item.itemDescription.toLowerCase().includes(searchTerm)
      || item.responsible.toLowerCase().includes(searchTerm)
      || item.categoryName.toLowerCase().includes(searchTerm)
    )
  }

  const groupedOrdersMap = new Map<string, GroupedOrderRow>()
  for (const item of expandedItems) {
    const existing = groupedOrdersMap.get(item.orderId)
    if (!existing) {
      groupedOrdersMap.set(item.orderId, {
        id: item.orderId,
        orderId: item.orderId,
        clientId: item.clientId,
        client: item.client,
        orderNumber: item.orderNumber,
        quantity: item.quantity,
        totalCost: item.totalCost,
        commissionCost: item.commissionCost,
        totalCostWithCommission: item.totalCostWithCommission,
        totalValue: item.totalValue,
        profit: item.profit,
        responsible: item.responsible,
        status: item.status,
        paymentStatus: item.paymentStatus,
        paymentMethod: item.paymentMethod,
        date: item.date,
        itemCount: 1
      })
      continue
    }

    existing.quantity += item.quantity
    existing.totalCost = roundMoney(existing.totalCost + item.totalCost)
    existing.commissionCost = roundMoney(existing.commissionCost + item.commissionCost)
    existing.totalCostWithCommission = roundMoney(existing.totalCostWithCommission + item.totalCostWithCommission)
    existing.totalValue = roundMoney(existing.totalValue + item.totalValue)
    existing.profit = roundMoney(existing.profit + item.profit)
    existing.itemCount += 1

    const currentResponsibles = new Set(existing.responsible.split(',').map(name => name.trim()).filter(Boolean))
    for (const responsible of item.responsible.split(',')) {
      const trimmed = responsible.trim()
      if (trimmed) currentResponsibles.add(trimmed)
    }
    existing.responsible = Array.from(currentResponsibles).join(', ')
  }

  const tableItems: Array<ExpandedItemRow | GroupedOrderRow> = viewMode === 'os'
    ? Array.from(groupedOrdersMap.values())
    : expandedItems

  const factor = sortFactor(sortOrder)
  tableItems.sort((itemA, itemB) => {
    if (sortBy === 'client') return String(itemA.client).localeCompare(String(itemB.client), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'orderNumber') return String(itemA.orderNumber).localeCompare(String(itemB.orderNumber), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'itemDescription') return String('itemDescription' in itemA ? itemA.itemDescription : '').localeCompare(String('itemDescription' in itemB ? itemB.itemDescription : ''), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'categoryName') return String('categoryName' in itemA ? itemA.categoryName : '').localeCompare(String('categoryName' in itemB ? itemB.categoryName : ''), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'quantity') return (toNumber(itemA.quantity, 0) - toNumber(itemB.quantity, 0)) * factor
    if (sortBy === 'totalValue') return (toNumber(itemA.totalValue, 0) - toNumber(itemB.totalValue, 0)) * factor
    if (sortBy === 'totalCost') return (toNumber(itemA.totalCost, 0) - toNumber(itemB.totalCost, 0)) * factor
    if (sortBy === 'commissionCost') return (toNumber(itemA.commissionCost, 0) - toNumber(itemB.commissionCost, 0)) * factor
    if (sortBy === 'profit') return (toNumber(itemA.profit, 0) - toNumber(itemB.profit, 0)) * factor
    if (sortBy === 'responsible') return String(itemA.responsible).localeCompare(String(itemB.responsible), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'status') return String(itemA.status).localeCompare(String(itemB.status), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'paymentStatus') return String(itemA.paymentStatus).localeCompare(String(itemB.paymentStatus), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'itemCount' && 'itemCount' in itemA && 'itemCount' in itemB) return (itemA.itemCount - itemB.itemCount) * factor
    return String(itemA.date || '').localeCompare(String(itemB.date || ''), 'pt-BR', { sensitivity: 'base' }) * factor
  })

  const summary = {
    totalRevenue: roundMoney(expandedItems.reduce((sum, item) => sum + item.totalValue, 0)),
    totalCost: roundMoney(expandedItems.reduce((sum, item) => sum + item.totalCost, 0)),
    totalCommissionCost: roundMoney(expandedItems.reduce((sum, item) => sum + item.commissionCost, 0)),
    totalProfit: roundMoney(expandedItems.reduce((sum, item) => sum + item.profit, 0)),
    totalQuantity: roundMoney(expandedItems.reduce((sum, item) => sum + item.quantity, 0)),
    itemCount: expandedItems.length,
    orderCount: groupedOrdersMap.size
  }

  const { data: paginatedItems, pagination } = paginate(tableItems, page, pageSize)

  let details: SalesItemDetailData | null = null
  if (includeDetails && selectedItemId) {
    const selectedItem = expandedItems.find(item => item.id === selectedItemId)
    if (selectedItem) {
      const orderItems = expandedItems.filter(item => item.orderId === selectedItem.orderId)
      details = {
        mode: 'item',
        id: selectedItem.id,
        orderId: selectedItem.orderId,
        currentItemId: selectedItem.id,
        orderNumber: selectedItem.orderNumber,
        client: selectedItem.client,
        responsible: selectedItem.responsible,
        status: selectedItem.status,
        paymentStatus: selectedItem.paymentStatus,
        paymentMethod: selectedItem.paymentMethod,
        date: selectedItem.date,
        categoryName: selectedItem.categoryName,
        costSource: selectedItem.costSource,
        itemDescription: selectedItem.itemDescription,
        quantity: selectedItem.quantity,
        unitCost: selectedItem.unitCost,
        totalCost: selectedItem.totalCost,
        commissionCost: selectedItem.commissionCost,
        totalCostWithCommission: selectedItem.totalCostWithCommission,
        totalValue: selectedItem.totalValue,
        profit: selectedItem.profit,
        itemCount: orderItems.length,
        items: orderItems
      }
    }
  }
  if (includeDetails && selectedOrderId) {
    const orderRow = groupedOrdersMap.get(selectedOrderId)
    const orderItems = expandedItems.filter(item => item.orderId === selectedOrderId)
    if (orderRow) {
      details = {
        mode: 'os',
        id: orderRow.id,
        orderId: orderRow.orderId,
        currentItemId: null,
        orderNumber: orderRow.orderNumber,
        client: orderRow.client,
        responsible: orderRow.responsible,
        status: orderRow.status,
        paymentStatus: orderRow.paymentStatus,
        paymentMethod: orderRow.paymentMethod,
        date: orderRow.date,
        categoryName: orderItems.map(item => item.categoryName).filter(Boolean).join(', '),
        costSource: orderItems.map(item => item.costSource).filter(Boolean).join(', '),
        itemDescription: `${orderRow.itemCount} item(ns)`,
        quantity: orderRow.quantity,
        unitCost: orderRow.quantity > 0 ? roundMoney(orderRow.totalCost / orderRow.quantity) : 0,
        totalCost: orderRow.totalCost,
        commissionCost: orderRow.commissionCost,
        totalCostWithCommission: orderRow.totalCostWithCommission,
        totalValue: orderRow.totalValue,
        profit: orderRow.profit,
        itemCount: orderRow.itemCount,
        items: orderItems
      }
    }
  }

  return {
    data: {
      salesItemsReport: {
        filters: {
          availableClients: clients
            .map(client => ({ value: client.id, label: client.name || 'Cliente sem nome' }))
            .sort((clientA, clientB) => clientA.label.localeCompare(clientB.label, 'pt-BR', { sensitivity: 'base' })),
          availableOrders: filteredOrders
            .map(order => ({ value: String(order.id || ''), label: `OS ${order.number || '-'}` }))
            .sort((orderA, orderB) => orderA.label.localeCompare(orderB.label, 'pt-BR', { sensitivity: 'base' })),
          availableResponsibles: employees
            .map(employee => ({ value: employee.id, label: employee.name || 'Sem nome' }))
            .sort((employeeA, employeeB) => employeeA.label.localeCompare(employeeB.label, 'pt-BR', { sensitivity: 'base' })),
          availableStatuses: Array.from(new Set(orders.map(order => String(order?.status || '')).filter(Boolean)))
            .sort((statusA, statusB) => statusA.localeCompare(statusB, 'pt-BR', { sensitivity: 'base' }))
            .map(status => ({ value: status, label: status })),
          availableCategories: categories
            .map(category => ({ value: category.id, label: category.name || 'Sem categoria' }))
            .sort((categoryA, categoryB) => categoryA.label.localeCompare(categoryB.label, 'pt-BR', { sensitivity: 'base' }))
        },
        summary,
        details,
        charts: {
          topItemsByQuantity: [...expandedItems]
            .sort((itemA, itemB) => itemB.quantity - itemA.quantity)
            .slice(0, 10)
            .map(item => ({ name: item.itemDescription, quantity: item.quantity, revenue: item.totalValue }))
        },
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
