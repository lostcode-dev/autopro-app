import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { fetchAllOrganizationRows } from '../../utils/supabase-pagination'
import { parseDateStart, parseDateEnd, toNumber, qArr, paginate, sortFactor, normalizeReportStatus } from '../../utils/report-helpers'

interface ServiceOrderRecord {
  id?: string | null
  number?: string | number | null
  client_id?: string | null
  status?: string | null
  payment_status?: string | null
  payment_method?: string | null
  total_amount?: number | string | null
  expected_payment_date?: string | null
  entry_date?: string | null
  is_installment?: boolean | null
}

interface InstallmentRecord {
  id?: string | null
  service_order_id?: string | null
  status?: string | null
  amount?: number | string | null
  due_date?: string | null
  payment_method?: string | null
  installment_number?: number | null
}

interface ClientRecord {
  id: string
  name?: string | null
  phone?: string | null
  email?: string | null
}

interface PendingItem {
  type: 'order' | 'installment'
  id: string | null | undefined
  orderId: string | null | undefined
  number: string
  amount: number
  dueDate: string | null
  paymentMethod: string | null
  orderStatus: string | null
  daysOverdue: number
  status: 'overdue' | 'current'
}

interface DebtorAggregate {
  clientId: string
  totalOwed: number
  pendingItems: PendingItem[]
  daysOverdue: number
  earliestDue: string | null
}

interface DebtorClientRow extends DebtorAggregate {
  client?: ClientRecord | null
  clientName: string
  phone: string | null
  email: string | null
  status: 'overdue' | 'current'
}

