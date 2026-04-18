<script setup lang="ts">
defineProps<{
  summary: {
    totalPurchased?: number
    supplierCount?: number
    purchaseCount?: number
    itemCount?: number
  }
}>()

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <UCard
      v-for="stat in [
        { label: 'Total comprado', value: formatCurrency(summary.totalPurchased ?? 0), icon: 'i-lucide-badge-dollar-sign', color: 'text-primary', bg: 'bg-primary/10', description: 'no período' },
        { label: 'Fornecedores ativos', value: summary.supplierCount ?? 0, icon: 'i-lucide-building-2', color: 'text-info', bg: 'bg-info/10', description: 'com compras' },
        { label: 'Compras lançadas', value: summary.purchaseCount ?? 0, icon: 'i-lucide-shopping-cart', color: 'text-warning', bg: 'bg-warning/10', description: 'no período' },
        { label: 'Itens comprados', value: summary.itemCount ?? 0, icon: 'i-lucide-package', color: 'text-success', bg: 'bg-success/10', description: 'somados nas compras' }
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
