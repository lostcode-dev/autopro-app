<script setup lang="ts">
defineProps<{
  summary: {
    totalRevenue?: number
    totalActiveClients?: number
    totalOrders?: number
  }
}>()

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <UCard
      v-for="stat in [
        {
          label: 'Receita total',
          value: formatCurrency(summary.totalRevenue ?? 0),
          icon: 'i-lucide-trending-up',
          color: 'text-success',
          bg: 'bg-success/10',
          description: 'no período'
        },
        {
          label: 'Clientes ativos',
          value: summary.totalActiveClients ?? 0,
          icon: 'i-lucide-users',
          color: 'text-primary',
          bg: 'bg-primary/10',
          description: 'com movimentação'
        },
        {
          label: 'Total de OS',
          value: summary.totalOrders ?? 0,
          icon: 'i-lucide-clipboard-list',
          color: 'text-info',
          bg: 'bg-info/10',
          description: 'no período'
        }
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
