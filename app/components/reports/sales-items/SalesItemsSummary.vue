<script setup lang="ts">
defineProps<{
  summary: {
    totalQuantity?: number
    totalRevenue?: number
    totalCost?: number
    totalCommissionCost?: number
    totalProfit?: number
    itemCount?: number
    orderCount?: number
  }
  viewMode: 'item' | 'os'
}>()

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
    <UCard
      v-for="stat in [
        { label: 'Quantidade vendida', value: summary.totalQuantity ?? 0, icon: 'i-lucide-package', color: 'text-primary', bg: 'bg-primary/10', description: 'unidades no período' },
        { label: 'Receita total', value: formatCurrency(summary.totalRevenue ?? 0), icon: 'i-lucide-badge-dollar-sign', color: 'text-success', bg: 'bg-success/10', description: 'itens vendidos' },
        { label: 'Custo total', value: formatCurrency(summary.totalCost ?? 0), icon: 'i-lucide-wallet-cards', color: 'text-error', bg: 'bg-error/10', description: 'sem comissão' },
        { label: 'Comissão total', value: formatCurrency(summary.totalCommissionCost ?? 0), icon: 'i-lucide-hand-coins', color: 'text-warning', bg: 'bg-warning/10', description: 'custos variáveis' },
        { label: viewMode === 'os' ? 'Ordens' : 'Itens', value: viewMode === 'os' ? (summary.orderCount ?? 0) : (summary.itemCount ?? 0), icon: 'i-lucide-list-ordered', color: 'text-info', bg: 'bg-info/10', description: 'registros filtrados' }
      ]"
      :key="stat.label"
      :ui="{ body: 'p-3 sm:p-4' }"
    >
      <div class="flex min-w-0 items-start gap-3">
        <div :class="[stat.bg, 'shrink-0 rounded-xl p-2']">
          <UIcon :name="stat.icon" :class="[stat.color, 'size-5']" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="break-words text-base font-bold leading-tight sm:text-lg">
            {{ stat.value }}
          </p>
          <p class="mt-1 text-xs font-medium text-highlighted">
            {{ stat.label }}
          </p>
          <p class="mt-0.5 text-xs leading-snug text-muted">
            {{ stat.description }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
