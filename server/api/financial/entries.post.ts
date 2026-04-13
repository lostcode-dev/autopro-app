import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/financial/entries
 * Returns paginated financial entries with filtering, category options, totals.
 * Migrated from: supabase/functions/getFinancialEntriesPage
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

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeCategory(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function capitalizeLabel(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function normalizeTipo(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'income' || normalized === 'expense') return normalized
  return 'todos'
}

function normalizeStatus(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'pago' || normalized === 'pendente') return normalized
  return 'todos'
}

function normalizeEntryTipo(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'income' || normalized === 'expense') return normalized
  return null
}

function parseStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item: unknown) => String(item || '').trim()).filter(Boolean) : []
}

function parseAmount(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const normalized = value.replace(/\s/g, '').replace(/R\$/g, '').replace(/\./g, '').replace(/,/g, '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const DEFAULT_CATEGORIES = ['vendas', 'servicos', 'aluguel', 'salarios', 'fornecedores', 'impostos', 'marketing', 'outros']

function getTotals(entries: any[]) {
  let totalIncomePaid = 0, totalExpensePaid = 0, totalIncomePending = 0, totalExpensePending = 0

  for (const entry of entries) {
    const tipo = String(entry?.type || '').toLowerCase()
    const status = String(entry?.status || '').toLowerCase()
    const valor = parseAmount(entry?.amount)

    if (tipo === 'income' && status === 'pago') totalIncomePaid += valor
    if (tipo === 'expense' && status === 'pago') totalExpensePaid += valor
    if (tipo === 'income' && status === 'pendente') totalIncomePending += valor
    if (tipo === 'expense' && status === 'pendente') totalExpensePending += valor
  }

  return {
    totalIncomePaid, totalExpensePaid,
    balancePaid: totalIncomePaid - totalExpensePaid,
    totalIncomePending, totalExpensePending,
    balancePending: totalIncomePending - totalExpensePending,
    totalIncome: totalIncomePaid + totalIncomePending,
    totalExpense: totalExpensePaid + totalExpensePending,
    balance: (totalIncomePaid + totalIncomePending) - (totalExpensePaid + totalExpensePending)
  }
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const payload = (await readBody(event)) || {}

  const searchTerm = String(payload?.searchTerm || '').trim().toLowerCase()
  const tipo = normalizeTipo(payload?.typeFilter)
  const status = normalizeStatus(payload?.statusFilter)
  const dateFrom = parseDateStart(payload?.dateFrom)
  const dateTo = parseDateEnd(payload?.dateTo)
  const categoryFilters = parseStringArray(payload?.categoryFilters).map(normalizeCategory).filter(Boolean)
  const page = Math.max(1, Math.floor(toNumber(payload?.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(payload?.pageSize, 20))))

  const { data: allEntries } = await supabase
    .from('financial_transactions')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('due_date', { ascending: false })

  const entriesList = Array.isArray(allEntries) ? allEntries : []

  const baseFiltered = entriesList.filter((entry: any) => {
    const vencimento = entry?.due_date ? new Date(`${entry.due_date}T00:00:00`) : null
    if (!vencimento || Number.isNaN(vencimento.getTime())) return false
    if (dateFrom && vencimento < dateFrom) return false
    if (dateTo && vencimento > dateTo) return false
    if (tipo !== 'todos' && String(entry?.type || '').toLowerCase() !== tipo) return false
    if (searchTerm) {
      const descricao = String(entry?.description || '').toLowerCase()
      if (!descricao.includes(searchTerm)) return false
    }
    return true
  })

  // Build category options
  const categoryEntradaMap = new Map<string, string>()
  const categorySaidaMap = new Map<string, string>()
  const categoryDefaultMap = new Map<string, string>()

  for (const name of DEFAULT_CATEGORIES) {
    const normalized = normalizeCategory(name)
    if (normalized && !categoryDefaultMap.has(normalized)) categoryDefaultMap.set(normalized, capitalizeLabel(name))
  }

  for (const entry of baseFiltered) {
    const normalized = normalizeCategory(entry?.category)
    if (!normalized) continue
    const entryTipo = normalizeEntryTipo(entry?.type)
    const label = String(entry?.category || '').trim()

    if (entryTipo === 'income') {
      if (categoryDefaultMap.has(normalized)) categoryDefaultMap.delete(normalized)
      if (!categoryEntradaMap.has(normalized) && !categorySaidaMap.has(normalized)) categoryEntradaMap.set(normalized, label)
    } else if (entryTipo === 'expense') {
      if (categoryDefaultMap.has(normalized)) categoryDefaultMap.delete(normalized)
      if (!categorySaidaMap.has(normalized) && !categoryEntradaMap.has(normalized)) categorySaidaMap.set(normalized, label)
    }
  }

  const defaultOptions = Array.from(categoryDefaultMap.entries()).map(([value, label]) => ({ value, label, group: 'padrao' })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
  const entradaOptions = Array.from(categoryEntradaMap.entries()).map(([value, label]) => ({ value, label, group: 'entrada' })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
  const saidaOptions = Array.from(categorySaidaMap.entries()).map(([value, label]) => ({ value, label, group: 'saida' })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
  const categoryOptions = [...defaultOptions, ...entradaOptions, ...saidaOptions]

  const fullyFiltered = baseFiltered.filter((entry: any) => {
    if (status !== 'todos' && String(entry?.status || '').toLowerCase() !== status) return false
    if (categoryFilters.length > 0) {
      const currentCategory = normalizeCategory(entry?.category)
      if (!categoryFilters.includes(currentCategory)) return false
    }
    return true
  })

  fullyFiltered.sort((a: any, b: any) => {
    const aDate = String(a?.due_date || '')
    const bDate = String(b?.due_date || '')
    if (aDate !== bDate) return bDate.localeCompare(aDate)
    return String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
  })

  const totalItems = fullyFiltered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const items = fullyFiltered.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize)
  const totals = getTotals(fullyFiltered)

  return {
    organization_id: organizationId,
    data: {
      financialEntriesPage: {
        items,
        totals,
        pagination: { page: currentPage, pageSize, totalItems, totalPages },
        categoryOptions
      }
    }
  }
})
