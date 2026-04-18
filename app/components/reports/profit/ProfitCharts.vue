<script setup lang="ts">
interface EvolutionPoint {
  name: string
  revenue: number
  costs: number
  profit: number
}

const props = defineProps<{
  evolution: EvolutionPoint[]
}>()

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const categories = computed(() => props.evolution.map(point => point.name))
const series = computed(() => [
  { name: 'Receita', data: props.evolution.map(point => point.revenue) },
  { name: 'Custos', data: props.evolution.map(point => point.costs) },
  { name: 'Lucro', data: props.evolution.map(point => point.profit) }
])
</script>

<template>
  <UCard v-if="evolution.length > 0" :ui="{ body: 'p-4' }">
    <div class="mb-4 flex items-center gap-2">
      <UIcon name="i-lucide-chart-column-big" class="size-4 text-primary" />
      <p class="text-sm font-semibold text-highlighted">
        Evolução do período
      </p>
    </div>

    <ChartsArea
      :categories="categories"
      :series="series"
      :height="280"
      :colors="['#0284c7', '#ef4444', '#16a34a']"
      :format-value="(value: number) => formatCurrency(value)"
    />
  </UCard>
</template>
