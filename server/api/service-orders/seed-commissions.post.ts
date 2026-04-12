import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

/**
 * POST /api/service-orders/seed-commissions
 * Calculates and stores item-level commissions on service orders.
 * Migrated from: supabase/functions/seedServiceOrderItemCommissions
 */

function normalizeId(value: unknown) {
  const id = String(value ?? '').trim()
  return id.length > 0 ? id : null
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  const cleaned = raw.replace(/\s/g, '').replace(/R\$/gi, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function roundMoney(value: number) {
  return Number.parseFloat(Number(value || 0).toFixed(2))
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item: unknown) => normalizeId(item)).filter(Boolean) as string[]
}

function uniquePreserveOrder(ids: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) { if (!seen.has(id)) { seen.add(id); out.push(id) } }
  return out
}

function hasStoredItemCommission(item: any) {
  return item?.commission_total != null && Array.isArray(item?.commissions)
}

function getResponsaveisFromOrder(ordem: any) {
  const ids: string[] = []
  if (Array.isArray(ordem?.responsible_employees) && ordem.responsible_employees.length > 0) {
    for (const resp of ordem.responsible_employees) {
      const fId = normalizeId(resp?.employee_id)
      if (fId) ids.push(fId)
    }
  } else {
    const fId = normalizeId(ordem?.employee_responsible_id)
    if (fId) ids.push(fId)
  }
  return Array.from(new Set(ids)).map((fId) => ({ funcionarioId: fId }))
}

