import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/reports/costs-profit
 * Returns costs/profit report data with optional comparison periods, category breakdown.
 * Migrated from: supabase/functions/getCostsProfitReportData
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

function normalizeCategoryName(category: string) {
  return String(category || 'outros').replace(/_/g, ' ').toUpperCase()
}

function normalizeStatusFilters(value: unknown) {
  const allowed = new Set(['pago', 'pendente'])
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item || '').toLowerCase()).filter((item) => allowed.has(item))))
  }
  const normalized = String(value || 'todos').toLowerCase()
  if (!normalized || normalized === 'todos') return []
  return Array.from(new Set(normalized.split(',').map((item) => item.trim()).filter((item) => allowed.has(item))))
}

function normalizeBinaryStatus(value: unknown) {
  return String(value || '').toLowerCase() === 'pago' ? 'pago' : 'pendente'
}

function matchesBinaryStatusFilters(value: unknown, statusFilters: string[]) {
  if (!Array.isArray(statusFilters) || statusFilters.length === 0) return true
  return statusFilters.includes(normalizeBinaryStatus(value))
}

function startOfDay(date: Date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d }
function endOfDay(date: Date) { const d = new Date(date); d.setHours(23, 59, 59, 999); return d }

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

function formatDatePtBR(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatPeriodLabel(startDate: Date, endDate: Date) {
  return `${formatDatePtBR(startDate)} a ${formatDatePtBR(endDate)}`
}

function getComparisonModeLabel(mode: string) {
  if (mode === 'same_period_last_year') return 'Mesmo período do ano anterior'
  if (mode === 'previous_month') return 'Mês anterior'
  if (mode === 'previous_quarter') return 'Trimestre anterior'
  return 'Período anterior equivalente'
}

function getQuarter(date: Date) { return Math.floor(date.getMonth() / 3) + 1 }
function getQuarterStart(year: number, quarter: number) { return new Date(year, (quarter - 1) * 3, 1, 0, 0, 0, 0) }
function getQuarterEnd(year: number, quarter: number) { return new Date(year, (quarter - 1) * 3 + 3, 0, 23, 59, 59, 999) }

function getPreviousRangeByMode(startDate: Date, endDate: Date, compareMode: string) {
  if (compareMode === 'same_period_last_year') {
    const ps = new Date(startDate); ps.setFullYear(ps.getFullYear() - 1)
    const pe = new Date(endDate); pe.setFullYear(pe.getFullYear() - 1)
    return { previousStartDate: startOfDay(ps), previousEndDate: endOfDay(pe) }
  }
  if (compareMode === 'previous_month') {
    const ref = startOfDay(startDate)
    return { previousStartDate: new Date(ref.getFullYear(), ref.getMonth() - 1, 1, 0, 0, 0, 0), previousEndDate: new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999) }
  }
  if (compareMode === 'previous_quarter') {
    const cq = getQuarter(startDate), cy = startDate.getFullYear()
    const pq = cq === 1 ? 4 : cq - 1, py = cq === 1 ? cy - 1 : cy
    return { previousStartDate: getQuarterStart(py, pq), previousEndDate: getQuarterEnd(py, pq) }
  }
  const dayMs = 1000 * 60 * 60 * 24
  const periodDays = Math.floor((endDate.getTime() - startDate.getTime()) / dayMs) + 1
  const pe = new Date(startDate); pe.setDate(pe.getDate() - 1)
  const ps = new Date(pe); ps.setDate(ps.getDate() - (periodDays - 1))
  return { previousStartDate: startOfDay(ps), previousEndDate: endOfDay(pe) }
}

function calculateVariation(currentValue: number, previousValue: number) {
  if (previousValue === 0 && currentValue === 0) return { variation: 0, type: 'equal' }
  if (previousValue === 0) return { variation: currentValue > 0 ? Infinity : -Infinity, type: currentValue > 0 ? 'increase' : 'decrease' }
  const variation = ((currentValue - previousValue) / Math.abs(previousValue)) * 100
  return { variation: Math.abs(variation), type: variation > 0 ? 'increase' : variation < 0 ? 'decrease' : 'equal' }
}

