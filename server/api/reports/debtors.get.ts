import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { parseDateStart, parseDateEnd, toNumber, qArr, paginate, sortFactor } from '../../utils/report-helpers'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)

  const sortBy = ['client_name', 'total_owed', 'days_overdue', 'earliest_due', 'status'].includes(query.sortBy as string) ? String(query.sortBy) : 'client_name'
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(query.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(query.pageSize, 10))))
  const searchTerm = String(query.searchTerm || '').trim().toLowerCase()
  const statusFilters = qArr(query.statusFilters)
  const paymentMethodFilters = qArr(query.paymentMethodFilters)
  const clientIds = qArr(query.clientIds)
  const dateFrom = parseDateStart(query.dateFrom as string)
  const dateTo = parseDateEnd(query.dateTo as string)

  const [ordersResult, installmentsResult, clientsResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('service_order_installments').select('*').eq('organization_id', organizationId),
    supabase.from('clients').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const orders = ordersResult.data || []
  const installments = installmentsResult.data || []
  const clients = clientsResult.data || []
  const clientsMap = new Map<string, any>(clients.map((c: any) => [String(c.id), c]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const debtorsMap: Record<string, { clientId: string; totalOwed: number; pendingItems: any[]; daysOverdue: number; earliestDue: string | null }> = {}

  // From service orders (non-installment, unpaid)
  for (const order of orders) {
    if (order?.status === 'cancelled' || order?.status === 'estimate') continue
    if (order?.payment_status !== 'pending' && order?.payment_status !== 'partial') continue
    if (order?.is_installment) continue

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
      type: 'order', id: order.id, number: order?.number || '-', amount,
      dueDate, paymentMethod: order?.payment_method || null,
      orderStatus: order?.status || null, daysOverdue,
      status: daysOverdue > 0 ? 'overdue' : 'current',
    })
  }

  // From installments
  for (const installment of installments) {
    if (installment?.status !== 'pendente' && installment?.status !== 'atrasado') continue

    const order = orders.find((o: any) => String(o?.id) === String(installment?.service_order_id))
    if (!order) continue
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
      type: 'installment', id: installment.id, number: `${order?.number || '-'} P${installment?.installment_number || '?'}`,
      amount, dueDate, paymentMethod: installment?.payment_method || null,
      orderStatus: order?.status || null, daysOverdue,
      status: daysOverdue > 0 ? 'overdue' : 'current',
    })
  }

  let debtors = Object.values(debtorsMap).map((debtor) => {
    const client = clientsMap.get(debtor.clientId)
    return {
      ...debtor,
      client,
      clientName: client?.name || 'Unknown',
      phone: client?.phone || null,
      email: client?.email || null,
      status: debtor.daysOverdue > 0 ? 'overdue' : 'current',
    }
  })

  if (clientIds.length > 0) debtors = debtors.filter((d) => clientIds.includes(d.clientId))
  if (statusFilters.length > 0) debtors = debtors.filter((d) => statusFilters.includes(d.status))
  if (paymentMethodFilters.length > 0) {
    debtors = debtors.filter((d) => d.pendingItems.some((i: any) => paymentMethodFilters.includes(String(i.paymentMethod || 'no_payment'))))
  }
  if (dateFrom || dateTo) {
    debtors = debtors.filter((d) => d.pendingItems.some((i: any) => {
      const due = i.dueDate ? new Date(`${i.dueDate}T00:00:00`) : null
      if (!due || Number.isNaN(due.getTime())) return false
      if (dateFrom && due < dateFrom) return false
      if (dateTo && due > dateTo) return false
      return true
    }))
  }
  if (searchTerm) {
    debtors = debtors.filter((d) =>
      d.clientName.toLowerCase().includes(searchTerm) ||
      (d.phone && d.phone.toLowerCase().includes(searchTerm)) ||
      (d.email && d.email.toLowerCase().includes(searchTerm))
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

  const totals = {
    total: debtors.reduce((s, d) => s + d.totalOwed, 0),
    overdue: debtors.filter((d) => d.status === 'overdue').reduce((s, d) => s + d.totalOwed, 0),
    current: debtors.filter((d) => d.status === 'current').reduce((s, d) => s + d.totalOwed, 0),
  }

  const availableClients = clients.map((c: any) => ({ value: c.id, label: c.name || 'No name' })).sort((a: any, b: any) => a.label.localeCompare(b.label, 'pt-BR'))

  const { data: paginatedItems, pagination } = paginate(debtors, page, pageSize)

  return {
    data: {
      debtorsReport: {
        filters: { availableClients },
        items: paginatedItems,
        totals,
        pagination,
        sort: { sortBy, sortOrder },
      },
    },
  }
})
