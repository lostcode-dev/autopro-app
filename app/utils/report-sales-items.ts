export function formatSalesOrderStatusLabel(status: string) {
  const map: Record<string, string> = {
    open: 'Aberta',
    in_progress: 'Em andamento',
    waiting_for_part: 'Aguard. peça',
    completed: 'Concluída',
    delivered: 'Entregue',
    estimate: 'Orçamento',
    cancelled: 'Cancelada'
  }
  return map[status] ?? (status || '—')
}

export function salesOrderStatusColor(status: string) {
  const map: Record<string, string> = {
    open: 'info',
    in_progress: 'warning',
    waiting_for_part: 'warning',
    completed: 'success',
    delivered: 'success',
    estimate: 'neutral',
    cancelled: 'error'
  }
  return map[status] ?? 'neutral'
}

export function formatSalesPaymentStatusLabel(status: string) {
  const map: Record<string, string> = {
    paid: 'Pago',
    pending: 'Pendente',
    cancelled: 'Cancelado'
  }
  return map[status] ?? (status || '—')
}

export function salesPaymentStatusColor(status: string) {
  const map: Record<string, string> = {
    paid: 'success',
    pending: 'warning',
    cancelled: 'error'
  }
  return map[status] ?? 'neutral'
}

export function formatSalesPaymentMethodLabel(method: string) {
  const map: Record<string, string> = {
    pix: 'Pix',
    cash: 'Dinheiro',
    credit_card: 'Cartão crédito',
    debit_card: 'Cartão débito',
    bank_transfer: 'Transferência',
    check: 'Cheque',
    boleto: 'Boleto',
    no_payment: 'Sem forma'
  }
  return map[method] ?? (method || '—')
}

export function salesPaymentMethodColor(method: string) {
  const map: Record<string, string> = {
    pix: 'secondary',
    cash: 'success',
    credit_card: 'info',
    debit_card: 'info',
    bank_transfer: 'neutral',
    check: 'warning',
    boleto: 'warning',
    no_payment: 'neutral'
  }
  return map[method] ?? 'neutral'
}

export function salesPaymentMethodIcon(method: string) {
  const map: Record<string, string> = {
    pix: 'i-lucide-zap',
    cash: 'i-lucide-banknote',
    credit_card: 'i-lucide-credit-card',
    debit_card: 'i-lucide-credit-card',
    bank_transfer: 'i-lucide-landmark',
    check: 'i-lucide-file-signature',
    boleto: 'i-lucide-scroll-text',
    no_payment: 'i-lucide-ban'
  }
  return map[method] ?? 'i-lucide-circle'
}

export function salesOrderStatusIcon(status: string) {
  const map: Record<string, string> = {
    open: 'i-lucide-circle-dot',
    in_progress: 'i-lucide-wrench',
    waiting_for_part: 'i-lucide-package-search',
    completed: 'i-lucide-check-circle-2',
    delivered: 'i-lucide-truck',
    estimate: 'i-lucide-file-text',
    cancelled: 'i-lucide-x-circle'
  }
  return map[status] ?? 'i-lucide-circle'
}

export function formatSalesCostSourceLabel(source: string) {
  const map: Record<string, string> = {
    item: 'Informado na OS',
    product: 'Cadastro do produto',
    none: 'Não informado'
  }
  return map[source] ?? (source || '—')
}

export function salesCostSourceColor(source: string) {
  const map: Record<string, string> = {
    item: 'success',
    product: 'info',
    none: 'neutral'
  }
  return map[source] ?? 'neutral'
}
