import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { buildReportDownloadData } from '../../utils/report-export'

/**
 * POST /api/reports/export-sales-items
 * Exports sales items report as PDF or CSV (item or OS view).
 * Migrated from: supabase/functions/exportSalesItemsReport
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

function normalizeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: number) {
  return Number.parseFloat(normalizeNumber(value).toFixed(2))
}

function normalizeId(value: unknown) {
  const id = String(value ?? '').trim()
  return id.length > 0 ? id : null
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return Array.from(new Set(value.map((i: unknown) => String(i || '').trim()).filter(Boolean)))
  if (typeof value === 'string') {
    const n = value.trim()
    if (!n || ['todos', 'null', 'undefined'].includes(n)) return []
    if (n.startsWith('[') && n.endsWith(']')) { try { return parseStringList(JSON.parse(n)) } catch { return [] } }
    if (n.includes(',')) return Array.from(new Set(n.split(',').map((i) => i.trim()).filter(Boolean)))
    return [n]
  }
  return []
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(normalizeNumber(value))
}

function formatDate(value: unknown) {
  if (!value) return '-'
  const date = new Date(String(value).includes('T') ? String(value) : `${String(value)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function getFuncionarioCommissionConfig(funcionario: any) {
  const categorias = Array.isArray(funcionario?.commission_categories) ? funcionario.commission_categories.map((i: any) => String(i)).filter(Boolean) : []
  return { temComissao: Boolean(funcionario?.has_commission), tipo: String(funcionario?.commission_type || ''), base: String(funcionario?.commission_base || ''), valor: normalizeNumber(funcionario?.commission_value), categorias }
}

function buildCommissionTotalsByOrderEmployeeMap(registros: any[]) {
  const totals = new Map<string, number>()
  for (const r of registros || []) {
    const ordemId = normalizeId(r?.service_order_id)
    const fId = normalizeId(r?.employee_id)
    if (!ordemId || !fId) continue
    const key = `${ordemId}::${fId}`
    totals.set(key, roundMoney(normalizeNumber(totals.get(key)) + normalizeNumber(r?.amount)))
  }
  return totals
}

function buildOrdersWithPersistedCommissionSet(registros: any[]) {
  const orderIds = new Set<string>()
  for (const r of registros || []) {
    const ordemId = normalizeId(r?.service_order_id)
    if (!ordemId || normalizeNumber(r?.amount) <= 0) continue
    orderIds.add(ordemId)
  }
  return orderIds
}

function getResponsaveis(ordem: any, funcionariosMap: Map<string, any>) {
  if (Array.isArray(ordem?.responsible_employees) && ordem.responsible_employees.length > 0) {
    const result = ordem.responsible_employees.map((item: any) => {
      const f = funcionariosMap.get(String(item?.employee_id || ''))
      return { id: f?.id || String(item?.employee_id || ''), nome: f?.name || 'Responsável não encontrado' }
    }).filter((i: any) => i.id)
    if (result.length > 0) return result
  }
  if (ordem?.employee_responsible_id) {
    const f = funcionariosMap.get(String(ordem.employee_responsible_id))
    return [{ id: f?.id || String(ordem.employee_responsible_id), nome: f?.name || 'Responsável não encontrado' }]
  }
  return []
}

function getItemResponsaveisFromComissoes(item: any, funcionariosMap: Map<string, any>) {
  const comissoes = Array.isArray(item?.commissions) ? item.commissions : []
  const unique = new Map()
  for (const c of comissoes) {
    const fId = normalizeId(c?.employee_id)
    if (!fId || unique.has(fId)) continue
    const f = funcionariosMap.get(fId)
    unique.set(fId, { id: f?.id || fId, nome: f?.name || 'Responsável não encontrado' })
  }
  return Array.from(unique.values())
}

function computeEmployeeItemCommissions({ funcionario, ordem, items }: any) {
  const result = new Map<string, number>()
  items.forEach((item: any) => result.set(item.key, 0))
  const config = getFuncionarioCommissionConfig(funcionario)
  if (!config.temComissao || items.length === 0) return result

  const hasCategoryFilter = config.categorias.length > 0
  const eligibleItems = hasCategoryFilter ? items.filter((item: any) => config.categorias.includes(String(item.categoriaId))) : items
  if (eligibleItems.length === 0) return result

  const orderDiscount = normalizeNumber(ordem?.discount)
  const orderTaxes = normalizeNumber(ordem?.total_tax_amount)
  const allItemsSale = items.reduce((acc: number, item: any) => acc + normalizeNumber(item.valorTotal), 0)
  const eligibleSale = eligibleItems.reduce((acc: number, item: any) => acc + normalizeNumber(item.valorTotal), 0)
  const eligibleRatio = allItemsSale > 0 ? eligibleSale / allItemsSale : 0
  const eligibleDiscount = orderDiscount * eligibleRatio
  const eligibleTax = orderTaxes * eligibleRatio

  if (config.tipo === 'percentual') {
    for (const item of eligibleItems) {
      const sale = normalizeNumber(item.valorTotal)
      const cost = normalizeNumber(item.custoTotal)
      const fraction = eligibleSale > 0 ? sale / eligibleSale : 1 / eligibleItems.length
      let base = sale - eligibleDiscount * fraction
      if (config.base === 'lucro') base = Math.max(0, base - (cost + eligibleTax * fraction))
      const value = roundMoney((base * config.valor) / 100)
      if (value > 0) result.set(item.key, value)
    }
  } else {
    const perItem = roundMoney(config.valor / eligibleItems.length)
    const diff = roundMoney(config.valor - roundMoney(perItem * eligibleItems.length))
    eligibleItems.forEach((item: any, index: number) => {
      const value = index === 0 ? roundMoney(perItem + diff) : perItem
      if (value > 0) result.set(item.key, value)
    })
  }
  return result
}

function computeOrderItemCommissionMap({ ordem, responsaveis, responsavelIdsSet, funcionariosMap, commissionTotalsByOrderEmployee, normalizedItems }: any) {
  const commissionByItemKey = new Map<string, number>()
  normalizedItems.forEach((item: any) => commissionByItemKey.set(item.key, 0))
  const activeIds = responsavelIdsSet.size > 0
    ? responsaveis.map((r: any) => String(r.id)).filter((id: string) => responsavelIdsSet.has(id))
    : responsaveis.map((r: any) => String(r.id))
  if (activeIds.length === 0 || normalizedItems.length === 0) return commissionByItemKey

  for (const fId of activeIds) {
    const funcionario = funcionariosMap.get(String(fId))
    const employeeKey = `${normalizeId(ordem?.id) || 'ordem'}::${String(fId)}`
    const persistedTotal = commissionTotalsByOrderEmployee.has(employeeKey) ? roundMoney(commissionTotalsByOrderEmployee.get(employeeKey)) : 0
    if (persistedTotal <= 0) continue
    const empCommissions = computeEmployeeItemCommissions({ funcionario, ordem, items: normalizedItems })
    empCommissions.forEach((value: number, key: string) => {
      if (value > 0) commissionByItemKey.set(key, roundMoney(normalizeNumber(commissionByItemKey.get(key)) + value))
    })
  }
  return commissionByItemKey
}

function buildOrderRows(rows: any[]) {
  const grouped = new Map<string, any>()
  for (const row of rows || []) {
    const groupKey = String(row?.ordemId || row?.ordemNumero || row?.id || 'sem-os')
    const current = grouped.get(groupKey)
    if (!current) {
      grouped.set(groupKey, {
        id: `os-${groupKey}`, cliente: row?.cliente || 'Cliente não encontrado',
        ordemNumero: row?.ordemNumero || '-',
        custoTotal: normalizeNumber(row?.custoTotal), custoComissao: normalizeNumber(row?.custoComissao),
        valorTotal: normalizeNumber(row?.valorTotal), itemCount: 1, data: row?.data || '',
        responsavelNames: new Set(String(row?.responsavel || '').split(',').map((i: string) => i.trim()).filter(Boolean)),
      })
      continue
    }
    current.custoTotal = roundMoney(current.custoTotal + normalizeNumber(row?.custoTotal))
    current.custoComissao = roundMoney(current.custoComissao + normalizeNumber(row?.custoComissao))
    current.valorTotal = roundMoney(current.valorTotal + normalizeNumber(row?.valorTotal))
    current.itemCount += 1
    for (const rNome of String(row?.responsavel || '').split(',')) { const n = rNome.trim(); if (n) current.responsavelNames.add(n) }
  }
  return Array.from(grouped.values()).map((row) => ({ ...row, responsavel: Array.from(row.responsavelNames).join(', ') || 'Sem responsável' }))
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const payload = (await readBody(event)) || {}

  const dateFrom = parseDateStart(payload?.dateFrom)
  const dateTo = parseDateEnd(payload?.dateTo)
  const clienteIds = new Set(parseStringList(payload?.clienteIds).concat(parseStringList(payload?.clienteId)))
  const ordemIds = new Set(parseStringList(payload?.ordemIds).concat(parseStringList(payload?.ordemId)))
  const responsavelIdsSet = new Set(parseStringList(payload?.responsavelIds).concat(parseStringList(payload?.responsavelId)))
  const statusFiltersSet = new Set(parseStringList(payload?.statusFilters).concat(parseStringList(payload?.status)))
  const paymentStatusFiltersSet = new Set(parseStringList(payload?.paymentStatusFilters))
  const categoriaIdsSet = new Set(parseStringList(payload?.categoriaIds).concat(parseStringList(payload?.categoriaId)))
  const costFilterSet = new Set(parseStringList(payload?.costFilter).filter((v) => v === 'withCost' || v === 'zeroCost'))
  const costSourceSet = new Set(parseStringList(payload?.costSource).filter((v) => v === 'item' || v === 'product' || v === 'none'))
  const formasPagamentoSet = new Set(parseStringList(payload?.formasPagamento))
  const format = payload?.format === 'pdf' ? 'pdf' : 'csv'
  const viewMode = payload?.viewMode === 'os' ? 'os' : 'item'
  const sortBy = ['cliente', 'ordemNumero', 'itemDescricao', 'valorTotal', 'custoTotal', 'custoComissao', 'responsavel', 'status', 'data', 'itemCount'].includes(payload?.sortBy) ? payload.sortBy : 'data'
  const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc'

  const [ordensResult, clientesResult, funcionariosResult, produtosResult, registrosResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('entry_date', { ascending: false }),
    supabase.from('clients').select('id, name').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('products').select('id, name, unit_cost_price, category_id').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employee_financial_records').select('*').eq('organization_id', organizationId).eq('record_type', 'comissao').order('reference_date', { ascending: false }),
  ])

  const ordens = ordensResult.data || []
  const clientes = clientesResult.data || []
  const funcionarios = funcionariosResult.data || []
  const produtos = produtosResult.data || []
  const registros = (registrosResult.data || []).filter((r: any) => normalizeNumber(r?.amount) > 0)

  const clientesMap = new Map(clientes.map((c: any) => [String(c.id), c]))
  const funcionariosMap = new Map(funcionarios.map((f: any) => [String(f.id), f]))
  const produtosMap = new Map(produtos.map((p: any) => [String(p.id), p]))
  const commissionTotalsByOrderEmployee = buildCommissionTotalsByOrderEmployeeMap(registros)
  const ordersWithPersistedCommission = buildOrdersWithPersistedCommissionSet(registros)

  const rows: any[] = []

  for (const ordem of ordens) {
    const dataOS = ordem?.entry_date ? new Date(`${ordem.entry_date}T00:00:00`) : null
    if (!dataOS || Number.isNaN(dataOS.getTime())) continue
    if (dateFrom && dataOS < dateFrom) continue
    if (dateTo && dataOS > dateTo) continue
    if (statusFiltersSet.size > 0 && !statusFiltersSet.has(String(ordem?.status || ''))) continue
    if (paymentStatusFiltersSet.size > 0 && !paymentStatusFiltersSet.has(String(ordem?.payment_status || ''))) continue
    if (formasPagamentoSet.size > 0) {
      const fp = String(ordem?.payment_method || '')
      if (!formasPagamentoSet.has(fp || 'sem_forma_pagamento')) continue
    }

    const responsaveis = getResponsaveis(ordem, funcionariosMap)
    const itens = Array.isArray(ordem?.items) ? ordem.items : []

    const storedItemResponsavelIds = new Set(itens.flatMap((item: any) => getItemResponsaveisFromComissoes(item, funcionariosMap).map((r: any) => String(r.id))))
    const effectiveOrderResponsavelIds = storedItemResponsavelIds.size > 0 ? Array.from(storedItemResponsavelIds) : responsaveis.map((r: any) => String(r.id))
    if (responsavelIdsSet.size > 0 && !effectiveOrderResponsavelIds.some((id) => responsavelIdsSet.has(id))) continue

    const clienteNome = String(clientesMap.get(String(ordem?.client_id || ''))?.name || 'Cliente não encontrado')
    const clienteFilterValue = normalizeId(ordem?.client_id) || `nome:${clienteNome.toLowerCase()}`
    const ordemNumero = String(ordem?.number || '-')
    const ordemFilterValue = normalizeId(ordem?.id) || `numero:${ordemNumero}`
    if (clienteIds.size > 0 && !clienteIds.has(clienteFilterValue!)) continue
    if (ordemIds.size > 0 && !ordemIds.has(ordemFilterValue!)) continue

    const normalizedItems = itens.map((item: any, index: number) => {
      const produto = item?.product_id ? produtosMap.get(String(item.product_id)) : null
      const itemCategoriaId = produto?.category_id ? String(produto.category_id) : 'sem_categoria'
      const quantidade = toNumber(item?.quantity, 0)
      const valorUnitario = toNumber(item?.unit_price, 0)
      const valorTotal = toNumber(item?.total_amount, quantidade * valorUnitario)
      const hasItemCost = item?.cost_amount != null && String(item.cost_amount) !== ''
      const hasProductCost = produto?.unit_cost_price != null && String(produto.unit_cost_price) !== ''
      const resolvedCostSource = hasItemCost ? 'item' : hasProductCost ? 'product' : 'none'
      const custoUnitario = hasItemCost ? toNumber(item?.cost_amount, 0) : toNumber(produto?.unit_cost_price, 0)
      const custoTotal = quantidade * custoUnitario
      const custoTotalComissaoBase = quantidade * toNumber(item?.cost_amount, 0)
      return { key: `${ordem?.id || 'ordem'}-${index}`, rawItem: item, categoriaId: itemCategoriaId, custoFonte: resolvedCostSource, custoTotal, custoTotalComissaoBase, valorTotal }
    })

    const orderId = normalizeId(ordem?.id)
    const hasPersistedCommission = orderId ? ordersWithPersistedCommission.has(orderId) : false
    const hasStoredCommissions = normalizedItems.length > 0 && normalizedItems.every((item: any) => item.rawItem?.commission_total != null && Array.isArray(item.rawItem?.commissions))

    let commissionByItemKey: Map<string, number>
    if (!hasPersistedCommission) {
      commissionByItemKey = new Map(normalizedItems.map((item: any) => [item.key, 0]))
    } else if (hasStoredCommissions) {
      commissionByItemKey = new Map()
      for (const item of normalizedItems) {
        const comissoes = item.rawItem.commissions || []
        let total = 0
        if (responsavelIdsSet.size > 0) {
          for (const c of comissoes) { if (responsavelIdsSet.has(String(c.employee_id))) total += normalizeNumber(c.amount) }
        } else {
          total = normalizeNumber(item.rawItem.commission_total)
        }
        commissionByItemKey.set(item.key, roundMoney(total))
      }
    } else {
      commissionByItemKey = computeOrderItemCommissionMap({
        ordem, responsaveis, responsavelIdsSet, funcionariosMap, commissionTotalsByOrderEmployee,
        normalizedItems: normalizedItems.map((item: any) => ({ key: item.key, categoriaId: item.categoriaId, valorTotal: item.valorTotal, custoTotal: item.custoTotalComissaoBase })),
      })
    }

    for (const item of normalizedItems) {
      const itemResps = getItemResponsaveisFromComissoes(item.rawItem, funcionariosMap)
      const itemResponsaveis = itemResps.length > 0 ? itemResps : responsaveis
      if (responsavelIdsSet.size > 0 && !itemResponsaveis.some((r: any) => responsavelIdsSet.has(String(r.id)))) continue
      if (categoriaIdsSet.size > 0 && !categoriaIdsSet.has(item.categoriaId)) continue
      if (costFilterSet.size === 1) {
        if (costFilterSet.has('withCost') && !(item.custoTotal > 0)) continue
        if (costFilterSet.has('zeroCost') && !(item.custoTotal <= 0)) continue
      }
      if (costSourceSet.size > 0 && costSourceSet.size < 3 && !costSourceSet.has(item.custoFonte)) continue
      rows.push({
        cliente: clienteNome, ordemNumero,
        itemDescricao: String(item.rawItem?.description || 'Item sem descrição'),
        custoTotal: item.custoTotal, custoComissao: normalizeNumber(commissionByItemKey.get(item.key)),
        valorTotal: item.valorTotal,
        responsavel: itemResponsaveis.length > 0 ? itemResponsaveis.map((r: any) => r.nome).join(', ') : 'Sem responsável',
        responsavelIds: itemResponsaveis.map((r: any) => String(r.id)),
        ordemId: ordemFilterValue, data: String(ordem?.entry_date || ''),
      })
    }
  }

  const tableRows = viewMode === 'os' ? buildOrderRows(rows) : rows
  tableRows.sort((a: any, b: any) => {
    const factor = sortOrder === 'asc' ? 1 : -1
    if (['valorTotal', 'custoTotal', 'custoComissao', 'itemCount'].includes(sortBy)) return (normalizeNumber(a?.[sortBy]) - normalizeNumber(b?.[sortBy])) * factor
    if (sortBy === 'data') return String(a.data).localeCompare(String(b.data), 'pt-BR', { sensitivity: 'base' }) * factor
    return String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''), 'pt-BR', { sensitivity: 'base' }) * factor
  })

  const totalLinhas = tableRows.length
  const totalComissao = tableRows.reduce((sum: number, row: any) => sum + normalizeNumber(row?.custoComissao), 0)

  const columns = viewMode === 'os'
    ? [
        { header: 'CLIENTE', widthRatio: 0.22 }, { header: 'OS', widthRatio: 0.08 }, { header: 'QTD. ITENS', widthRatio: 0.09 },
        { header: 'RESPONSÁVEL', widthRatio: 0.26 }, { header: 'CUSTO', widthRatio: 0.11, align: 'right' as const },
        { header: 'CUSTO COMISSÃO', widthRatio: 0.11, align: 'right' as const }, { header: 'VALOR', widthRatio: 0.13, align: 'right' as const },
      ]
    : [
        { header: 'CLIENTE', widthRatio: 0.18 }, { header: 'OS', widthRatio: 0.07 }, { header: 'ITEM SEPARADO', widthRatio: 0.28 },
        { header: 'RESPONSÁVEL', widthRatio: 0.16 }, { header: 'CUSTO', widthRatio: 0.1, align: 'right' as const },
        { header: 'CUSTO COMISSÃO', widthRatio: 0.1, align: 'right' as const }, { header: 'VALOR', widthRatio: 0.11, align: 'right' as const },
      ]

  const dataRows = tableRows.map((row: any) => (
    viewMode === 'os'
      ? [row?.cliente || '', row?.ordemNumero || '', String(row?.itemCount || 0), row?.responsavel || '', formatCurrency(row?.custoTotal || 0), formatCurrency(row?.custoComissao || 0), formatCurrency(row?.valorTotal || 0)]
      : [row?.cliente || '', row?.ordemNumero || '', row?.itemDescricao || '', row?.responsavel || '', formatCurrency(row?.custoTotal || 0), formatCurrency(row?.custoComissao || 0), formatCurrency(row?.valorTotal || 0)]
  ))

  const data = await buildReportDownloadData({
    format,
    title: viewMode === 'os' ? 'Relatório por Ordem de Serviço' : 'Relatório de Itens Vendidos',
    subtitle: `Período: ${payload?.dateFrom ? formatDate(payload.dateFrom) : '-'} a ${payload?.dateTo ? formatDate(payload.dateTo) : '-'}`,
    fileNameBase: viewMode === 'os' ? 'relatorio_vendas_por_os' : 'relatorio_itens_vendidos',
    columns,
    dataRows,
    footerRows: [
      { label: 'Total de Linhas', value: String(totalLinhas) },
      { label: 'Total da Comissão', value: formatCurrency(totalComissao) },
    ],
  })

  return { success: true, data }
})
