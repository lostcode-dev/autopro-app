import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/reports/sales-items
 * Returns sales items report data with item-level or OS-level grouping.
 * Migrated from: supabase/functions/getSalesItemsReportData
 */

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

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

function roundMoney(value: number) {
  return Number.parseFloat(Number(value || 0).toFixed(2))
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const payload = (await readBody(event)) || {}

  const dateFrom = parseDateStart(payload?.dateFrom)
  const dateTo = parseDateEnd(payload?.dateTo)
  const clienteIds = Array.isArray(payload?.clienteIds) ? payload.clienteIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const ordemIds = Array.isArray(payload?.ordemIds) ? payload.ordemIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const responsavelIds = Array.isArray(payload?.responsavelIds) ? payload.responsavelIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const statusFilters = Array.isArray(payload?.statusFilters) ? payload.statusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const paymentStatusFilters = Array.isArray(payload?.paymentStatusFilters) ? payload.paymentStatusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const paymentMethodFilters = Array.isArray(payload?.paymentMethodFilters) ? payload.paymentMethodFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const categoriaIds = Array.isArray(payload?.categoriaIds) ? payload.categoriaIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const searchTerm = String(payload?.searchTerm || '').trim().toLowerCase()
  const viewMode = payload?.viewMode === 'os' ? 'os' : 'item'
  const sortBy = String(payload?.sortBy || 'data')
  const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(payload?.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(payload?.pageSize, 20))))

  const [ordensResult, clientesResult, funcionariosResult, produtosResult, categoriasResult, registrosResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('entry_date', { ascending: false }),
    supabase.from('clients').select('id, name').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('products').select('id, name, unit_cost_price, category_id').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('product_categories').select('id, name').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employee_financial_records').select('*').eq('organization_id', organizationId).eq('record_type', 'comissao').order('reference_date', { ascending: false }),
  ])

  const ordens = ordensResult.data || []
  const clientes = clientesResult.data || []
  const funcionarios = funcionariosResult.data || []
  const produtos = produtosResult.data || []
  const categorias = categoriasResult.data || []
  const registros = registrosResult.data || []

  const clientesMap = new Map(clientes.map((c: any) => [String(c.id), c]))
  const funcionariosMap = new Map(funcionarios.map((f: any) => [String(f.id), f]))
  const produtosMap = new Map(produtos.map((p: any) => [String(p.id), p]))
  const categoriasMap = new Map(categorias.map((c: any) => [String(c.id), c]))

  // Filter orders
  let ordensFiltradas = ordens.filter((o: any) => {
    if (o?.status === 'cancelled') return false
    if (statusFilters.length > 0 && !statusFilters.includes(String(o?.status || ''))) return false
    if (paymentStatusFilters.length > 0 && !paymentStatusFilters.includes(String(o?.payment_status || ''))) return false
    if (paymentMethodFilters.length > 0 && !paymentMethodFilters.includes(String(o?.payment_method || 'no_payment'))) return false
    if (clienteIds.length > 0 && !clienteIds.includes(String(o?.client_id || ''))) return false
    if (ordemIds.length > 0 && !ordemIds.includes(String(o?.id || ''))) return false
    if (dateFrom || dateTo) {
      const de = o?.entry_date ? new Date(`${o.entry_date}T00:00:00`) : null
      if (!de || Number.isNaN(de.getTime())) return false
      if (dateFrom && de < dateFrom) return false
      if (dateTo && de > dateTo) return false
    }
    return true
  })

  if (responsavelIds.length > 0) {
    ordensFiltradas = ordensFiltradas.filter((o: any) => {
      const resps = Array.isArray(o?.responsible_employees) ? o.responsible_employees : []
      const empId = o?.employee_responsible_id
      return resps.some((r: any) => responsavelIds.includes(String(r?.employee_id || ''))) || (empId && responsavelIds.includes(String(empId)))
    })
  }

  // Expand to item level
  let expandedItems: any[] = []
  for (const o of ordensFiltradas) {
    const items = Array.isArray(o?.items) ? o.items : []
    const clienteNome = clientesMap.get(String(o?.client_id || ''))?.name || 'Desconhecido'

    for (const item of items) {
      const produto = item?.product_id ? produtosMap.get(String(item.product_id)) : null
      const categoriaId = produto?.category_id || null
      const categoriaNome = categoriaId ? categoriasMap.get(String(categoriaId))?.name || '' : ''

      if (categoriaIds.length > 0 && categoriaId && !categoriaIds.includes(String(categoriaId))) continue

      const qty = toNumber(item?.quantity, 1)
      const custoUnit = toNumber(item?.cost_amount, 0) || toNumber(produto?.unit_cost_price, 0)
      const custoTotal = roundMoney(custoUnit * qty)
      const custoFonte = item?.cost_amount ? 'item' : (produto?.unit_cost_price ? 'product' : 'none')
      const valorTotal = toNumber(item?.total_amount, 0) || (toNumber(item?.unit_price, 0) * qty)

      // Commission per item
      let custoComissao = 0
      if (Array.isArray(item?.commissions)) {
        custoComissao = item.commissions.reduce((s: number, c: any) => s + toNumber(c?.amount, 0), 0)
      }

      // Resolve responsible
      let responsavel = ''
      if (Array.isArray(item?.commissions) && item.commissions.length > 0) {
        responsavel = item.commissions.map((c: any) => funcionariosMap.get(String(c?.employee_id || ''))?.name || '').filter(Boolean).join(', ')
      }
      if (!responsavel) {
        const resps = Array.isArray(o?.responsible_employees) ? o.responsible_employees : []
        responsavel = resps.map((r: any) => funcionariosMap.get(String(r?.employee_id || ''))?.name || '').filter(Boolean).join(', ')
      }

      expandedItems.push({
        id: `${o.id}_${items.indexOf(item)}`,
        ordem_id: o.id,
        cliente: clienteNome,
        ordemNumero: o?.number || '-',
        itemDescricao: item?.description || item?.name || 'Sem descrição',
        quantidade: qty,
        custoUnitario: custoUnit,
        custoTotal,
        custoComissao: roundMoney(custoComissao),
        custoComComissao: roundMoney(custoTotal + custoComissao),
        valorTotal: roundMoney(valorTotal),
        responsavel,
        status: o?.status || '',
        data: o?.entry_date || '',
        categoriaId,
        categoriaNome,
        custoFonte,
      })
    }
  }

  if (searchTerm) {
    expandedItems = expandedItems.filter((i: any) =>
      i.cliente.toLowerCase().includes(searchTerm) ||
      i.ordemNumero.toLowerCase().includes(searchTerm) ||
      i.itemDescricao.toLowerCase().includes(searchTerm) ||
      i.responsavel.toLowerCase().includes(searchTerm)
    )
  }

  // Group by OS if needed
  let tableItems: any[] = expandedItems
  if (viewMode === 'os') {
    const osMap: Record<string, any> = {}
    for (const item of expandedItems) {
      if (!osMap[item.ordem_id]) {
        osMap[item.ordem_id] = { ...item, quantidade: 0, custoTotal: 0, custoComissao: 0, custoComComissao: 0, valorTotal: 0, itemCount: 0 }
      }
      const g = osMap[item.ordem_id]
      g.quantidade += item.quantidade
      g.custoTotal += item.custoTotal
      g.custoComissao += item.custoComissao
      g.custoComComissao += item.custoComComissao
      g.valorTotal += item.valorTotal
      g.itemCount += 1
    }
    tableItems = Object.values(osMap)
  }

  // Sort
  tableItems.sort((a: any, b: any) => {
    const factor = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'cliente') return a.cliente.localeCompare(b.cliente, 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'ordem') return String(a.ordemNumero).localeCompare(String(b.ordemNumero)) * factor
    if (sortBy === 'valorTotal') return (a.valorTotal - b.valorTotal) * factor
    if (sortBy === 'custoTotal') return (a.custoTotal - b.custoTotal) * factor
    if (sortBy === 'custoComissao') return (a.custoComissao - b.custoComissao) * factor
    if (sortBy === 'responsavel') return String(a.responsavel).localeCompare(String(b.responsavel), 'pt-BR') * factor
    if (sortBy === 'status') return String(a.status).localeCompare(String(b.status)) * factor
    return String(b?.data || '').localeCompare(String(a?.data || '')) * factor * (sortOrder === 'asc' ? -1 : 1)
  })

  const summary = {
    totalValor: roundMoney(tableItems.reduce((s, i) => s + i.valorTotal, 0)),
    totalCusto: roundMoney(tableItems.reduce((s, i) => s + i.custoTotal, 0)),
    totalCustoComissao: roundMoney(tableItems.reduce((s, i) => s + i.custoComissao, 0)),
    totalItems: expandedItems.length,
    totalOrdens: ordensFiltradas.length,
  }

  const totalItems = tableItems.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedItems = tableItems.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

  return {
    organization_id: organizationId,
    data: {
      salesItemsReport: {
        filters: {
          availableClientes: clientes.map((c: any) => ({ value: c.id, label: c.name || 'Sem nome' })),
          availableOrdens: ordensFiltradas.map((o: any) => ({ value: o.id, label: `OS ${o.number || '-'}` })),
          availableResponsaveis: funcionarios.map((f: any) => ({ id: f.id, nome: f.name || '' })),
          availableStatuses: [...new Set(ordens.map((o: any) => o?.status).filter(Boolean))].map((s) => ({ value: s, label: s })),
          availableCategories: categorias.map((c: any) => ({ id: c.id, nome: c.name || '' })),
        },
        summary,
        table: {
          items: paginatedItems,
          pagination: { page: currentPage, pageSize, totalItems, totalPages },
          sort: { sortBy, sortOrder },
          viewMode,
        },
      },
    },
  }
})
