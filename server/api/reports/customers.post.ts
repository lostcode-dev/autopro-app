import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/reports/customers
 * Returns customers report data with aggregated order stats.
 * Migrated from: supabase/functions/getCustomersReportData
 */

function parseDateStart(value?: string) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseDateEnd(value?: string) {
  if (!value) return null
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? null : date
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const payload = (await readBody(event)) || {}

  const sortBy = ['nome', 'totalGasto', 'totalPago', 'ultimaVisita'].includes(payload?.sortBy) ? payload.sortBy : 'totalGasto'
  const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(payload?.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(payload?.pageSize, 10))))
  const searchTerm = String(payload?.searchTerm || '').trim().toLowerCase()
  const selectedClienteId = payload?.selectedClienteId ? String(payload.selectedClienteId) : null
  const skipList = payload?.skipList === true
  const dateFrom = parseDateStart(payload?.dateFrom)
  const dateTo = parseDateEnd(payload?.dateTo)
  const osStatusFilters = Array.isArray(payload?.osStatusFilters) ? payload.osStatusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const paymentStatusFilters = Array.isArray(payload?.paymentStatusFilters) ? payload.paymentStatusFilters.map((v: unknown) => String(v)).filter(Boolean) : []

  const [ordensResult, clientesResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('clients').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const ordens = ordensResult.data || []
  const clientes = clientesResult.data || []
  const clientesMap = new Map<string, any>(clientes.map((c: any) => [String(c.id), c]))

  const filteredOrdens = ordens.filter((o: any) => {
    if (o?.status === 'cancelled') return false
    if (osStatusFilters.length > 0 && !osStatusFilters.includes(String(o?.status || ''))) return false
    if (paymentStatusFilters.length > 0 && !paymentStatusFilters.includes(String(o?.payment_status || ''))) return false
    if (dateFrom || dateTo) {
      const de = o?.entry_date ? new Date(`${o.entry_date}T00:00:00`) : null
      if (!de || Number.isNaN(de.getTime())) return false
      if (dateFrom && de < dateFrom) return false
      if (dateTo && de > dateTo) return false
    }
    return true
  })

  // Group by client
  const groupedByCliente: Record<string, { totalGasto: number; totalPago: number; totalOS: number; ultimaVisita: string | null }> = {}
  for (const o of filteredOrdens) {
    const cid = String(o?.client_id || '')
    if (!cid) continue
    if (!groupedByCliente[cid]) groupedByCliente[cid] = { totalGasto: 0, totalPago: 0, totalOS: 0, ultimaVisita: null }
    const g = groupedByCliente[cid]
    g.totalGasto += toNumber(o?.total_amount, 0)
    if (o?.payment_status === 'paid') g.totalPago += toNumber(o?.total_amount, 0)
    g.totalOS += 1
    const de = String(o?.entry_date || '')
    if (de && (!g.ultimaVisita || de > g.ultimaVisita)) g.ultimaVisita = de
  }

  let items = Object.entries(groupedByCliente).map(([clienteId, stats]) => {
    const cliente = clientesMap.get(clienteId)
    return { id: clienteId, nome: cliente?.name || 'Desconhecido', ...stats }
  })

  if (searchTerm) {
    items = items.filter((i) => i.nome.toLowerCase().includes(searchTerm))
  }

  items.sort((a, b) => {
    const factor = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'totalPago') return (a.totalPago - b.totalPago) * factor
    if (sortBy === 'ultimaVisita') return String(a.ultimaVisita || '').localeCompare(String(b.ultimaVisita || '')) * factor
    return (a.totalGasto - b.totalGasto) * factor
  })

  const summary = {
    totalFaturamento: items.reduce((s, i) => s + i.totalGasto, 0),
    totalClientesAtivos: items.length,
    totalOS: items.reduce((s, i) => s + i.totalOS, 0),
  }

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedItems = skipList ? [] : items.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

  const result: Record<string, any> = {
    organization_id: organizationId,
    data: {
      items: paginatedItems,
      pagination: { page: currentPage, pageSize, totalItems, totalPages },
      sort: { sortBy, sortOrder },
      summary,
    },
  }

  if (selectedClienteId) {
    const cliente = clientesMap.get(selectedClienteId)
    const clienteOrdens = filteredOrdens.filter((o: any) => String(o?.client_id) === selectedClienteId)
    const totalGasto = clienteOrdens.reduce((s: number, o: any) => s + toNumber(o?.total_amount, 0), 0)
    result.data.selectedCustomerDetail = {
      cliente, ordens: clienteOrdens,
      stats: { totalGasto, totalOS: clienteOrdens.length, ticketMedio: clienteOrdens.length > 0 ? totalGasto / clienteOrdens.length : 0 },
    }
  }

  return result
})