function computeAndEnrichItemCommissions({ itens, responsaveis, funcionariosMap, produtos, orderDiscount, orderTaxes }: any) {
  const prodCategoryMap = new Map<string, string>()
  for (const produto of produtos || []) {
    if (produto?.id && produto?.category_id) prodCategoryMap.set(String(produto.id), String(produto.category_id))
  }

  const normalizedItems = (itens || []).map((item: any, idx: number) => {
    const qty = normalizeNumber(item?.quantity) || 1
    const sale = normalizeNumber(item?.total_amount) || (normalizeNumber(item?.unit_price) * qty)
    const costUnit = normalizeNumber(item?.cost_amount)
    const cost = costUnit * qty
    const categoriaId = prodCategoryMap.get(String(item?.product_id || '')) || ''
    return { idx, sale, cost, categoriaId }
  })

  const allItemsSale = normalizedItems.reduce((acc: number, item: any) => acc + item.sale, 0)
  const employeeResults: any[] = []

  for (const resp of responsaveis || []) {
    const fId = resp.funcionarioId
    if (!fId) continue
    const funcionario = funcionariosMap.get(fId)
    if (!funcionario?.has_commission) continue

    const tipo = String(funcionario.commission_type || '')
    const base = String(funcionario.commission_base || '')
    const valorComissao = normalizeNumber(funcionario.commission_value)
    const categorias = Array.isArray(funcionario.commission_categories) ? funcionario.commission_categories.map(String) : []
    const hasCategoryFilter = categorias.length > 0

    const eligible = hasCategoryFilter ? normalizedItems.filter((item: any) => categorias.includes(item.categoriaId)) : normalizedItems
    const perItemValues = new Array(itens.length).fill(0)

    if (eligible.length === 0) {
      employeeResults.push({ funcionarioId: fId, perItemValues, tipo, base, percentual: tipo === 'percentual' ? valorComissao : 0 })
      continue
    }

    const eligibleSale = eligible.reduce((acc: number, item: any) => acc + item.sale, 0)
    const eligibleRatio = allItemsSale > 0 ? eligibleSale / allItemsSale : 0
    const eligibleDiscount = orderDiscount * eligibleRatio
    const eligibleTax = orderTaxes * eligibleRatio

    if (tipo === 'percentual') {
      for (const item of eligible) {
        const fraction = eligibleSale > 0 ? item.sale / eligibleSale : 1 / eligible.length
        let itemBase = item.sale - eligibleDiscount * fraction
        if (base === 'lucro') itemBase = Math.max(0, itemBase - (item.cost + eligibleTax * fraction))
        perItemValues[item.idx] = roundMoney((itemBase * valorComissao) / 100)
      }
    } else {
      const perItem = roundMoney(valorComissao / eligible.length)
      const diff = roundMoney(valorComissao - roundMoney(perItem * eligible.length))
      eligible.forEach((item: any, index: number) => { perItemValues[item.idx] = index === 0 ? roundMoney(perItem + diff) : perItem })
    }

    employeeResults.push({ funcionarioId: fId, perItemValues, tipo, base, percentual: tipo === 'percentual' ? valorComissao : 0 })
  }

  return (itens || []).map((item: any, idx: number) => {
    const comissoes: any[] = []
    let comissaoTotal = 0
    for (const er of employeeResults) {
      const valor = er.perItemValues[idx]
      if (valor > 0) {
        comissoes.push({ employee_id: er.funcionarioId, amount: valor, type: er.tipo, base: er.base, percentage: er.percentual })
        comissaoTotal += valor
      }
    }
    return { ...item, commission_total: roundMoney(comissaoTotal), commissions: comissoes }
  })
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const body = (await readBody(event)) || {}
  const orderIds = uniquePreserveOrder(parseStringArray(body?.orderIds))

  if (orderIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'orderIds é obrigatório (array não vazio)' })
  }

  const [ordensResult, funcionariosResult, produtosResult] = await Promise.all([
    supabase.from('service_orders').select('*').in('id', orderIds).is('deleted_at', null),
    supabase.from('employees').select('*').is('deleted_at', null),
    supabase.from('products').select('id, name, unit_cost_price, category_id').is('deleted_at', null),
  ])

  const ordens = ordensResult.data || []
  const funcionarios = funcionariosResult.data || []
  const produtos = produtosResult.data || []
  const funcionariosMap = new Map(funcionarios.map((f: any) => [String(f.id), f]))

  let scannedOrders = 0, updatedOrders = 0, skippedOrdersNoResponsaveis = 0
  let skippedOrdersNoItems = 0, skippedOrdersAlreadySeeded = 0, skippedOrdersCancelled = 0
  let seededItems = 0, notFoundOrders = 0
  const processedOrderIds = new Set<string>()
  const results: any[] = []

  for (const ordem of ordens) {
    scannedOrders += 1
    processedOrderIds.add(String(ordem.id))

    if (String(ordem?.status || '') === 'cancelled') {
      skippedOrdersCancelled += 1
      results.push({ id: String(ordem.id), numero: String(ordem?.number || '-'), status: 'cancelada', seededItems: 0 })
      continue
    }

    const responsaveis = getResponsaveisFromOrder(ordem)
    if (responsaveis.length === 0) {
      skippedOrdersNoResponsaveis += 1
      results.push({ id: String(ordem.id), numero: String(ordem?.number || '-'), status: 'sem_responsaveis', seededItems: 0 })
      continue
    }

    const itens = Array.isArray(ordem?.items) ? ordem.items : []
    if (itens.length === 0) {
      skippedOrdersNoItems += 1
      results.push({ id: String(ordem.id), numero: String(ordem?.number || '-'), status: 'sem_itens', seededItems: 0 })
      continue
    }

    const missingIndexes = itens.reduce((acc: number[], item: any, index: number) => {
      if (!hasStoredItemCommission(item)) acc.push(index)
      return acc
    }, [])

    if (missingIndexes.length === 0) {
      skippedOrdersAlreadySeeded += 1
      results.push({ id: String(ordem.id), numero: String(ordem?.number || '-'), status: 'ja_preenchida', seededItems: 0 })
      continue
    }

    const enrichedItems = computeAndEnrichItemCommissions({
      itens, responsaveis, funcionariosMap, produtos,
      orderDiscount: normalizeNumber(ordem?.discount),
      orderTaxes: normalizeNumber(ordem?.total_tax_amount),
    })

    let seededItemsInOrder = 0
    const nextItems = itens.map((item: any, index: number) => {
      if (hasStoredItemCommission(item)) return item
      seededItems += 1
      seededItemsInOrder += 1
      return {
        ...item,
        commission_total: roundMoney(enrichedItems[index]?.commission_total || 0),
        commissions: Array.isArray(enrichedItems[index]?.commissions) ? enrichedItems[index].commissions : [],
      }
    })

    const valorComissao = roundMoney(nextItems.reduce((acc: number, item: any) => acc + normalizeNumber(item?.commission_total), 0))

    await supabase.from('service_orders').update({ items: nextItems, commission_amount: valorComissao }).eq('id', ordem.id)

    updatedOrders += 1
    results.push({ id: String(ordem.id), numero: String(ordem?.number || '-'), status: 'atualizada', seededItems: seededItemsInOrder })
  }

  notFoundOrders = orderIds.filter((id) => !processedOrderIds.has(String(id))).length

  return {
    success: true,
    data: {
      scannedOrders, updatedOrders, seededItems, requestedOrders: orderIds.length,
      notFoundOrders, skippedOrdersNoResponsaveis, skippedOrdersNoItems,
      skippedOrdersAlreadySeeded, skippedOrdersCancelled, results,
      message: `Seeder concluído. ${updatedOrders} OS atualizada(s) e ${seededItems} item(ns) preenchido(s).`,
    },
  }
})