interface DebtorOrderRow {
  rowId: string
  orderId: string | null
  orderNumber: string | null
  clientId: string
  clientName: string
  phone: string | null
  email: string | null
  totalOwed: number
  pendingItems: PendingItem[]
  daysOverdue: number
  earliestDue: string | null
  status: 'overdue' | 'current'
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)

  const viewMode = query.viewMode === 'orders' ? 'orders' : 'clients'
  const sortBy = ['client_name', 'total_owed', 'days_overdue', 'earliest_due', 'status', 'order_number'].includes(query.sortBy as string) ? String(query.sortBy) : 'earliest_due'
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(query.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(query.pageSize, 10))))
  const searchTerm = String(query.searchTerm || '').trim().toLowerCase()
  const statusFilters = qArr(query.statusFilters as string | string[] | undefined)
  const paymentMethodFilters = qArr(query.paymentMethodFilters as string | string[] | undefined)
  const clientIds = qArr(query.clientIds as string | string[] | undefined)
  const orderStatusFilters = qArr(query.orderStatusFilters as string | string[] | undefined)
  const dateFrom = parseDateStart(query.dateFrom as string)
  const dateTo = parseDateEnd(query.dateTo as string)

  const [orders, installments, clients] = await Promise.all([
    fetchAllOrganizationRows<ServiceOrderRecord>(supabase, {
      table: 'service_orders',
      organizationId,
      nullColumns: ['deleted_at'],
      order: { column: 'created_at' }
    }),
    fetchAllOrganizationRows<InstallmentRecord>(supabase, {
      table: 'service_order_installments',
      organizationId
    }),
    fetchAllOrganizationRows<ClientRecord>(supabase, {
      table: 'clients',
      organizationId,
      nullColumns: ['deleted_at']
    })
  ])
  const clientsMap = new Map<string, ClientRecord>(clients.map(c => [String(c.id), c]))
  const ordersMap = new Map<string, ServiceOrderRecord>(orders.map(order => [String(order.id || ''), order]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const debtorsMap: Record<string, DebtorAggregate> = {}

  // From service orders (non-installment, unpaid)
  for (const order of orders) {
    if (order?.status === 'cancelled' || order?.status === 'estimate') continue
    if (normalizeReportStatus(order?.payment_status) !== 'pending') continue
    if (order?.is_installment) continue
    if (orderStatusFilters.length > 0 && !orderStatusFilters.includes(String(order?.status || ''))) continue

    const clientId = String(order?.client_id || '')
    if (!clientId) continue

    const dueDate = order?.expected_payment_date || order?.entry_date || null
    const dueDateObj = dueDate ? new Date(`${dueDate}T00:00:00`) : null
    const daysOverdue = dueDateObj && !Number.isNaN(dueDateObj.getTime()) ? Math.max(0, Math.floor((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))) : 0

    if (!debtorsMap[clientId]) debtorsMap[clientId] = { clientId, totalOwed: 0, pendingItems: [], daysOverdue: 0, earliestDue: null }
    const debtor = debtorsMap[clientId]
    const amount = toNumber(order?.total_amount, 0)
    debtor.totalOwed += amount
    if (daysOverdue > debtor.daysOverdue) debtor.daysOverdue = daysOverdue
    if (dueDate && (!debtor.earliestDue || dueDate < debtor.earliestDue)) debtor.earliestDue = dueDate

    debtor.pendingItems.push({
      type: 'order', id: order.id, orderId: order.id, number: String(order?.number || '-'), amount,
      dueDate, paymentMethod: order?.payment_method || null,
      orderStatus: order?.status || null, daysOverdue,
      status: daysOverdue > 0 ? 'overdue' : 'current'
    })
  }

  // From installments
  for (const installment of installments) {
    if (!['pending', 'overdue'].includes(String(installment?.status || '').toLowerCase())) continue

    const order = ordersMap.get(String(installment?.service_order_id || ''))
    if (!order) continue
    if (orderStatusFilters.length > 0 && !orderStatusFilters.includes(String(order?.status || ''))) continue
    const clientId = String(order?.client_id || '')
    if (!clientId) continue

    const dueDate = installment?.due_date || null
    const dueDateObj = dueDate ? new Date(`${dueDate}T00:00:00`) : null
    const daysOverdue = dueDateObj && !Number.isNaN(dueDateObj.getTime()) ? Math.max(0, Math.floor((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))) : 0

    if (!debtorsMap[clientId]) debtorsMap[clientId] = { clientId, totalOwed: 0, pendingItems: [], daysOverdue: 0, earliestDue: null }
    const debtor = debtorsMap[clientId]
    const amount = toNumber(installment?.amount, 0)
    debtor.totalOwed += amount
    if (daysOverdue > debtor.daysOverdue) debtor.daysOverdue = daysOverdue
    if (dueDate && (!debtor.earliestDue || dueDate < debtor.earliestDue)) debtor.earliestDue = dueDate

    debtor.pendingItems.push({
      type: 'installment', id: installment.id, orderId: order.id, number: `${order?.number || '-'} P${installment?.installment_number || '?'}`,
      amount, dueDate, paymentMethod: installment?.payment_method || null,
      orderStatus: order?.status || null, daysOverdue,
      status: daysOverdue > 0 ? 'overdue' : 'current'
    })
  }

  let debtors: DebtorClientRow[] = Object.values(debtorsMap).map((debtor) => {
    const client = clientsMap.get(debtor.clientId)
    return {
      ...debtor,
      client,
      clientName: client?.name || 'Unknown',
      phone: client?.phone || null,
      email: client?.email || null,
      status: debtor.daysOverdue > 0 ? 'overdue' : 'current'
    }
  })

  if (clientIds.length > 0) debtors = debtors.filter(d => clientIds.includes(d.clientId))
  if (statusFilters.length > 0) debtors = debtors.filter(d => statusFilters.includes(d.status))
  if (paymentMethodFilters.length > 0) {
    debtors = debtors.filter(d => d.pendingItems.some(item => paymentMethodFilters.includes(String(item.paymentMethod || 'no_payment'))))
  }
  if (dateFrom || dateTo) {
    debtors = debtors.filter(d => d.pendingItems.some((item) => {
      const due = item.dueDate ? new Date(`${item.dueDate}T00:00:00`) : null
      if (!due || Number.isNaN(due.getTime())) return false
      if (dateFrom && due < dateFrom) return false
      if (dateTo && due > dateTo) return false
      return true
    }))
  }
  if (searchTerm) {
    debtors = debtors.filter(d =>
      d.clientName.toLowerCase().includes(searchTerm)
      || (d.phone && d.phone.toLowerCase().includes(searchTerm))
      || (d.email && d.email.toLowerCase().includes(searchTerm))
    )
  }

  const factor = sortFactor(sortOrder)
  debtors.sort((a, b) => {
    if (sortBy === 'total_owed') return (a.totalOwed - b.totalOwed) * factor
    if (sortBy === 'days_overdue') return (a.daysOverdue - b.daysOverdue) * factor
    if (sortBy === 'earliest_due') return String(a.earliestDue || '').localeCompare(String(b.earliestDue || '')) * factor
    if (sortBy === 'status') return String(a.status).localeCompare(String(b.status)) * factor
    return a.clientName.localeCompare(b.clientName, 'pt-BR', { sensitivity: 'base' }) * factor
  })

  const orderRowsMap = new Map<string, DebtorOrderRow>()

  for (const debtor of debtors) {
    for (const item of debtor.pendingItems) {
      const baseOrderId = item.orderId ? String(item.orderId) : `${debtor.clientId}-${item.number}`
      const orderNumber = String(item.number || '').split(' P')[0] || null
      const existing = orderRowsMap.get(baseOrderId)

      if (!existing) {
        orderRowsMap.set(baseOrderId, {
          rowId: baseOrderId,
          orderId: item.orderId ? String(item.orderId) : null,
          orderNumber,
          clientId: debtor.clientId,
          clientName: debtor.clientName,
          phone: debtor.phone,
          email: debtor.email,
          totalOwed: item.amount,
          pendingItems: [item],
          daysOverdue: item.daysOverdue,
          earliestDue: item.dueDate,
          status: item.daysOverdue > 0 ? 'overdue' : 'current'
        })
        continue
      }

      existing.totalOwed += item.amount
      existing.pendingItems.push(item)
      if (item.daysOverdue > existing.daysOverdue) existing.daysOverdue = item.daysOverdue
      if (item.dueDate && (!existing.earliestDue || item.dueDate < existing.earliestDue)) existing.earliestDue = item.dueDate
      if (existing.status !== 'overdue' && item.daysOverdue > 0) existing.status = 'overdue'
    }
  }

  const orderRows = Array.from(orderRowsMap.values())

  orderRows.sort((a, b) => {
    if (sortBy === 'order_number') return String(a.orderNumber || '').localeCompare(String(b.orderNumber || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'total_owed') return (a.totalOwed - b.totalOwed) * factor
    if (sortBy === 'days_overdue') return (a.daysOverdue - b.daysOverdue) * factor
    if (sortBy === 'earliest_due') return String(a.earliestDue || '').localeCompare(String(b.earliestDue || '')) * factor
    if (sortBy === 'status') return String(a.status).localeCompare(String(b.status), 'pt-BR', { sensitivity: 'base' }) * factor
    return a.clientName.localeCompare(b.clientName, 'pt-BR', { sensitivity: 'base' }) * factor
  })

  const totals = {
    total: debtors.reduce((s, d) => s + d.totalOwed, 0),
    overdue: debtors.filter(d => d.status === 'overdue').reduce((s, d) => s + d.totalOwed, 0),
    current: debtors.filter(d => d.status === 'current').reduce((s, d) => s + d.totalOwed, 0)
  }

  const availableClients = clients.map(c => ({ value: c.id, label: c.name || 'No name' })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

  const sourceItems = viewMode === 'orders' ? orderRows : debtors
  const { data: paginatedItems, pagination } = paginate(sourceItems, page, pageSize)

  return {
    data: {
      debtorsReport: {
        filters: { availableClients },
        items: viewMode === 'clients' ? (paginatedItems as DebtorClientRow[]) : [],
        orderItems: viewMode === 'orders' ? (paginatedItems as DebtorOrderRow[]) : [],
        totals,
        counts: { clients: debtors.length, orders: orderRows.length },
        pagination,
        sort: { sortBy, sortOrder }
      }
    }
  }
})
