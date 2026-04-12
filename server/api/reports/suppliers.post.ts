import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/reports/suppliers
 * Returns suppliers report with purchase aggregation per supplier.
 * Migrated from: supabase/functions/getSuppliersReportData
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

  const dateFrom = parseDateStart(payload?.dateFrom)
  const dateTo = parseDateEnd(payload?.dateTo)
  const fornecedorIds = Array.isArray(payload?.fornecedorIds) ? payload.fornecedorIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const selectedFornecedorId = payload?.selectedFornecedorId ? String(payload.selectedFornecedorId) : null
  const sortBy = ['nome', 'totalComprado', 'quantidadeCompras', 'quantidadeItens', 'mediaPorCompra', 'ultimaCompra'].includes(payload?.sortBy) ? payload.sortBy : 'nome'
  const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(payload?.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(payload?.pageSize, 10))))

  const [comprasResult, fornecedoresResult] = await Promise.all([
    supabase.from('purchases').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('purchase_date', { ascending: false }),
    supabase.from('suppliers').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const compras = comprasResult.data || []
  const fornecedores = fornecedoresResult.data || []
  const fornecedoresMap = new Map<string, any>(fornecedores.map((f: any) => [String(f.id), f]))

  let comprasFiltradas = compras
  if (dateFrom || dateTo) {
    comprasFiltradas = comprasFiltradas.filter((c: any) => {
      const dc = c?.purchase_date ? new Date(`${c.purchase_date}T00:00:00`) : null
      if (!dc || Number.isNaN(dc.getTime())) return false
      if (dateFrom && dc < dateFrom) return false
      if (dateTo && dc > dateTo) return false
      return true
    })
  }
  if (fornecedorIds.length > 0) comprasFiltradas = comprasFiltradas.filter((c: any) => fornecedorIds.includes(String(c?.supplier_id || '')))

  // Group by supplier
  const supplierStats: Record<string, { totalComprado: number; quantidadeCompras: number; quantidadeItens: number; ultimaCompra: string | null; topItensMap: Record<string, number> }> = {}

  for (const c of comprasFiltradas) {
    const sid = String(c?.supplier_id || '')
    if (!sid) continue
    if (!supplierStats[sid]) supplierStats[sid] = { totalComprado: 0, quantidadeCompras: 0, quantidadeItens: 0, ultimaCompra: null, topItensMap: {} }
    const s = supplierStats[sid]
    s.totalComprado += toNumber(c?.total_amount, 0)
    s.quantidadeCompras += 1
    const items = Array.isArray(c?.items) ? c.items : []
    s.quantidadeItens += items.length
    const dc = String(c?.purchase_date || '')
    if (dc && (!s.ultimaCompra || dc > s.ultimaCompra)) s.ultimaCompra = dc
    for (const item of items) {
      const desc = String(item?.description || 'Sem descrição')
      s.topItensMap[desc] = (s.topItensMap[desc] || 0) + (Number(item?.quantity) || 1)
    }
  }

  let supplierItems = Object.entries(supplierStats).map(([sid, stats]) => {
    const fornecedor = fornecedoresMap.get(sid)
    const topItens = Object.entries(stats.topItensMap).sort(([, a], [, b]) => b - a).slice(0, 5)
    return {
      id: sid, nome: fornecedor?.name || 'Desconhecido',
      totalComprado: stats.totalComprado, quantidadeCompras: stats.quantidadeCompras,
      quantidadeItens: stats.quantidadeItens,
      mediaPorCompra: stats.quantidadeCompras > 0 ? stats.totalComprado / stats.quantidadeCompras : 0,
      ultimaCompra: stats.ultimaCompra, topItens,
    }
  })

  supplierItems.sort((a, b) => {
    const factor = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'totalComprado') return (a.totalComprado - b.totalComprado) * factor
    if (sortBy === 'quantidadeCompras') return (a.quantidadeCompras - b.quantidadeCompras) * factor
    if (sortBy === 'quantidadeItens') return (a.quantidadeItens - b.quantidadeItens) * factor
    if (sortBy === 'mediaPorCompra') return (a.mediaPorCompra - b.mediaPorCompra) * factor
    if (sortBy === 'ultimaCompra') return String(a.ultimaCompra || '').localeCompare(String(b.ultimaCompra || '')) * factor
    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) * factor
  })

  const totalItems = supplierItems.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedItems = supplierItems.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

  const result: Record<string, any> = {
    organization_id: organizationId,
    data: {
      suppliersReport: {
        availableSuppliers: fornecedores.map((f: any) => ({ id: f.id, nome: f.name || '' })).sort((a: any, b: any) => a.nome.localeCompare(b.nome, 'pt-BR')),
        items: paginatedItems,
        summary: { totalComprado: supplierItems.reduce((s, i) => s + i.totalComprado, 0), totalFornecedores: supplierItems.length },
        pagination: { page: currentPage, pageSize, totalItems, totalPages },
        sort: { sortBy, sortOrder },
      },
    },
  }

  if (selectedFornecedorId) {
    const dailyMap: Record<string, number> = {}
    for (const c of comprasFiltradas.filter((c: any) => String(c?.supplier_id) === selectedFornecedorId)) {
      const d = String(c?.purchase_date || '')
      if (!d) continue
      dailyMap[d] = (dailyMap[d] || 0) + toNumber(c?.total_amount, 0)
    }
    result.data.suppliersReport.selectedSupplierDaily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([name, total]) => ({ name, total }))
  }

  return result
})