function calculatePeriodData(ordens: any[], lancamentos: any[], start: Date, end: Date, statusFilters: string[]) {
  const periodOrders = ordens.filter((o: any) => {
    const ed = o?.entry_date ? new Date(`${o.entry_date}T00:00:00`) : null
    const isCompleted = o?.status === 'completed' || o?.status === 'delivered'
    return !!ed && !Number.isNaN(ed.getTime()) && isCompleted && matchesBinaryStatusFilters(o?.payment_status, statusFilters) && ed >= start && ed <= end
  })
  const periodCosts = lancamentos.filter((l: any) => {
    const dd = l?.due_date ? new Date(`${l.due_date}T00:00:00`) : null
    const isCost = l?.type === 'expense'
    const isCanceled = String(l?.status || '').toLowerCase() === 'cancelado'
    return !!dd && !Number.isNaN(dd.getTime()) && isCost && !isCanceled && matchesBinaryStatusFilters(l?.status, statusFilters) && dd >= start && dd <= end
  })
  const faturamento = periodOrders.reduce((acc: number, o: any) => acc + toNumber(o?.total_amount, 0), 0)
  const custos = periodCosts.reduce((acc: number, l: any) => acc + toNumber(l?.amount, 0), 0)
  const lucro = faturamento - custos
  return { faturamento, custos, lucro, margemLucro: faturamento > 0 ? (lucro / faturamento) * 100 : 0, qtdOrdens: periodOrders.length, ordens: periodOrders, custosData: periodCosts }
}

