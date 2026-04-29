// Shared helpers for report endpoints (server/api/reports/)

// ─── Query parameter helpers ─────────────────────────────────────────────────

/** Normalizes a query param value (string | string[] | undefined) to a string array. */
export function qArr(val: string | string[] | undefined | null): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  return [val]
}

// ─── Date parsing ───────────────────────────────────────────────────────────

export function parseDateStart(value?: string): Date | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseDateEnd(value?: string): Date | null {
  if (!value) return null
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Parses a date range from `from`/`to` strings.
 * When `to` is absent but `from` is provided (single-day selection),
 * defaults `to` to end-of-day of the same date as `from`.
 */
export function parseDateRange(from?: string, to?: string): { dateFrom: Date | null, dateTo: Date | null } {
  const effectiveTo = (from && !to) ? from : to
  return {
    dateFrom: parseDateStart(from),
    dateTo: parseDateEnd(effectiveTo)
  }
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

// ─── Number helpers ──────────────────────────────────────────────────────────

export function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function roundMoney(value: number): number {
  return Number.parseFloat(Number(value || 0).toFixed(2))
}

// ─── Array / string helpers ──────────────────────────────────────────────────

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((i: unknown) => String(i || '').trim()).filter(Boolean)))
  }
  if (typeof value === 'string') {
    const n = value.trim()
    if (!n || ['todos', 'null', 'undefined'].includes(n)) return []
    if (n.startsWith('[') && n.endsWith(']')) {
      try {
        return toStringArray(JSON.parse(n))
      } catch {
        return []
      }
    }
    if (n.includes(',')) return Array.from(new Set(n.split(',').map(i => i.trim()).filter(Boolean)))
    return [n]
  }
  return []
}

export function normalizeId(value: unknown): string | null {
  const id = String(value ?? '').trim()
  return id.length > 0 ? id : null
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const data = items.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  return { data, pagination: { page: currentPage, pageSize, totalItems, totalPages } }
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

export function sortFactor(order: 'asc' | 'desc'): 1 | -1 {
  return order === 'asc' ? 1 : -1
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export function normalizeReportStatus(value: unknown): 'paid' | 'pending' | 'cancelled' {
  const status = String(value || '').trim().toLowerCase()
  if (status === 'paid') return 'paid'
  if (status === 'cancelled') return 'cancelled'
  if (['partial', 'overdue', 'pending'].includes(status)) return 'pending'
  return 'pending'
}

export function normalizeStatusFilters(value: unknown): string[] {
  const allowed = new Set(['paid', 'pending', 'cancelled'])
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(item => normalizeReportStatus(item)).filter(item => allowed.has(item))))
  }
  const normalized = String(value || 'all').toLowerCase()
  if (!normalized || normalized === 'all') return []
  return Array.from(new Set(normalized.split(',').map(item => normalizeReportStatus(item.trim())).filter(item => allowed.has(item))))
}

export function matchesStatusFilters(value: unknown, filters: string[]): boolean {
  if (!Array.isArray(filters) || filters.length === 0) return true
  const status = normalizeReportStatus(value)
  return filters.includes(status)
}

export function formatStatusLabel(value: unknown): string {
  const status = String(value || '').trim().toLowerCase()
  if (!status) return '-'

  const statusLabelMap: Record<string, string> = {
    open: 'Aberta',
    in_progress: 'Em andamento',
    waiting_for_part: 'Aguardando peça',
    completed: 'Concluída',
    delivered: 'Entregue',
    estimate: 'Orçamento',
    cancelled: 'Cancelada',
    paid: 'Pago',
    pending: 'Pendente',
    partial: 'Parcial',
    overdue: 'Vencido',
    no_payment: 'Sem pagamento',
    no_payment_method: 'Sem pagamento',
    commission: 'Comissão',
    bonus: 'Bônus'
  }

  if (statusLabelMap[status]) return statusLabelMap[status]
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

// ─── Period comparison ────────────────────────────────────────────────────────

function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1
}

