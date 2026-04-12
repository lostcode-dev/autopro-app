import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/reports/purchases
 * Returns purchases report data with supplier aggregation, charts.
 * Migrated from: supabase/functions/getPurchasesReportData
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

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

function getStatusPagamento(compra: any) {
  if (compra?.payment_status === 'paid') return 'pago'
  if (compra?.due_date) {
    const vencimento = new Date(`${compra.due_date}T00:00:00`)
    if (!Number.isNaN(vencimento.getTime()) && vencimento < new Date()) return 'vencido'
  }
  return 'pendente'
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const payload = (await readBody(event)) || {}

  const dateFrom = parseDateStart(payload?.dateFrom)
  const dateTo = parseDateEnd(payload?.dateTo)
  const fornecedorIds = Array.isArray(payload?.fornecedorIds) ? payload.fornecedorIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const statusFilter = payload?.status && payload.status !== 'todos' ? String(payload.status) : null
  const searchTerm = String(payload?.searchTerm || '').trim().toLowerCase()
  const sortBy = ['data_compra', 'valor_total', 'fornecedor', 'numero_nota_fiscal', 'status'].includes(payload?.sortBy) ? payload.sortBy : 'data_compra'
  const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(payload?.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(payload?.pageSize, 20))))

  const [comprasResult, fornecedoresResult] = await Promise.all([
    supabase.from('purchases').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('purchase_date', { ascending: false }),
    supabase.from('suppliers').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const compras = comprasResult.data || []
  const fornecedores = fornecedoresResult.data || []
  const fornecedoresMap = new Map<string, any>(fornecedores.map((f: any) => [String(f.id), f]))

  let comprasFiltradas = compras.map((c: any) => ({
    ...c,
    fornecedor_nome: fornecedoresMap.get(String(c?.supplier_id || ''))?.name || 'Desconhecido',
    status_pagamento_calculado: getStatusPagamento(c),
  }))

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
  if (statusFilter) comprasFiltradas = comprasFiltradas.filter((c: any) => c.status_pagamento_calculado === statusFilter)
  if (searchTerm) {
    comprasFiltradas = comprasFiltradas.filter((c: any) =>
      c.fornecedor_nome.toLowerCase().includes(searchTerm) ||
      String(c?.invoice_number || '').toLowerCase().includes(searchTerm)
    )
  }

  comprasFiltradas.sort((a: any, b: any) => {
    const factor = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'valor_total') return (toNumber(a?.total_amount, 0) - toNumber(b?.total_amount, 0)) * factor
    if (sortBy === 'fornecedor') return a.fornecedor_nome.localeCompare(b.fornecedor_nome, 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'numero_nota_fiscal') return String(a?.invoice_number || '').localeCompare(String(b?.invoice_number || '')) * factor
    if (sortBy === 'status') return a.status_pagamento_calculado.localeCompare(b.status_pagamento_calculado) * factor
    return String(b?.purchase_date || '').localeCompare(String(a?.purchase_date || '')) * factor * (sortOrder === 'asc' ? -1 : 1)
  })

  const totalComprado = comprasFiltradas.reduce((s: number, c: any) => s + toNumber(c?.total_amount, 0), 0)
  const totalPago = comprasFiltradas.filter((c: any) => c.status_pagamento_calculado === 'pago').reduce((s: number, c: any) => s + toNumber(c?.total_amount, 0), 0)

  // Chart: top 10 suppliers by total
  const supplierTotals: Record<string, { nome: string; total: number }> = {}
  for (const c of comprasFiltradas) {
    const nome = c.fornecedor_nome
    if (!supplierTotals[nome]) supplierTotals[nome] = { nome, total: 0 }
    supplierTotals[nome].total += toNumber(c?.total_amount, 0)
  }
  const dadosPorFornecedor = Object.values(supplierTotals).sort((a, b) => b.total - a.total).slice(0, 10)

  // Chart: daily totals
  const dailyMap: Record<string, number> = {}
  for (const c of comprasFiltradas) {
    const d = String(c?.purchase_date || '')
    if (!d) continue
    dailyMap[d] = (dailyMap[d] || 0) + toNumber(c?.total_amount, 0)
  }
  // Fill gaps
  if (dateFrom && dateTo) {
    const cursor = new Date(dateFrom)
    while (cursor <= dateTo) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      if (!dailyMap[key]) dailyMap[key] = 0
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  const dadosPorDia = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ name: formatDayLabel(date), total }))

  const totalItems = comprasFiltradas.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const items = comprasFiltradas.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

  return {
    organization_id: organizationId,
    data: {
      items,
      pagination: { page: currentPage, pageSize, totalItems, totalPages },
      summary: { totalComprado, totalPago, totalPendente: totalComprado - totalPago, totalRegistros: totalItems },
      charts: { dadosPorFornecedor, dadosPorDia },
      fornecedores: fornecedores.sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR')),
    },
  }
})
