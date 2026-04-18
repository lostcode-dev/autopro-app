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
