<script setup lang="ts">
defineProps<{
  totals: {
    total?: number
    overdue?: number
    current?: number
  }
  counts: {
    clients?: number
    orders?: number
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
        { label: 'Total a receber', value: formatCurrency(totals.total ?? 0), icon: 'i-lucide-badge-dollar-sign', color: 'text-primary', bg: 'bg-primary/10', description: 'pendências filtradas' },
        { label: 'Em atraso', value: formatCurrency(totals.overdue ?? 0), icon: 'i-lucide-triangle-alert', color: 'text-error', bg: 'bg-error/10', description: 'valores vencidos' },
        { label: 'Em dia', value: formatCurrency(totals.current ?? 0), icon: 'i-lucide-calendar-check-2', color: 'text-success', bg: 'bg-success/10', description: 'ainda no prazo' },
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