function getQuarterStart(year: number, quarter: number): Date {
  return new Date(year, (quarter - 1) * 3, 1, 0, 0, 0, 0)
}

function getQuarterEnd(year: number, quarter: number): Date {
  return new Date(year, (quarter - 1) * 3 + 3, 0, 23, 59, 59, 999)
}

export function getPreviousRangeByMode(
  startDate: Date,
  endDate: Date,
  compareMode: string
): { previousStartDate: Date, previousEndDate: Date } {
  if (compareMode === 'same_period_last_year') {
    const ps = new Date(startDate)
    ps.setFullYear(ps.getFullYear() - 1)
    const pe = new Date(endDate)
    pe.setFullYear(pe.getFullYear() - 1)
    return { previousStartDate: startOfDay(ps), previousEndDate: endOfDay(pe) }
  }
  if (compareMode === 'previous_month') {
    const ref = startOfDay(startDate)
    return {
      previousStartDate: new Date(ref.getFullYear(), ref.getMonth() - 1, 1, 0, 0, 0, 0),
      previousEndDate: new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999)
    }
  }
  if (compareMode === 'previous_quarter') {
    const cq = getQuarter(startDate)
    const cy = startDate.getFullYear()
    const pq = cq === 1 ? 4 : cq - 1
    const py = cq === 1 ? cy - 1 : cy
    return { previousStartDate: getQuarterStart(py, pq), previousEndDate: getQuarterEnd(py, pq) }
  }
  // default: previous equivalent period
  const DAY_MS = 1000 * 60 * 60 * 24
  const periodDays = Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1
  const pe = new Date(startDate)
  pe.setDate(pe.getDate() - 1)
  const ps = new Date(pe)
  ps.setDate(ps.getDate() - (periodDays - 1))
  return { previousStartDate: startOfDay(ps), previousEndDate: endOfDay(pe) }
}

export function calculateVariation(current: number, previous: number) {
  if (previous === 0 && current === 0) return { variation: 0, type: 'equal' as const }
  if (previous === 0) {
    return {
      variation: null,
      type: current > 0 ? 'increase' as const : 'decrease' as const,
      fromZeroBase: true
    }
  }
  const variation = ((current - previous) / Math.abs(previous)) * 100
  return {
    variation: Math.abs(variation),
    type: variation > 0 ? 'increase' as const : variation < 0 ? 'decrease' as const : 'equal' as const,
    fromZeroBase: false
  }
}

export function getComparisonModeLabel(mode: string): string {
  if (mode === 'same_period_last_year') return 'Mesmo período do ano anterior'
  if (mode === 'previous_month') return 'Mês anterior'
  if (mode === 'previous_quarter') return 'Trimestre anterior'
  return 'Período anterior equivalente'
}

function formatDatePtBR(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function formatPeriodLabel(start: Date, end: Date): string {
  return `${formatDatePtBR(start)} a ${formatDatePtBR(end)}`
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(value, 0))
}

export function formatOptionalDate(value: unknown): string {
  if (!value) return '-'
  try {
    const date = new Date(String(value).includes('T') ? String(value) : `${String(value)}T00:00:00`)
    if (Number.isNaN(date.getTime())) return '-'
    return new Intl.DateTimeFormat('pt-BR').format(date)
  } catch {
    return '-'
  }
}

// ─── Purchase payment status ──────────────────────────────────────────────────

export function getPurchasePaymentStatus(purchase: { payment_status?: unknown, due_date?: string | null } | null | undefined): string {
  if (normalizeReportStatus(purchase?.payment_status) === 'paid') return 'paid'
  if (purchase?.due_date) {
    const due = new Date(`${purchase.due_date}T00:00:00`)
    if (!Number.isNaN(due.getTime()) && due < new Date()) return 'overdue'
  }
  return 'pending'
}
