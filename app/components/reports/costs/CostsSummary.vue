<script setup lang="ts">
defineProps<{
  summary: {
    totalRevenue?: number
    totalCosts?: number
    netProfit?: number
    profitMargin?: number
  }
  categoryCount?: number
}>()

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPercent(v: number | string) {
  return `${parseFloat(String(v || 0)).toFixed(1)}%`
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <UCard
      v-for="stat in [
        { label: 'Receita bruta', value: formatCurrency(summary.totalRevenue ?? 0), icon: 'i-lucide-banknote-arrow-up', color: 'text-success', bg: 'bg-success/10', description: 'no período' },
        { label: 'Custos totais', value: formatCurrency(summary.totalCosts ?? 0), icon: 'i-lucide-arrow-down-wide-narrow', color: 'text-error', bg: 'bg-error/10', description: `${categoryCount ?? 0} categoria${(categoryCount ?? 0) !== 1 ? 's' : ''}` },
        { label: 'Lucro líquido', value: formatCurrency(summary.netProfit ?? 0), icon: 'i-lucide-calculator', color: 'text-primary', bg: 'bg-primary/10', description: 'resultado do período' },
        { label: 'Margem', value: formatPercent(summary.profitMargin ?? 0), icon: 'i-lucide-percent', color: 'text-info', bg: 'bg-info/10', description: 'sobre a receita' }
      ]"
      :key="stat.label"
      :ui="{ body: 'p-3 sm:p-4' }"
    >
      <div class="flex items-start gap-3">
        <div :class="[stat.bg, 'rounded-xl p-2 shrink-0']">
          <UIcon :name="stat.icon" :class="[stat.color, 'size-5']" />
        </div>
        <div>
          <p class="text-lg font-bold leading-tight">
            {{ stat.value }}
          </p>
          <p class="text-xs font-medium text-highlighted">
            {{ stat.label }}
          </p>
          <p class="text-xs text-muted">
            {{ stat.description }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
