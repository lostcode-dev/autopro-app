export function formatDebtorStatusLabel(status: string) {
  if (status === 'overdue') return 'Em atraso'
  if (status === 'current') return 'Em dia'
  return 'Pendente'
}

export function debtorStatusColor(status: string): 'warning' | 'success' | 'error' | 'neutral' {
  if (status === 'overdue') return 'error'
  if (status === 'current') return 'success'
  return 'neutral'
}

export function debtorStatusIcon(status: string) {
  if (status === 'overdue') return 'i-lucide-alert-circle'
  if (status === 'current') return 'i-lucide-calendar-check-2'
  return 'i-lucide-clock'
}

export function formatPaymentMethodLabel(method: string) {
  const value = String(method || '').toLowerCase()
  if (value === 'pix') return 'Pix'
  if (value === 'cash') return 'Dinheiro'
  if (value === 'credit_card') return 'Cartão crédito'
  if (value === 'debit_card') return 'Cartão débito'
  if (value === 'bank_transfer') return 'Transferência'
  if (value === 'check') return 'Cheque'
  if (value === 'boleto') return 'Boleto'
  if (value === 'no_payment') return 'Sem forma'
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : 'Sem forma'
}

export function paymentMethodIcon(method: string) {
  const value = String(method || '').toLowerCase()
  if (value === 'pix') return 'i-lucide-zap'
  if (value === 'cash') return 'i-lucide-banknote'
  if (value === 'credit_card' || value === 'debit_card') return 'i-lucide-credit-card'
  if (value === 'bank_transfer') return 'i-lucide-arrow-left-right'
  if (value === 'check') return 'i-lucide-file-check-2'
  if (value === 'boleto') return 'i-lucide-barcode'
  return 'i-lucide-alert-circle'
}

export function paymentMethodColor(method: string): 'neutral' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' {
  const value = String(method || '').toLowerCase()
  if (value === 'pix') return 'success'
  if (value === 'cash') return 'neutral'
  if (value === 'credit_card') return 'primary'
  if (value === 'debit_card') return 'info'
  if (value === 'bank_transfer') return 'secondary'
  if (value === 'check' || value === 'boleto') return 'warning'
  return 'error'
}

export function formatOrderStatusLabel(status: string) {
  const value = String(status || '').toLowerCase()
  if (value === 'open') return 'Aberta'
  if (value === 'in_progress') return 'Em andamento'
  if (value === 'waiting_for_part') return 'Aguard. peça'
  if (value === 'completed') return 'Concluída'
  if (value === 'delivered') return 'Entregue'
  if (value === 'estimate') return 'Orçamento'
  if (value === 'cancelled') return 'Cancelada'
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : '—'
}

export function orderStatusColor(status: string): 'neutral' | 'info' | 'warning' | 'success' | 'error' {
  const value = String(status || '').toLowerCase()
  if (value === 'open') return 'info'
  if (value === 'in_progress' || value === 'waiting_for_part') return 'warning'
  if (value === 'completed' || value === 'delivered') return 'success'
  if (value === 'cancelled') return 'error'
  return 'neutral'
}
