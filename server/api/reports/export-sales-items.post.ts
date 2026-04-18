import { defineEventHandler, readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { buildReportDownloadData } from '../../utils/report-export'
import { parseDateStart, parseDateEnd, toNumber, roundMoney, formatCurrency, formatOptionalDate, normalizeReportStatus } from '../../utils/report-helpers'

function normalizeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeId(value: unknown) {
  const id = String(value ?? '').trim()
  return id.length > 0 ? id : null
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return Array.from(new Set(value.map((i: unknown) => String(i || '').trim()).filter(Boolean)))
  if (typeof value === 'string') {
    const n = value.trim()
    if (!n || ['all', 'todos', 'null', 'undefined'].includes(n)) return []
    if (n.startsWith('[') && n.endsWith(']')) { try { return parseStringList(JSON.parse(n)) } catch { return [] } }
    if (n.includes(',')) return Array.from(new Set(n.split(',').map(i => i.trim()).filter(Boolean)))
    return [n]
  }
  return []
}

function getEmployeeCommissionConfig(employee: any) {
  const categories = Array.isArray(employee?.commission_categories) ? employee.commission_categories.map((i: any) => String(i)).filter(Boolean) : []
  return { hasCommission: Boolean(employee?.has_commission), type: String(employee?.commission_type || ''), base: String(employee?.commission_base || ''), value: normalizeNumber(employee?.commission_value), categories }
}

function buildCommissionTotalsByOrderEmployeeMap(records: any[]) {
  const totals = new Map<string, number>()
  for (const r of records || []) {
    const orderId = normalizeId(r?.service_order_id)
    const empId = normalizeId(r?.employee_id)
    if (!orderId || !empId) continue
    const key = `${orderId}::${empId}`
    totals.set(key, roundMoney(normalizeNumber(totals.get(key)) + normalizeNumber(r?.amount)))
  }
  return totals
}

function buildOrdersWithPersistedCommissionSet(records: any[]) {
  const orderIds = new Set<string>()
  for (const r of records || []) {
    const orderId = normalizeId(r?.service_order_id)
    if (!orderId || normalizeNumber(r?.amount) <= 0) continue
    orderIds.add(orderId)
  }
  return orderIds
}

function getResponsibles(order: any, employeesMap: Map<string, any>) {
  if (Array.isArray(order?.responsible_employees) && order.responsible_employees.length > 0) {
    const result = order.responsible_employees.map((item: any) => {
      const e = employeesMap.get(String(item?.employee_id || ''))
      return { id: e?.id || String(item?.employee_id || ''), name: e?.name || 'Unknown responsible' }
    }).filter((i: any) => i.id)
    if (result.length > 0) return result
  }
  if (order?.employee_responsible_id) {
    const e = employeesMap.get(String(order.employee_responsible_id))
    return [{ id: e?.id || String(order.employee_responsible_id), name: e?.name || 'Unknown responsible' }]
  }
  return []
}

function getItemResponsiblesFromCommissions(item: any, employeesMap: Map<string, any>) {
  const commissions = Array.isArray(item?.commissions) ? item.commissions : []
  const unique = new Map()
  for (const c of commissions) {
    const empId = normalizeId(c?.employee_id)
    if (!empId || unique.has(empId)) continue
    const e = employeesMap.get(empId)
    unique.set(empId, { id: e?.id || empId, name: e?.name || 'Unknown responsible' })
  }
  return Array.from(unique.values())
}

function computeEmployeeItemCommissions({ employee, order, items }: any) {
  const result = new Map<string, number>()
  items.forEach((item: any) => result.set(item.key, 0))
  const config = getEmployeeCommissionConfig(employee)
  if (!config.hasCommission || items.length === 0) return result

  const hasCategoryFilter = config.categories.length > 0
  const eligibleItems = hasCategoryFilter ? items.filter((item: any) => config.categories.includes(String(item.categoryId))) : items
  if (eligibleItems.length === 0) return result

  const orderDiscount = normalizeNumber(order?.discount)
  const orderTaxes = normalizeNumber(order?.total_tax_amount)
  const allItemsSale = items.reduce((acc: number, item: any) => acc + normalizeNumber(item.totalValue), 0)
  const eligibleSale = eligibleItems.reduce((acc: number, item: any) => acc + normalizeNumber(item.totalValue), 0)
  const eligibleRatio = allItemsSale > 0 ? eligibleSale / allItemsSale : 0
  const eligibleDiscount = orderDiscount * eligibleRatio
  const eligibleTax = orderTaxes * eligibleRatio

  if (config.type === 'percentual') {
    for (const item of eligibleItems) {
      const sale = normalizeNumber(item.totalValue)
      const cost = normalizeNumber(item.totalCost)
      const fraction = eligibleSale > 0 ? sale / eligibleSale : 1 / eligibleItems.length
      let base = sale - eligibleDiscount * fraction
      if (config.base === 'lucro') base = Math.max(0, base - (cost + eligibleTax * fraction))
      const value = roundMoney((base * config.value) / 100)
      if (value > 0) result.set(item.key, value)
    }
  } else {
    const perItem = roundMoney(config.value / eligibleItems.length)
    const diff = roundMoney(config.value - roundMoney(perItem * eligibleItems.length))
    eligibleItems.forEach((item: any, index: number) => {
      const value = index === 0 ? roundMoney(perItem + diff) : perItem
      if (value > 0) result.set(item.key, value)
    })
  }
  return result
}

function computeOrderItemCommissionMap({ order, responsibles, responsibleIdsSet, employeesMap, commissionTotalsByOrderEmployee, normalizedItems }: any) {
  const commissionByItemKey = new Map<string, number>()
  normalizedItems.forEach((item: any) => commissionByItemKey.set(item.key, 0))
  const activeIds = responsibleIdsSet.size > 0
    ? responsibles.map((r: any) => String(r.id)).filter((id: string) => responsibleIdsSet.has(id))
    : responsibles.map((r: any) => String(r.id))
  if (activeIds.length === 0 || normalizedItems.length === 0) return commissionByItemKey

  for (const empId of activeIds) {
    const employee = employeesMap.get(String(empId))
    const employeeKey = `${normalizeId(order?.id) || 'order'}::${String(empId)}`
    const persistedTotal = commissionTotalsByOrderEmployee.has(employeeKey) ? roundMoney(commissionTotalsByOrderEmployee.get(employeeKey)) : 0
    if (persistedTotal <= 0) continue
    const empCommissions = computeEmployeeItemCommissions({ employee, order, items: normalizedItems })
    empCommissions.forEach((value: number, key: string) => {
      if (value > 0) commissionByItemKey.set(key, roundMoney(normalizeNumber(commissionByItemKey.get(key)) + value))
    })
  }
  return commissionByItemKey
}

function buildOrderRows(rows: any[]) {
  const grouped = new Map<string, any>()
  for (const row of rows || []) {
    const groupKey = String(row?.orderId || row?.orderNumber || row?.id || 'no-order')
    const current = grouped.get(groupKey)
    if (!current) {
      grouped.set(groupKey, {
        id: `os-${groupKey}`, client: row?.client || 'Unknown client',
        orderNumber: row?.orderNumber || '-',
        totalCost: normalizeNumber(row?.totalCost), commissionCost: normalizeNumber(row?.commissionCost),
        totalValue: normalizeNumber(row?.totalValue), itemCount: 1, date: row?.date || '',
        responsibleNames: new Set(String(row?.responsible || '').split(',').map((i: string) => i.trim()).filter(Boolean))
      })
      continue
    }
    current.totalCost = roundMoney(current.totalCost + normalizeNumber(row?.totalCost))
    current.commissionCost = roundMoney(current.commissionCost + normalizeNumber(row?.commissionCost))
    current.totalValue = roundMoney(current.totalValue + normalizeNumber(row?.totalValue))
    current.itemCount += 1
    for (const rName of String(row?.responsible || '').split(',')) { const n = rName.trim(); if (n) current.responsibleNames.add(n) }
  }
  return Array.from(grouped.values()).map(row => ({ ...row, responsible: Array.from(row.responsibleNames).join(', ') || 'No responsible' }))
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = (await readBody(event)) || {}

  const dateFrom = parseDateStart(body?.dateFrom)
  const dateTo = parseDateEnd(body?.dateTo)
  const clientIds = new Set(parseStringList(body?.clientIds).concat(parseStringList(body?.clientId)))
  const orderIds = new Set(parseStringList(body?.orderIds).concat(parseStringList(body?.orderId)))
  const responsibleIdsSet = new Set(parseStringList(body?.responsibleIds).concat(parseStringList(body?.responsibleId)))
  const statusFiltersSet = new Set(parseStringList(body?.statusFilters).concat(parseStringList(body?.status)))
  const paymentStatusFiltersSet = new Set(parseStringList(body?.paymentStatusFilters))
  const categoryIdsSet = new Set(parseStringList(body?.categoryIds).concat(parseStringList(body?.categoryId)))
  const costFilterSet = new Set(parseStringList(body?.costFilter).filter(v => v === 'withCost' || v === 'zeroCost'))
  const costSourceSet = new Set(parseStringList(body?.costSource).filter(v => v === 'item' || v === 'product' || v === 'none'))
  const paymentMethodsSet = new Set(parseStringList(body?.paymentMethods))
  const format = body?.format === 'pdf' ? 'pdf' : 'csv'
  const viewMode = body?.viewMode === 'os' ? 'os' : 'item'
  const sortBy = ['client', 'orderNumber', 'itemDescription', 'totalValue', 'totalCost', 'commissionCost', 'responsible', 'status', 'date', 'itemCount'].includes(body?.sortBy) ? body.sortBy : 'date'
  const sortOrder: 'asc' | 'desc' = body?.sortOrder === 'asc' ? 'asc' : 'desc'

  const [ordersResult, clientsResult, employeesResult, productsResult, commissionRecordsResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('entry_date', { ascending: false }),
    supabase.from('clients').select('id, name').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('products').select('id, name, unit_cost_price, category_id').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employee_financial_records').select('*').eq('organization_id', organizationId).eq('record_type', 'comissao').order('reference_date', { ascending: false })
  ])

  const orders = ordersResult.data || []
  const clients = clientsResult.data || []
  const employees = employeesResult.data || []
  const products = productsResult.data || []
  const commissionRecords = (commissionRecordsResult.data || []).filter((r: any) => normalizeNumber(r?.amount) > 0)

  const clientsMap = new Map(clients.map((c: any) => [String(c.id), c]))
  const employeesMap = new Map(employees.map((e: any) => [String(e.id), e]))
  const productsMap = new Map(products.map((p: any) => [String(p.id), p]))
  const commissionTotalsByOrderEmployee = buildCommissionTotalsByOrderEmployeeMap(commissionRecords)
  const ordersWithPersistedCommission = buildOrdersWithPersistedCommissionSet(commissionRecords)

  const rows: any[] = []

  for (const order of orders) {
    const orderEntryDate = order?.entry_date ? new Date(`${order.entry_date}T00:00:00`) : null
    if (!orderEntryDate || Number.isNaN(orderEntryDate.getTime())) continue
    if (dateFrom && orderEntryDate < dateFrom) continue
    if (dateTo && orderEntryDate > dateTo) continue
    if (statusFiltersSet.size > 0 && !statusFiltersSet.has(String(order?.status || ''))) continue
    if (paymentStatusFiltersSet.size > 0 && !paymentStatusFiltersSet.has(normalizeReportStatus(order?.payment_status))) continue
    if (paymentMethodsSet.size > 0) {
      const pm = String(order?.payment_method || 'no_payment')
      if (!paymentMethodsSet.has(pm)) continue
    }

    const responsibles = getResponsibles(order, employeesMap)
    const items = Array.isArray(order?.items) ? order.items : []

    const storedItemResponsibleIds = new Set(items.flatMap((item: any) => getItemResponsiblesFromCommissions(item, employeesMap).map((r: any) => String(r.id))))
    const effectiveOrderResponsibleIds = storedItemResponsibleIds.size > 0 ? Array.from(storedItemResponsibleIds) : responsibles.map((r: any) => String(r.id))
    if (responsibleIdsSet.size > 0 && !effectiveOrderResponsibleIds.some((id: string) => responsibleIdsSet.has(id))) continue

    const clientName = String(clientsMap.get(String(order?.client_id || ''))?.name || 'Unknown client')
    const clientFilterValue = normalizeId(order?.client_id) || `name:${clientName.toLowerCase()}`
    const orderNumber = String(order?.number || '-')
    const orderFilterValue = normalizeId(order?.id) || `number:${orderNumber}`
    if (clientIds.size > 0 && !clientIds.has(clientFilterValue!)) continue
    if (orderIds.size > 0 && !orderIds.has(orderFilterValue!)) continue

    const normalizedItems = items.map((item: any, index: number) => {
      const product = item?.product_id ? productsMap.get(String(item.product_id)) : null
      const itemCategoryId = product?.category_id ? String(product.category_id) : 'no_category'
      const quantity = toNumber(item?.quantity, 0)
      const unitPrice = toNumber(item?.unit_price, 0)
      const totalValue = toNumber(item?.total_amount, quantity * unitPrice)
      const hasItemCost = item?.cost_amount != null && String(item.cost_amount) !== ''
      const hasProductCost = product?.unit_cost_price != null && String(product.unit_cost_price) !== ''
      const resolvedCostSource = hasItemCost ? 'item' : hasProductCost ? 'product' : 'none'
      const unitCost = hasItemCost ? toNumber(item?.cost_amount, 0) : toNumber(product?.unit_cost_price, 0)
      const totalCost = quantity * unitCost
      const totalCostForCommission = quantity * toNumber(item?.cost_amount, 0)
      return { key: `${order?.id || 'order'}-${index}`, rawItem: item, categoryId: itemCategoryId, costSource: resolvedCostSource, totalCost, totalCostForCommission, totalValue }
    })

    const orderId = normalizeId(order?.id)
    const hasPersistedCommission = orderId ? ordersWithPersistedCommission.has(orderId) : false
    const hasStoredCommissions = normalizedItems.length > 0 && normalizedItems.every((item: any) => item.rawItem?.commission_total != null && Array.isArray(item.rawItem?.commissions))

    let commissionByItemKey: Map<string, number>
    if (!hasPersistedCommission) {
      commissionByItemKey = new Map(normalizedItems.map((item: any) => [item.key, 0]))
    } else if (hasStoredCommissions) {
      commissionByItemKey = new Map()
      for (const item of normalizedItems) {
        const commissions = item.rawItem.commissions || []
        let total = 0
        if (responsibleIdsSet.size > 0) {
          for (const c of commissions) { if (responsibleIdsSet.has(String(c.employee_id))) total += normalizeNumber(c.amount) }
        } else {
          total = normalizeNumber(item.rawItem.commission_total)
        }
        commissionByItemKey.set(item.key, roundMoney(total))
      }
    } else {
      commissionByItemKey = computeOrderItemCommissionMap({
        order, responsibles, responsibleIdsSet, employeesMap, commissionTotalsByOrderEmployee,
        normalizedItems: normalizedItems.map((item: any) => ({ key: item.key, categoryId: item.categoryId, totalValue: item.totalValue, totalCost: item.totalCostForCommission }))
      })
    }

    for (const item of normalizedItems) {
      const itemRespFromCommissions = getItemResponsiblesFromCommissions(item.rawItem, employeesMap)
      const itemResponsibles = itemRespFromCommissions.length > 0 ? itemRespFromCommissions : responsibles
      if (responsibleIdsSet.size > 0 && !itemResponsibles.some((r: any) => responsibleIdsSet.has(String(r.id)))) continue
      if (categoryIdsSet.size > 0 && !categoryIdsSet.has(item.categoryId)) continue
      if (costFilterSet.size === 1) {
        if (costFilterSet.has('withCost') && !(item.totalCost > 0)) continue
        if (costFilterSet.has('zeroCost') && !(item.totalCost <= 0)) continue
      }
      if (costSourceSet.size > 0 && costSourceSet.size < 3 && !costSourceSet.has(item.costSource)) continue
      rows.push({
        client: clientName, orderNumber,
        itemDescription: String(item.rawItem?.description || 'No description'),
        totalCost: item.totalCost, commissionCost: normalizeNumber(commissionByItemKey.get(item.key)),
        totalValue: item.totalValue,
        responsible: itemResponsibles.length > 0 ? itemResponsibles.map((r: any) => r.name).join(', ') : 'No responsible',
        responsibleIds: itemResponsibles.map((r: any) => String(r.id)),
        orderId: orderFilterValue, date: String(order?.entry_date || '')
      })
    }
  }

  const tableRows = viewMode === 'os' ? buildOrderRows(rows) : rows
  tableRows.sort((a: any, b: any) => {
    const factor = sortOrder === 'asc' ? 1 : -1
    if (['totalValue', 'totalCost', 'commissionCost', 'itemCount'].includes(sortBy)) return (normalizeNumber(a?.[sortBy]) - normalizeNumber(b?.[sortBy])) * factor
    if (sortBy === 'date') return String(a.date).localeCompare(String(b.date), 'pt-BR', { sensitivity: 'base' }) * factor
    return String(a[sortBy] || '').localeCompare(String(b[sortBy] || ''), 'pt-BR', { sensitivity: 'base' }) * factor
  })

  const totalRows = tableRows.length
  const totalCommission = tableRows.reduce((sum: number, row: any) => sum + normalizeNumber(row?.commissionCost), 0)

  const columns = viewMode === 'os'
    ? [
        { header: 'CLIENTE', widthRatio: 0.22 }, { header: 'OS', widthRatio: 0.08 }, { header: 'QTD. ITENS', widthRatio: 0.09 },
        { header: 'RESPONSÁVEL', widthRatio: 0.26 }, { header: 'CUSTO', widthRatio: 0.11, align: 'right' as const },
        { header: 'CUSTO COMISSÃO', widthRatio: 0.11, align: 'right' as const }, { header: 'VALOR', widthRatio: 0.13, align: 'right' as const }
      ]
    : [
        { header: 'CLIENTE', widthRatio: 0.18 }, { header: 'OS', widthRatio: 0.07 }, { header: 'ITEM SEPARADO', widthRatio: 0.28 },
        { header: 'RESPONSÁVEL', widthRatio: 0.16 }, { header: 'CUSTO', widthRatio: 0.1, align: 'right' as const },
        { header: 'CUSTO COMISSÃO', widthRatio: 0.1, align: 'right' as const }, { header: 'VALOR', widthRatio: 0.11, align: 'right' as const }
      ]

  const dataRows = tableRows.map((row: any) => (
    viewMode === 'os'
      ? [row?.client || '', row?.orderNumber || '', String(row?.itemCount || 0), row?.responsible || '', formatCurrency(row?.totalCost || 0), formatCurrency(row?.commissionCost || 0), formatCurrency(row?.totalValue || 0)]
      : [row?.client || '', row?.orderNumber || '', row?.itemDescription || '', row?.responsible || '', formatCurrency(row?.totalCost || 0), formatCurrency(row?.commissionCost || 0), formatCurrency(row?.totalValue || 0)]
  ))

  const data = await buildReportDownloadData({
    format,
    title: viewMode === 'os' ? 'Relatório por Ordem de Serviço' : 'Relatório de Itens Vendidos',
    subtitle: `Período: ${body?.dateFrom ? formatOptionalDate(body.dateFrom) : '-'} a ${body?.dateTo ? formatOptionalDate(body.dateTo) : '-'}`,
    fileNameBase: viewMode === 'os' ? 'relatorio_vendas_por_os' : 'relatorio_itens_vendidos',
    columns,
    rows: dataRows,
    footerRows: [
      { label: 'Total de Linhas', value: String(totalRows) },
      { label: 'Total da Comissão', value: formatCurrency(totalCommission) }
    ]
  })

  return { success: true, data }
})
