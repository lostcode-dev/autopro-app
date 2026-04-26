export interface CostCategoryVisual {
  icon: string
  tagColor: 'neutral' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error'
  chartColor: string
}

const CATEGORY_PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

export function formatCostCategoryLabel(categoryKey: string) {
  const normalized = String(categoryKey || 'other').replace(/_/g, ' ').trim()
  if (!normalized) return 'Outros'
  return normalized.replace(/\b\w/g, char => char.toUpperCase())
}

export function getCostCategoryVisual(categoryKey: string, index = 0): CostCategoryVisual {
  const key = String(categoryKey || 'other')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const fallbackColor = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length] ?? CATEGORY_PALETTE[0]!

  if (/(tax|impost|fiscal)/.test(key)) {
    return { icon: 'i-lucide-landmark', tagColor: 'error', chartColor: '#ef4444' }
  }
  if (/(salari|folha|employee|funcion|prolabore|pessoal)/.test(key)) {
    return { icon: 'i-lucide-users', tagColor: 'warning', chartColor: '#f97316' }
  }
  if (/(financi|emprest|parcelamento)/.test(key)) {
    return { icon: 'i-lucide-banknote-arrow-down', tagColor: 'info', chartColor: '#22c55e' }
  }
  if (/(cartao|credito|daniel)/.test(key)) {
    return { icon: 'i-lucide-credit-card', tagColor: 'warning', chartColor: '#eab308' }
  }
  if (/(fuel|combust|transport|frete|logistic)/.test(key)) {
    return { icon: 'i-lucide-truck', tagColor: 'info', chartColor: '#3b82f6' }
  }
  if (/(rent|alug|building|estrutura|custo fixo)/.test(key)) {
    return { icon: 'i-lucide-building-2', tagColor: 'primary', chartColor: '#8b5cf6' }
  }
  if (/(market|ads|public|meta|trafeg)/.test(key)) {
    return { icon: 'i-lucide-megaphone', tagColor: 'secondary', chartColor: '#ec4899' }
  }
  if (/(energy|water|internet|telefon|utility|luz)/.test(key)) {
    return { icon: 'i-lucide-zap', tagColor: 'warning', chartColor: '#eab308' }
  }
  if (/(software|system|saas|license|licen)/.test(key)) {
    return { icon: 'i-lucide-monitor-cog', tagColor: 'primary', chartColor: '#6366f1' }
  }
  if (/(part|piece|peca|stock|inventory|suprimento|material|fornecedor|terceirizado)/.test(key)) {
    return { icon: 'i-lucide-package', tagColor: 'success', chartColor: '#22c55e' }
  }
  if (/(maint|manuten|repair|service|custo variavel)/.test(key)) {
    return { icon: 'i-lucide-wrench', tagColor: 'info', chartColor: '#06b6d4' }
  }
  if (/(fee|tarifa|charge|bank|finance)/.test(key)) {
    return { icon: 'i-lucide-receipt', tagColor: 'neutral', chartColor: '#94a3b8' }
  }

  return { icon: 'i-lucide-folder-open', tagColor: 'neutral', chartColor: fallbackColor }
}
