<script setup lang="ts">
defineProps<{
  summary: {
    totalCommissions?: number
    totalPaid?: number
    totalPending?: number
    employeeCount?: number
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
        { label: 'Total comissões', value: formatCurrency(summary.totalCommissions ?? 0), icon: 'i-lucide-trending-up', color: 'text-primary', bg: 'bg-primary/10', description: 'no período' },
        { label: 'Pagas', value: formatCurrency(summary.totalPaid ?? 0), icon: 'i-lucide-circle-check', color: 'text-success', bg: 'bg-success/10', description: 'já quitado' },
        { label: 'Pendentes', value: formatCurrency(summary.totalPending ?? 0), icon: 'i-lucide-clock', color: 'text-warning', bg: 'bg-warning/10', description: 'a receber' },
        { label: 'Funcionários', value: summary.employeeCount ?? 0, icon: 'i-lucide-users', color: 'text-info', bg: 'bg-info/10', description: 'com comissão' },
      ]"
      :key="stat.label"
      :ui="{ body: 'p-3 sm:p-4' }"
    >
      <div class="flex items-start gap-3">
        <div :class="[stat.bg, 'rounded-xl p-2 shrink-0']">
          <UIcon :name="stat.icon" :class="[stat.color, 'size-5']" />
        </div>
        <div>
          <p class="text-lg font-bold leading-tight">{{ stat.value }}</p>
          <p class="text-xs font-medium text-highlighted">{{ stat.label }}</p>
          <p class="text-xs text-muted">{{ stat.description }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>
