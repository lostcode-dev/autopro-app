import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

/**
 * POST /api/service-orders/commission-seed-status
 * Lists service orders with their item commission seed status.
 * Migrated from: supabase/functions/listServiceOrdersItemCommissionSeedStatus
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

function getResponsaveisFromOrder(ordem: any, funcionariosMap: Map<string, any>) {
  const ids: string[] = []
  if (Array.isArray(ordem?.responsible_employees) && ordem.responsible_employees.length > 0) {
    for (const resp of ordem.responsible_employees) {
      const fId = String(resp?.employee_id || '').trim()
      if (fId) ids.push(fId)
    }
  } else {
    const fId = String(ordem?.employee_responsible_id || '').trim()
    if (fId) ids.push(fId)
  }
  return Array.from(new Set(ids)).map((fId) => {
    const f = funcionariosMap.get(fId)
    return { id: f?.id || fId, nome: f?.name || 'Responsável não encontrado' }
  })
}

function getSeedStatus(ordem: any, responsaveisCount: number, totalItems: number, missingItemsCount: number) {
  if (String(ordem?.status || '') === 'cancelled') {
    return { requiresSeed: false, statusKey: 'cancelada', statusLabel: 'Cancelada' }
  }
  if (responsaveisCount === 0) {
    return { requiresSeed: false, statusKey: 'sem_responsaveis', statusLabel: 'Sem responsáveis' }
  }
  if (totalItems === 0) {
    return { requiresSeed: false, statusKey: 'sem_itens', statusLabel: 'Sem itens' }
  }
  if (missingItemsCount > 0) {
    return { requiresSeed: true, statusKey: 'pendente', statusLabel: 'Precisa gerar' }
  }
  return { requiresSeed: false, statusKey: 'ok', statusLabel: 'Já preenchida' }
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const body = (await readBody(event)) || {}
  const page = Math.max(1, Math.floor(normalizeNumber(body?.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(normalizeNumber(body?.pageSize) || 20)))
  const search = normalizeString(body?.search).toLowerCase()
  const filterMode = ['needs_seed', 'all', 'ready'].includes(String(body?.filterMode || '')) ? String(body.filterMode) : 'needs_seed'

  const [ordensResult, clientesResult, funcionariosResult] = await Promise.all([
    supabase.from('service_orders').select('*').is('deleted_at', null).order('entry_date', { ascending: false }),
    supabase.from('clients').select('id, name').is('deleted_at', null),
    supabase.from('employees').select('*').is('deleted_at', null),
  ])

  const ordens = ordensResult.data || []
  const clientes = clientesResult.data || []
  const funcionarios = funcionariosResult.data || []

  const clientesMap = new Map(clientes.map((c: any) => [String(c.id), c]))
  const funcionariosMap = new Map(funcionarios.map((f: any) => [String(f.id), f]))

  const rows = ordens.map((ordem: any) => {
    const responsaveis = getResponsaveisFromOrder(ordem, funcionariosMap)
    const itens = Array.isArray(ordem?.items) ? ordem.items : []
    const totalItems = itens.length
    const seededItemsCount = itens.filter((item: any) => hasStoredItemCommission(item)).length
    const missingItemsCount = Math.max(0, totalItems - seededItemsCount)
    const seedStatus = getSeedStatus(ordem, responsaveis.length, totalItems, missingItemsCount)
    const clienteNome = String(clientesMap.get(String(ordem?.client_id || ''))?.name || 'Cliente não encontrado')

    return {
      id: String(ordem.id),
      numero: String(ordem?.number || '-'),
      clienteNome,
      dataEntrada: String(ordem?.entry_date || ''),
      status: String(ordem?.status || ''),
      statusLabel: getStatusLabel(String(ordem?.status || '')),
      totalItems, seededItemsCount, missingItemsCount,
      responsaveisCount: responsaveis.length,
      responsaveisNomes: responsaveis.map((r: any) => r.nome),
      requiresSeed: seedStatus.requiresSeed,
      seedStatusKey: seedStatus.statusKey,
      seedStatusLabel: seedStatus.statusLabel,
    }
  })

  const filteredRows = rows.filter((row: any) => {
    if (filterMode === 'needs_seed' && !row.requiresSeed) return false
    if (filterMode === 'ready' && row.requiresSeed) return false
    if (!search) return true
    return [row.numero, row.clienteNome, row.statusLabel, ...(row.responsaveisNomes || [])].join(' ').toLowerCase().includes(search)
  })

  filteredRows.sort((left: any, right: any) => {
    if (left.requiresSeed !== right.requiresSeed) return left.requiresSeed ? -1 : 1
    return String(right.dataEntrada || '').localeCompare(String(left.dataEntrada || ''), 'pt-BR', { sensitivity: 'base' })
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
