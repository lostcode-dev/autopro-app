import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/reports/debtors
 * Returns debtors report: clients with pending OS/installments.
 * Migrated from: supabase/functions/getDebtorsReportData
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

  const sortBy = ['nome_cliente', 'total_devido', 'dias_atraso', 'menor_vencimento', 'status'].includes(payload?.sortBy) ? payload.sortBy : 'nome_cliente'
  const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(payload?.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(payload?.pageSize, 10))))
  const searchTerm = String(payload?.searchTerm || '').trim().toLowerCase()
  const statusFilters = Array.isArray(payload?.statusFilters) ? payload.statusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const paymentMethodFilters = Array.isArray(payload?.paymentMethodFilters) ? payload.paymentMethodFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const clienteIds = Array.isArray(payload?.clienteIds) ? payload.clienteIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const dateFrom = parseDateStart(payload?.dateFrom)
  const dateTo = parseDateEnd(payload?.dateTo)

  const [ordensResult, parcelasResult, clientesResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('service_order_installments').select('*').eq('organization_id', organizationId),
    supabase.from('clients').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const ordens = ordensResult.data || []
  const parcelas = parcelasResult.data || []
  const clientes = clientesResult.data || []
  const clientesMap = new Map<string, any>(clientes.map((c: any) => [String(c.id), c]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build debtor items from unpaid OS and unpaid installments
  const devedoresMap: Record<string, { cliente_id: string; total_devido: number; itens_pendentes: any[]; dias_atraso: number; menor_vencimento: string | null }> = {}

  // From service orders (non-installment, non-paid)
  for (const ordem of ordens) {
    if (ordem?.status === 'cancelled' || ordem?.status === 'estimate') continue
    if (ordem?.payment_status !== 'pending' && ordem?.payment_status !== 'partial') continue
    if (ordem?.is_installment) continue

    const cid = String(ordem?.client_id || '')
    if (!cid) continue

    const vencimento = ordem?.expected_payment_date || ordem?.entry_date || null
    const vencimentoDate = vencimento ? new Date(`${vencimento}T00:00:00`) : null
    const diasAtraso = vencimentoDate && !Number.isNaN(vencimentoDate.getTime()) ? Math.max(0, Math.floor((today.getTime() - vencimentoDate.getTime()) / (1000 * 60 * 60 * 24))) : 0

    if (!devedoresMap[cid]) devedoresMap[cid] = { cliente_id: cid, total_devido: 0, itens_pendentes: [], dias_atraso: 0, menor_vencimento: null }
    const dev = devedoresMap[cid]
    const valor = toNumber(ordem?.total_amount, 0)
    dev.total_devido += valor
    if (diasAtraso > dev.dias_atraso) dev.dias_atraso = diasAtraso
    if (vencimento && (!dev.menor_vencimento || vencimento < dev.menor_vencimento)) dev.menor_vencimento = vencimento

    dev.itens_pendentes.push({
      tipo: 'OS', id: ordem.id, numero: ordem?.number || '-', valor,
      vencimento, forma_pagamento: ordem?.payment_method || null,
      ordem_status: ordem?.status || null, dias_atraso: diasAtraso,
      status: diasAtraso > 0 ? 'em_atraso' : 'em_dia',
    })
  }

  // From installments
  for (const parcela of parcelas) {
    if (parcela?.status !== 'pendente' && parcela?.status !== 'atrasado') continue

    const ordem = ordens.find((o: any) => String(o?.id) === String(parcela?.service_order_id))
    if (!ordem) continue
    const cid = String(ordem?.client_id || '')
    if (!cid) continue

    const vencimento = parcela?.due_date || null
    const vencimentoDate = vencimento ? new Date(`${vencimento}T00:00:00`) : null
    const diasAtraso = vencimentoDate && !Number.isNaN(vencimentoDate.getTime()) ? Math.max(0, Math.floor((today.getTime() - vencimentoDate.getTime()) / (1000 * 60 * 60 * 24))) : 0

    if (!devedoresMap[cid]) devedoresMap[cid] = { cliente_id: cid, total_devido: 0, itens_pendentes: [], dias_atraso: 0, menor_vencimento: null }
    const dev = devedoresMap[cid]
    const valor = toNumber(parcela?.amount, 0)
    dev.total_devido += valor
    if (diasAtraso > dev.dias_atraso) dev.dias_atraso = diasAtraso
    if (vencimento && (!dev.menor_vencimento || vencimento < dev.menor_vencimento)) dev.menor_vencimento = vencimento

    dev.itens_pendentes.push({
      tipo: 'Parcela', id: parcela.id, numero: `${ordem?.number || '-'} P${parcela?.installment_number || '?'}`,
      valor, vencimento, forma_pagamento: parcela?.payment_method || null,
      ordem_status: ordem?.status || null, dias_atraso: diasAtraso,
      status: diasAtraso > 0 ? 'em_atraso' : 'em_dia',
    })
  }

  let devedores = Object.values(devedoresMap).map((dev) => {
    const cliente = clientesMap.get(dev.cliente_id)
    return {
      ...dev,
      cliente,
      nome_cliente: cliente?.name || 'Desconhecido',
      telefone: cliente?.phone || null,
      email: cliente?.email || null,
      status: dev.dias_atraso > 0 ? 'em_atraso' : 'em_dia',
    }
  })

  // Apply filters
  if (clienteIds.length > 0) devedores = devedores.filter((d) => clienteIds.includes(d.cliente_id))
  if (statusFilters.length > 0) devedores = devedores.filter((d) => statusFilters.includes(d.status))
  if (paymentMethodFilters.length > 0) {
    devedores = devedores.filter((d) => d.itens_pendentes.some((i: any) => paymentMethodFilters.includes(String(i.forma_pagamento || 'no_payment'))))
  }
  if (dateFrom || dateTo) {
    devedores = devedores.filter((d) => d.itens_pendentes.some((i: any) => {
      const v = i.vencimento ? new Date(`${i.vencimento}T00:00:00`) : null
      if (!v || Number.isNaN(v.getTime())) return false
      if (dateFrom && v < dateFrom) return false
      if (dateTo && v > dateTo) return false
      return true
    }))
  }
  if (searchTerm) {
    devedores = devedores.filter((d) =>
      d.nome_cliente.toLowerCase().includes(searchTerm) ||
      (d.telefone && d.telefone.toLowerCase().includes(searchTerm)) ||
      (d.email && d.email.toLowerCase().includes(searchTerm))
    )
  }

  // Sort
  devedores.sort((a, b) => {
    const factor = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'total_devido') return (a.total_devido - b.total_devido) * factor
    if (sortBy === 'dias_atraso') return (a.dias_atraso - b.dias_atraso) * factor
    if (sortBy === 'menor_vencimento') return String(a.menor_vencimento || '').localeCompare(String(b.menor_vencimento || '')) * factor
    if (sortBy === 'status') return String(a.status).localeCompare(String(b.status)) * factor
    return a.nome_cliente.localeCompare(b.nome_cliente, 'pt-BR', { sensitivity: 'base' }) * factor
  })

  const totals = {
    total: devedores.reduce((s, d) => s + d.total_devido, 0),
    emAtraso: devedores.filter((d) => d.status === 'em_atraso').reduce((s, d) => s + d.total_devido, 0),
    emDia: devedores.filter((d) => d.status === 'em_dia').reduce((s, d) => s + d.total_devido, 0),
  }

  const availableClientes = clientes.map((c: any) => ({ value: c.id, label: c.name || 'Sem nome' })).sort((a: any, b: any) => a.label.localeCompare(b.label, 'pt-BR'))

  const totalItems = devedores.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedItems = devedores.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

  return {
    organization_id: organizationId,
    data: {
      debtorsReport: {
        filters: { availableClientes },
        items: paginatedItems,
        totals,
        pagination: { page: currentPage, pageSize, totalItems, totalPages },
        sort: { sortBy, sortOrder },
      },
    },
  }
})
