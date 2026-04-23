// ─── Status maps ──────────────────────────────────────────────────────────────

export const STATUS_COLOR: Record<string, string> = {
  estimate: 'neutral',
  open: 'info',
  in_progress: 'warning',
  waiting_for_part: 'warning',
  completed: 'success',
  delivered: 'success',
  cancelled: 'error'
}

export const STATUS_LABEL: Record<string, string> = {
  estimate: 'Orçamento',
  open: 'Aberta',
  in_progress: 'Em andamento',
  waiting_for_part: 'Aguard. peça',
  completed: 'Concluída',
  delivered: 'Entregue',
  cancelled: 'Cancelada'
}

export const STATUS_ICON: Record<string, string> = {
  estimate: 'i-lucide-file-text',
  open: 'i-lucide-circle-dot',
  in_progress: 'i-lucide-wrench',
  waiting_for_part: 'i-lucide-clock',
  completed: 'i-lucide-circle-check',
  delivered: 'i-lucide-truck',
  cancelled: 'i-lucide-x-circle'
}

export const PAYMENT_STATUS_COLOR: Record<string, string> = {
  pending: 'warning',
  paid: 'success',
  partial: 'info'
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  partial: 'Parcial'
}

export const PAYMENT_STATUS_ICON: Record<string, string> = {
  pending: 'i-lucide-clock',
  paid: 'i-lucide-circle-check',
  partial: 'i-lucide-circle-half'
}

// ─── Advance status map ───────────────────────────────────────────────────────

export type AdvanceInfo = { label: string, icon: string, color: 'info' | 'warning' | 'success' }

export const ADVANCE_STATUS_MAP: Record<string, AdvanceInfo> = {
  estimate: { label: 'Abrir OS', icon: 'i-lucide-circle-dot', color: 'info' },
  open: { label: 'Iniciar', icon: 'i-lucide-wrench', color: 'warning' },
  in_progress: { label: 'Concluir', icon: 'i-lucide-circle-check', color: 'success' }
}

export const EDITABLE_ORDER_STATUSES = ['estimate', 'open', 'in_progress', 'waiting_for_part'] as const

export function canEditServiceOrder(status: string | null | undefined, paymentStatus: string | null | undefined) {
  return EDITABLE_ORDER_STATUSES.includes((status ?? '') as (typeof EDITABLE_ORDER_STATUSES)[number])
    && paymentStatus === 'pending'
}

export function getNextStatus(status: string): string | null {
  if (status === 'estimate') return 'open'
  if (status === 'open') return 'in_progress'
  if (status === 'in_progress') return 'completed'
  return null
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatCurrency(value: number | string | null | undefined) {
  return parseFloat(String(value || 0)).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const parts = value.split('-')
  if (parts.length !== 3) return value
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

export function formatPhone(value: string | null | undefined) {
  if (!value) return '—'
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  return value
}
