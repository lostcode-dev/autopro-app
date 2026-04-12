import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/reports/commissions
 * Returns commissions report data with filters, pagination, charts.
 * Migrated from: supabase/functions/getCommissionsReportData
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
  const funcionarioIds = Array.isArray(payload?.funcionarioIds)
    ? payload.funcionarioIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const funcionarioId = payload?.funcionarioId && payload.funcionarioId !== 'todos' ? String(payload.funcionarioId) : null
  const status = payload?.status && payload.status !== 'todos' ? String(payload.status) : null
  const osStatusFilters = Array.isArray(payload?.osStatusFilters)
    ? payload.osStatusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const paymentStatusFilters = Array.isArray(payload?.paymentStatusFilters)
    ? payload.paymentStatusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const formasPagamento = Array.isArray(payload?.formasPagamento)
    ? payload.formasPagamento.map((v: unknown) => String(v)).filter(Boolean) : []
  const tipo = payload?.tipo && payload.tipo !== 'todos' ? String(payload.tipo) : null
  const searchTerm = String(payload?.searchTerm || '').trim().toLowerCase()

  const sortBy = ['funcionario', 'data', 'valor', 'status'].includes(payload?.sortBy) ? payload.sortBy : 'data'
  const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(payload?.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(payload?.pageSize, 10))))

  const [registrosResult, ordensResult, funcionariosResult] = await Promise.all([
    supabase.from('employee_financial_records').select('*').eq('organization_id', organizationId).order('reference_date', { ascending: false }),
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const registros = registrosResult.data || []
  const ordens = ordensResult.data || []
  const funcionarios = funcionariosResult.data || []

  const funcionariosMap = new Map<string, any>(funcionarios.map((f: any) => [String(f.id), f]))
  const ordensMap = new Map<string, any>(ordens.map((o: any) => [String(o.id), o]))

  const filteredRegistros = registros.filter((registro: any) => {
    const ordem = registro?.service_order_id ? ordensMap.get(String(registro.service_order_id)) : null
    const dataEntradaOs = ordem?.entry_date ? new Date(`${ordem.entry_date}T00:00:00`) : null

    if (!dataEntradaOs || Number.isNaN(dataEntradaOs.getTime())) return false
    if (dateFrom && dataEntradaOs < dateFrom) return false
    if (dateTo && dataEntradaOs > dateTo) return false

    if (funcionarioIds.length > 0) {
      if (!funcionarioIds.includes(String(registro?.employee_id || ''))) return false
    } else if (funcionarioId && registro?.employee_id !== funcionarioId) return false

    if (paymentStatusFilters.length > 0) {
      const ordemStatusPagamento = String(ordem?.payment_status || '')
      if (!ordemStatusPagamento || !paymentStatusFilters.includes(ordemStatusPagamento)) return false
    }

    if (status && registro?.status !== status) return false

    if (osStatusFilters.length > 0) {
      const ordemStatus = String(ordem?.status || '')
      if (!ordemStatus || !osStatusFilters.includes(ordemStatus)) return false
    }

    if (formasPagamento.length > 0) {
      const formaPgto = String(ordem?.payment_method || '')
      const key = formaPgto || 'no_payment'
      if (!formasPagamento.includes(key)) return false
    }

    if (tipo && registro?.record_type !== tipo) return false

    if (searchTerm) {
      const nome = String(funcionariosMap.get(String(registro?.employee_id || ''))?.name || '').toLowerCase()
      if (!nome.includes(searchTerm)) return false
    }

    return true
  })

  const summary = {
    totalComissoes: filteredRegistros.reduce((sum: number, item: any) => sum + toNumber(item?.amount, 0), 0),
    comissoesPagas: filteredRegistros.filter((i: any) => i?.status === 'pago').reduce((sum: number, i: any) => sum + toNumber(i?.amount, 0), 0),
    comissoesPendentes: filteredRegistros.filter((i: any) => i?.status === 'pendente').reduce((sum: number, i: any) => sum + toNumber(i?.amount, 0), 0),
    totalRegistros: filteredRegistros.length,
  }

  const groupedByFuncionario: Record<string, { nome: string; total: number; pago: number; pendente: number }> = {}
  for (const registro of filteredRegistros) {
    const funcionarioNome = String(funcionariosMap.get(String(registro?.employee_id || ''))?.name || 'Desconhecido')
    if (!groupedByFuncionario[funcionarioNome]) {
      groupedByFuncionario[funcionarioNome] = { nome: funcionarioNome, total: 0, pago: 0, pendente: 0 }
    }
    const value = toNumber(registro?.amount, 0)
    groupedByFuncionario[funcionarioNome].total += value
    if (registro?.status === 'pago') groupedByFuncionario[funcionarioNome].pago += value
    else groupedByFuncionario[funcionarioNome].pendente += value
  }

  const dadosPorFuncionario = Object.values(groupedByFuncionario).sort((a, b) => b.total - a.total)
  const dadosStatusDistribuicao = [
    { name: 'Pagas', value: summary.comissoesPagas, color: '#22c55e' },
    { name: 'Pendentes', value: summary.comissoesPendentes, color: '#f59e0b' },
  ]

  const enrichedRegistros = filteredRegistros.map((registro: any) => {
    const ordem = registro?.service_order_id ? ordensMap.get(String(registro.service_order_id)) : null
    return {
      ...registro,
      funcionario_nome: String(funcionariosMap.get(String(registro?.employee_id || ''))?.name || 'Desconhecido'),
      ordem_numero: ordem?.number || 'N/A',
      ordem_status: ordem?.status || null,
      ordem_status_pagamento: ordem?.payment_status || null,
      ordem_cliente_nome: ordem?.client_name || null,
      ordem_data_entrada: ordem?.entry_date || null,
      ordem_data_conclusao: ordem?.completion_date || null,
      ordem_valor_total: toNumber(ordem?.total_amount, 0),
    }
  })

  enrichedRegistros.sort((a: any, b: any) => {
    if (sortBy === 'funcionario') {
      const compare = String(a.funcionario_nome || '').localeCompare(String(b.funcionario_nome || ''), 'pt-BR', { sensitivity: 'base' })
      return sortOrder === 'asc' ? compare : -compare
    }
    if (sortBy === 'valor') {
      const diff = toNumber(a?.amount, 0) - toNumber(b?.amount, 0)
      return sortOrder === 'asc' ? diff : -diff
    }
    if (sortBy === 'status') {
      const compare = String(a?.status || '').localeCompare(String(b?.status || ''), 'pt-BR', { sensitivity: 'base' })
      return sortOrder === 'asc' ? compare : -compare
    }
    const aDate = String(a?.ordem_data_entrada || a?.reference_date || '')
    const bDate = String(b?.ordem_data_entrada || b?.reference_date || '')
    return sortOrder === 'asc' ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate)
  })

  const totalItems = enrichedRegistros.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const items = enrichedRegistros.slice(startIndex, startIndex + pageSize)

  return {
    organization_id: organizationId,
    data: {
      items,
      pagination: { page: currentPage, pageSize, totalItems, totalPages },
      sort: { sortBy, sortOrder },
      summary,
      charts: { dadosPorFuncionario, dadosStatusDistribuicao },
      funcionarios,
    },
  }
})
