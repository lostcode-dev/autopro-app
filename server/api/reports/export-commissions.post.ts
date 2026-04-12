import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { buildReportDownloadData } from '../../utils/report-export'

/**
 * POST /api/reports/export-commissions
 * Exports commissions report as PDF or CSV.
 * Migrated from: supabase/functions/exportCommissionsReport
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

function formatOptionalDate(value: unknown) {
  if (!value) return '-'
  try {
    const date = new Date(String(value).includes('T') ? String(value) : `${String(value)}T00:00:00`)
    if (Number.isNaN(date.getTime())) return '-'
    return new Intl.DateTimeFormat('pt-BR').format(date)
  } catch { return '-' }
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value, 0))
}

function formatStatusLabel(value: unknown) {
  const status = String(value || '')
  if (!status) return '-'
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const payload = (await readBody(event)) || {}

  const dateFrom = parseDateStart(payload?.dateFrom)
  const dateTo = parseDateEnd(payload?.dateTo)
  const funcionarioIds = Array.isArray(payload?.funcionarioIds) ? payload.funcionarioIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const funcionarioId = payload?.funcionarioId && payload.funcionarioId !== 'todos' ? String(payload.funcionarioId) : null
  const status = payload?.status && payload.status !== 'todos' ? String(payload.status) : null
  const osStatusFilters = Array.isArray(payload?.osStatusFilters) ? payload.osStatusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const paymentStatusFilters = Array.isArray(payload?.paymentStatusFilters) ? payload.paymentStatusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const formasPagamento = Array.isArray(payload?.formasPagamento) ? payload.formasPagamento.map((v: unknown) => String(v)).filter(Boolean) : []
  const tipo = payload?.tipo && payload.tipo !== 'todos' ? String(payload.tipo) : null
  const searchTerm = String(payload?.searchTerm || '').trim().toLowerCase()
  const sortBy = ['funcionario', 'data', 'valor', 'status'].includes(payload?.sortBy) ? payload.sortBy : 'data'
  const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc'
  const format = payload?.format === 'pdf' ? 'pdf' : 'csv'

  const [registrosResult, ordensResult, funcionariosResult] = await Promise.all([
    supabase.from('employee_financial_records').select('*').eq('organization_id', organizationId).order('reference_date', { ascending: false }),
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const registros = registrosResult.data || []
  const ordens = ordensResult.data || []
  const funcionarios = funcionariosResult.data || []

  const funcionariosMap = new Map(funcionarios.map((f: any) => [String(f.id), f]))
  const ordensMap = new Map(ordens.map((o: any) => [String(o.id), o]))

  const items = registros
    .filter((registro: any) => {
      const ordem = registro?.service_order_id ? ordensMap.get(String(registro.service_order_id)) : null
      const dataEntradaOs = ordem?.entry_date ? new Date(`${ordem.entry_date}T00:00:00`) : null
      if (!dataEntradaOs || Number.isNaN(dataEntradaOs.getTime())) return false
      if (dateFrom && dataEntradaOs < dateFrom) return false
      if (dateTo && dataEntradaOs > dateTo) return false
      if (funcionarioIds.length > 0 && !funcionarioIds.includes(String(registro?.employee_id || ''))) return false
      if (funcionarioIds.length === 0 && funcionarioId && String(registro?.employee_id) !== funcionarioId) return false
      if (status && registro?.status !== status) return false
      if (tipo && registro?.record_type !== tipo) return false
      if (paymentStatusFilters.length > 0) {
        const s = String(ordem?.payment_status || '')
        if (!s || !paymentStatusFilters.includes(s)) return false
      }
      if (osStatusFilters.length > 0) {
        const s = String(ordem?.status || '')
        if (!s || !osStatusFilters.includes(s)) return false
      }
      if (formasPagamento.length > 0) {
        const fp = String(ordem?.payment_method || '')
        if (!formasPagamento.includes(fp || 'sem_forma_pagamento')) return false
      }
      if (searchTerm) {
        const nome = String(funcionariosMap.get(String(registro?.employee_id || ''))?.name || '').toLowerCase()
        if (!nome.includes(searchTerm)) return false
      }
      return true
    })
    .map((registro: any) => {
      const ordem = registro?.service_order_id ? ordensMap.get(String(registro.service_order_id)) : null
      return {
        ...registro,
        funcionario_nome: String(funcionariosMap.get(String(registro?.employee_id || ''))?.name || 'Desconhecido'),
        ordem_numero: ordem?.number || 'N/A',
        ordem_status: ordem?.status || null,
        ordem_status_pagamento: ordem?.payment_status || null,
        ordem_data_entrada: ordem?.entry_date || null,
      }
    })

  items.sort((a: any, b: any) => {
    const factor = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'funcionario') return String(a.funcionario_nome || '').localeCompare(String(b.funcionario_nome || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'valor') return (toNumber(a?.amount, 0) - toNumber(b?.amount, 0)) * factor
    if (sortBy === 'status') return String(a?.status || '').localeCompare(String(b?.status || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    return String(a?.ordem_data_entrada || a?.reference_date || '').localeCompare(String(b?.ordem_data_entrada || b?.reference_date || '')) * factor
  })

  const totalLinhas = items.length
  const totalComissao = items.reduce((sum: number, r: any) => sum + toNumber(r?.amount, 0), 0)

  const columns = [
    { header: 'FUNCIONÁRIO', widthRatio: 0.18 }, { header: 'OS', widthRatio: 0.06 },
    { header: 'REFERÊNCIA PAGAMENTO', widthRatio: 0.12 }, { header: 'STATUS OS', widthRatio: 0.1 },
    { header: 'ENTRADA OS', widthRatio: 0.1 }, { header: 'VALOR', widthRatio: 0.1, align: 'right' as const },
    { header: 'PAGAMENTO OS', widthRatio: 0.1 }, { header: 'STATUS COMISSÃO', widthRatio: 0.12 },
    { header: 'DATA PAGAMENTO COMISSÃO', widthRatio: 0.12 },
  ]

  const dataRows = items.map((registro: any) => [
    String(registro.funcionario_nome || 'Desconhecido'),
    String(registro.service_order_id ? `#${registro.ordem_numero || 'N/A'}` : '-'),
    formatOptionalDate(registro.reference_date),
    formatStatusLabel(registro.ordem_status),
    formatOptionalDate(registro.ordem_data_entrada || registro.reference_date),
    formatCurrency(registro.amount),
    formatStatusLabel(registro.ordem_status_pagamento),
    formatStatusLabel(registro.status),
    formatOptionalDate(registro.payment_date),
  ])

  const data = await buildReportDownloadData({
    format,
    title: 'Relatório de Comissões',
    subtitle: `Período: ${payload?.dateFrom ? formatOptionalDate(payload.dateFrom) : '-'} a ${payload?.dateTo ? formatOptionalDate(payload.dateTo) : '-'}`,
    fileNameBase: 'relatorio_comissoes',
    columns,
    dataRows,
    footerRows: [
      { label: 'Total de Linhas', value: String(totalLinhas) },
      { label: 'Total da Comissão', value: formatCurrency(totalComissao) },
    ],
  })

  return { success: true, data }
})