function buildEvolutionData(currentData: any, start: Date, end: Date) {
  const dailyData: Record<string, { faturamento: number; custos: number; lucro: number }> = {}
  const cursor = new Date(start)
  while (cursor <= end) {
    dailyData[formatDateKey(cursor)] = { faturamento: 0, custos: 0, lucro: 0 }
    cursor.setDate(cursor.getDate() + 1)
  }
  for (const o of currentData?.ordens || []) {
    const dk = String(o?.entry_date || '')
    if (dailyData[dk]) dailyData[dk].faturamento += toNumber(o?.total_amount, 0)
  }
  for (const l of currentData?.custosData || []) {
    const dk = String(l?.due_date || '')
    if (dailyData[dk]) dailyData[dk].custos += toNumber(l?.amount, 0)
  }
  return Object.entries(dailyData).map(([date, v]) => ({ name: formatDayLabel(date), ...v, lucro: v.faturamento - v.custos }))
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const payload = (await readBody(event)) || {}

  const dateFrom = parseDateStart(payload?.dateFrom)
  const dateTo = parseDateEnd(payload?.dateTo)
  const categoriaRaw = payload?.categoria && payload.categoria !== 'todos' ? String(payload.categoria) : null
  const categoriaIdsFromParam = categoriaRaw && categoriaRaw.includes(',') ? categoriaRaw.split(',').map((v: string) => v.trim()).filter(Boolean) : []
  const categoriaIds = Array.isArray(payload?.categoriaIds) ? payload.categoriaIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const categoriaIdsCombinados = categoriaIds.length > 0 ? categoriaIds : categoriaIdsFromParam
  const categoriaFiltro = categoriaIdsCombinados.length === 0 && categoriaRaw ? categoriaRaw : null
  const statusFiltros = normalizeStatusFilters(payload?.status)
  const searchTerm = String(payload?.searchTerm || '').trim().toLowerCase()
  const sortBy = ['categoria', 'valor', 'percentual'].includes(payload?.sortBy) ? payload.sortBy : 'valor'
  const sortOrder = payload?.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(payload?.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(payload?.pageSize, 10))))
  const includeRawData = payload?.includeRawData === true
  const includeProfitReport = payload?.includeProfitReport === true
  const includeCategoryDetails = payload?.includeCategoryDetails === true
  const compareWithPreviousPeriod = payload?.compareWithPreviousPeriod !== false
  const compareMode = ['same_period_last_year', 'previous_month', 'previous_quarter'].includes(payload?.compareMode) ? payload.compareMode : 'previous_period'
  const selectedCategory = String(payload?.selectedCategory || '').trim()

  const [lancamentosResult, ordensResult] = await Promise.all([
    supabase.from('financial_transactions').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('due_date', { ascending: false }),
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
  ])

  const lancamentos = lancamentosResult.data || []
  const ordens = ordensResult.data || []

  const lancamentosList = lancamentos.filter((l: any) => {
    if (l?.type !== 'expense') return false
    const st = String(l?.status || '').toLowerCase()
    if (st === 'cancelado') return false
    if (statusFiltros.length > 0 && !statusFiltros.includes(st)) return false
    return true
  })

  const categoriasDisponiveis = (Array.from(new Set(lancamentosList.map((l: any) => String(l?.category || 'outros')))) as string[]).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

  const lancamentosFiltrados = lancamentosList.filter((l: any) => {
    const dl = l?.due_date ? new Date(`${l.due_date}T00:00:00`) : null
    if (!dl || Number.isNaN(dl.getTime())) return false
    if (dateFrom && dl < dateFrom) return false
    if (dateTo && dl > dateTo) return false
    const cat = String(l?.category || 'outros')
    if (categoriaIdsCombinados.length > 0 && !categoriaIdsCombinados.includes(cat)) return false
    if (categoriaFiltro && cat !== categoriaFiltro) return false
    if (searchTerm && !String(l?.description || '').toLowerCase().includes(searchTerm)) return false
    return true
  })

  const ordensFiltradas = ordens.filter((o: any) => {
    const de = o?.entry_date ? new Date(`${o.entry_date}T00:00:00`) : null
    if (!de || Number.isNaN(de.getTime())) return false
    if (dateFrom && de < dateFrom) return false
    if (dateTo && de > dateTo) return false
    if (!(o?.status === 'completed' || o?.status === 'delivered')) return false
    return matchesBinaryStatusFilters(o?.payment_status, statusFiltros)
  })

  const custoTotal = lancamentosFiltrados.reduce((s: number, l: any) => s + toNumber(l?.amount, 0), 0)
  const receitaTotal = ordensFiltradas.reduce((s: number, o: any) => s + toNumber(o?.total_amount, 0), 0)
  const lucroLiquido = receitaTotal - custoTotal
  const margemLucro = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0

  const categoriasMap: Record<string, number> = {}
  for (const l of lancamentosFiltrados) {
    const cat = String(l?.category || 'outros')
    categoriasMap[cat] = (categoriasMap[cat] || 0) + toNumber(l?.amount, 0)
  }

  const categorias = Object.entries(categoriasMap).map(([categoriaKey, valor]) => ({
    categoriaKey, categoria: normalizeCategoryName(categoriaKey), valor,
    percentual: custoTotal > 0 ? (valor / custoTotal) * 100 : 0,
  }))

  categorias.sort((a, b) => {
    const factor = sortOrder === 'asc' ? 1 : -1
    if (sortBy === 'categoria') return a.categoria.localeCompare(b.categoria, 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'percentual') return (a.percentual - b.percentual) * factor
    return (a.valor - b.valor) * factor
  })

  const totalItems = categorias.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const categoriasPaginadas = categorias.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)

  const dailyMap: Record<string, { custo: number }> = {}
  for (const l of lancamentosFiltrados) {
    const date = String(l?.due_date || '')
    if (!date) continue
    if (!dailyMap[date]) dailyMap[date] = { custo: 0 }
    dailyMap[date].custo += toNumber(l?.amount, 0)
  }
  const dadosEvolucao = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ name: date, ...v }))

  const responseData: Record<string, unknown> = {
    costsReport: {
      availableCategories: categoriasDisponiveis,
      summary: { custoTotal, receitaTotal, lucroLiquido, margemLucro },
      charts: { categorias, evolucao: dadosEvolucao },
      table: {
        items: categoriasPaginadas,
        pagination: { page: currentPage, pageSize, totalItems, totalPages },
        sort: { sortBy, sortOrder, status: statusFiltros.length > 0 ? statusFiltros.join(',') : 'todos' },
      },
    },
  }

  if (includeCategoryDetails && selectedCategory) {
    const categoryEntries = lancamentosFiltrados
      .filter((l: any) => String(l?.category || 'outros') === selectedCategory)
      .sort((a: any, b: any) => String(b?.due_date || '').localeCompare(String(a?.due_date || '')))
    const totalCategoryValue = categoryEntries.reduce((s: number, l: any) => s + toNumber(l?.amount, 0), 0)
    responseData.costsCategoryDetails = {
      categoriaKey: selectedCategory, categoria: normalizeCategoryName(selectedCategory),
      totalItems: categoryEntries.length, totalValue: totalCategoryValue,
      items: categoryEntries.map((l: any) => ({
        id: l?.id, description: l?.description || 'Sem descrição', category: String(l?.category || 'outros'),
        amount: toNumber(l?.amount, 0), status: String(l?.status || 'pendente').toLowerCase(),
        type: String(l?.type || 'expense').toLowerCase(), due_date: l?.due_date || null,
        recurrence: l?.recurrence || null, is_installment: Boolean(l?.is_installment),
        current_installment: l?.current_installment ?? null, installment_count: l?.installment_count ?? null,
        notes: l?.notes || null,
      })),
    }
  }

  if (includeProfitReport) {
    const hasPeriod = !!dateFrom && !!dateTo
    const currentData = hasPeriod ? calculatePeriodData(ordens, lancamentos, dateFrom, dateTo, statusFiltros) : null
    let previousData = null, comparisonMeta = null
    if (hasPeriod && compareWithPreviousPeriod) {
      const { previousStartDate, previousEndDate } = getPreviousRangeByMode(dateFrom, dateTo, compareMode)
      previousData = calculatePeriodData(ordens, lancamentos, previousStartDate, previousEndDate, statusFiltros)
      comparisonMeta = {
        mode: compareMode, modeLabel: getComparisonModeLabel(compareMode),
        currentPeriodLabel: formatPeriodLabel(dateFrom, dateTo),
        previousPeriodLabel: formatPeriodLabel(previousStartDate, previousEndDate),
        currentStartDate: formatDateKey(dateFrom), currentEndDate: formatDateKey(dateTo),
        previousStartDate: formatDateKey(previousStartDate), previousEndDate: formatDateKey(previousEndDate),
      }
    }
    const topProfitableOrders = (currentData?.ordens || []).map((o: any) => {
      const fat = toNumber(o?.total_amount, 0), cost = toNumber(o?.total_cost_amount, 0), lucro = fat - cost
      return { numero: o?.number, faturamento: fat, custo: cost, lucro, margem: fat > 0 ? (lucro / fat) * 100 : 0 }
    }).sort((a: any, b: any) => b.lucro - a.lucro).slice(0, 10)

    const variations = currentData && previousData ? {
      faturamento: calculateVariation(currentData.faturamento, previousData.faturamento),
      custos: calculateVariation(currentData.custos, previousData.custos),
      lucro: calculateVariation(currentData.lucro, previousData.lucro),
      margem: calculateVariation(currentData.margemLucro, previousData.margemLucro),
    } : null

    responseData.profitReport = {
      currentData, previousData, variations, comparisonMeta,
      evolutionData: hasPeriod && currentData ? buildEvolutionData(currentData, dateFrom, dateTo) : [],
      topProfitableOrders,
    }
  }

  if (includeRawData) {
    responseData.lancamentos = lancamentos
    responseData.ordens = ordens
  }

  return { organization_id: organizationId, data: responseData }
})
