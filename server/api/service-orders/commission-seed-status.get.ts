import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

/**
 * GET /api/service-orders/commission-seed-status
 * Lists service orders with their item commission seed status.
 */

function normalizeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim()
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    estimate: 'Orçamento', open: 'Aberta', in_progress: 'Em andamento',
    completed: 'Concluída', delivered: 'Entregue', cancelled: 'Cancelada',
  }
  if (map[status]) return map[status]
  if (!status) return 'Não informado'
  return String(status).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
}

function hasStoredItemCommission(item: any) {
  return item?.commission_total != null && Array.isArray(item?.commissions)
}

function getResponsiblesFromOrder(order: any, employeesMap: Map<string, any>) {
  const ids: string[] = []
  if (Array.isArray(order?.responsible_employees) && order.responsible_employees.length > 0) {
    for (const resp of order.responsible_employees) {
      const empId = String(resp?.employee_id || '').trim()
      if (empId) ids.push(empId)
    }
  } else {
    const empId = String(order?.employee_responsible_id || '').trim()
    if (empId) ids.push(empId)
  }
  return Array.from(new Set(ids)).map((empId) => {
    const emp = employeesMap.get(empId)
    return { id: emp?.id || empId, name: emp?.name || 'Responsible not found' }
  })
}

function getSeedStatus(order: any, responsiblesCount: number, totalItems: number, missingItemsCount: number) {
  if (String(order?.status || '') === 'cancelled') {
    return { requiresSeed: false, statusKey: 'cancelled', statusLabel: 'Cancelled' }
  }
  if (responsiblesCount === 0) {
    return { requiresSeed: false, statusKey: 'no_responsibles', statusLabel: 'No responsibles' }
  }
  if (totalItems === 0) {
    return { requiresSeed: false, statusKey: 'no_items', statusLabel: 'No items' }
  }
  if (missingItemsCount > 0) {
    return { requiresSeed: true, statusKey: 'pending', statusLabel: 'Needs seeding' }
  }
  return { requiresSeed: false, statusKey: 'ok', statusLabel: 'Already seeded' }
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const query = getQuery(event)
  const page = Math.max(1, Math.floor(normalizeNumber(query.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(normalizeNumber(query.pageSize) || 20)))
  const search = normalizeString(query.search).toLowerCase()
  const filterMode = ['needs_seed', 'all', 'ready'].includes(String(query.filterMode || '')) ? String(query.filterMode) : 'needs_seed'

  const [ordersResult, clientsResult, employeesResult] = await Promise.all([
    supabase.from('service_orders').select('*').is('deleted_at', null).order('entry_date', { ascending: false }),
    supabase.from('clients').select('id, name').is('deleted_at', null),
    supabase.from('employees').select('*').is('deleted_at', null),
  ])

  const orders = ordersResult.data || []
  const clients = clientsResult.data || []
  const employees = employeesResult.data || []

  const clientsMap = new Map(clients.map((c: any) => [String(c.id), c]))
  const employeesMap = new Map(employees.map((e: any) => [String(e.id), e]))

  const rows = orders.map((order: any) => {
    const responsibles = getResponsiblesFromOrder(order, employeesMap)
    const items = Array.isArray(order?.items) ? order.items : []
    const totalItems = items.length
    const seededItemsCount = items.filter((item: any) => hasStoredItemCommission(item)).length
    const missingItemsCount = Math.max(0, totalItems - seededItemsCount)
    const seedStatus = getSeedStatus(order, responsibles.length, totalItems, missingItemsCount)
    const clientName = String(clientsMap.get(String(order?.client_id || ''))?.name || 'Client not found')

    return {
      id: String(order.id),
      orderNumber: String(order?.number || '-'),
      clientName,
      entryDate: String(order?.entry_date || ''),
      status: String(order?.status || ''),
      statusLabel: getStatusLabel(String(order?.status || '')),
      totalItems,
      seededItemsCount,
      missingItemsCount,
      responsiblesCount: responsibles.length,
      responsibleNames: responsibles.map((r: any) => r.name),
      requiresSeed: seedStatus.requiresSeed,
      seedStatusKey: seedStatus.statusKey,
      seedStatusLabel: seedStatus.statusLabel,
    }
  })

  const filteredRows = rows.filter((row: any) => {
    if (filterMode === 'needs_seed' && !row.requiresSeed) return false
    if (filterMode === 'ready' && row.requiresSeed) return false
    if (!search) return true
    return [row.orderNumber, row.clientName, row.statusLabel, ...(row.responsibleNames || [])].join(' ').toLowerCase().includes(search)
  })

  filteredRows.sort((left: any, right: any) => {
    if (left.requiresSeed !== right.requiresSeed) return left.requiresSeed ? -1 : 1
    return String(right.entryDate || '').localeCompare(String(left.entryDate || ''), 'pt-BR', { sensitivity: 'base' })
  })

  const totalItems = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

  const summary = {
    totalOrders: rows.length,
    filteredOrders: filteredRows.length,
    requiresSeedCount: rows.filter((r: any) => r.requiresSeed).length,
    readyCount: rows.filter((r: any) => !r.requiresSeed && r.seedStatusKey === 'ok').length,
    totalMissingItems: rows.reduce((sum: number, r: any) => sum + normalizeNumber(r.missingItemsCount), 0),
  }

  return {
    success: true,
    data: {
      summary,
      items: pagedRows,
      pagination: { page: currentPage, pageSize, totalItems, totalPages },
    },
  }
})
