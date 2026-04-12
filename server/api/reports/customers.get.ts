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

  const sortBy = ['name', 'totalSpent', 'totalPaid', 'lastVisit'].includes(query.sortBy as string) ? String(query.sortBy) : 'totalSpent'
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(query.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(query.pageSize, 10))))
  const searchTerm = String(query.searchTerm || '').trim().toLowerCase()
  const selectedClientId = query.selectedClientId ? String(query.selectedClientId) : null
  const skipList = query.skipList === 'true'
  const dateFrom = parseDateStart(query.dateFrom as string)
  const dateTo = parseDateEnd(query.dateTo as string)
  const orderStatusFilters = qArr(query.orderStatusFilters)
  const paymentStatusFilters = qArr(query.paymentStatusFilters)

  const [ordersResult, clientsResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('clients').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const orders = ordersResult.data || []
  const clients = clientsResult.data || []
  const clientsMap = new Map<string, any>(clients.map((c: any) => [String(c.id), c]))

  const filteredOrders = orders.filter((o: any) => {
    if (o?.status === 'cancelled') return false
    if (orderStatusFilters.length > 0 && !orderStatusFilters.includes(String(o?.status || ''))) return false
    if (paymentStatusFilters.length > 0 && !paymentStatusFilters.includes(String(o?.payment_status || ''))) return false
    if (dateFrom || dateTo) {
      const entryDate = o?.entry_date ? new Date(`${o.entry_date}T00:00:00`) : null
      if (!entryDate || Number.isNaN(entryDate.getTime())) return false
      if (dateFrom && entryDate < dateFrom) return false
      if (dateTo && entryDate > dateTo) return false
    }
    return true
  })

  // Group by client
  const groupedByClient: Record<string, { totalSpent: number; totalPaid: number; totalOrders: number; lastVisit: string | null }> = {}
  for (const o of filteredOrders) {
    const clientId = String(o?.client_id || '')
    if (!clientId) continue
    if (!groupedByClient[clientId]) groupedByClient[clientId] = { totalSpent: 0, totalPaid: 0, totalOrders: 0, lastVisit: null }
    const g = groupedByClient[clientId]
    g.totalSpent += toNumber(o?.total_amount, 0)
    if (o?.payment_status === 'paid') g.totalPaid += toNumber(o?.total_amount, 0)
    g.totalOrders += 1
    const entryDate = String(o?.entry_date || '')
    if (entryDate && (!g.lastVisit || entryDate > g.lastVisit)) g.lastVisit = entryDate
  }

  let items = Object.entries(groupedByClient).map(([clientId, stats]) => {
    const client = clientsMap.get(clientId)
    return { id: clientId, name: client?.name || 'Unknown', ...stats }
  })

  if (searchTerm) items = items.filter((i) => i.name.toLowerCase().includes(searchTerm))

  const factor = sortFactor(sortOrder)
  items.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'totalPaid') return (a.totalPaid - b.totalPaid) * factor
    if (sortBy === 'lastVisit') return String(a.lastVisit || '').localeCompare(String(b.lastVisit || '')) * factor
    return (a.totalSpent - b.totalSpent) * factor
  })

  const summary = {
    totalRevenue: items.reduce((s, i) => s + i.totalSpent, 0),
    totalActiveClients: items.length,
    totalOrders: items.reduce((s, i) => s + i.totalOrders, 0),
  }

  const { data: paginatedItems, pagination } = paginate(items, page, pageSize)

  const result: Record<string, any> = {
    data: {
      items: skipList ? [] : paginatedItems,
      pagination,
      sort: { sortBy, sortOrder },
      summary,
    },
  }

  if (selectedClientId) {
    const client = clientsMap.get(selectedClientId)
    const clientOrders = filteredOrders.filter((o: any) => String(o?.client_id) === selectedClientId)
    const totalSpent = clientOrders.reduce((s: number, o: any) => s + toNumber(o?.total_amount, 0), 0)
    result.data.selectedCustomerDetail = {
      client, orders: clientOrders,
      stats: { totalSpent, totalOrders: clientOrders.length, averageTicket: clientOrders.length > 0 ? totalSpent / clientOrders.length : 0 },
    }
  }

  return result
})
