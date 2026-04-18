<script setup lang="ts">
defineProps<{
  summary: {
    totalPurchased?: number
    totalPaid?: number
    totalPending?: number
    count?: number
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
        { label: 'Total comprado', value: formatCurrency(summary.totalPurchased ?? 0), icon: 'i-lucide-shopping-cart', color: 'text-primary', bg: 'bg-primary/10', description: 'no período' },
        { label: 'Total pago', value: formatCurrency(summary.totalPaid ?? 0), icon: 'i-lucide-circle-check', color: 'text-success', bg: 'bg-success/10', description: 'já quitado' },
        { label: 'Pendente', value: formatCurrency(summary.totalPending ?? 0), icon: 'i-lucide-clock', color: 'text-warning', bg: 'bg-warning/10', description: 'a pagar' },
        { label: 'Compras', value: summary.count ?? 0, icon: 'i-lucide-receipt-text', color: 'text-info', bg: 'bg-info/10', description: 'no período' }
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
