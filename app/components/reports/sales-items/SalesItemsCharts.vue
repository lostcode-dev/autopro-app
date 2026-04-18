<script setup lang="ts">
interface ChartItem {
  name: string
  quantity: number
  revenue: number
}

const props = defineProps<{
  items: ChartItem[]
}>()

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const categories = computed(() => props.items.map(item => item.name))
const series = computed(() => [
  { name: 'Quantidade', data: props.items.map(item => item.quantity) },
  { name: 'Receita', data: props.items.map(item => item.revenue) }
])
</script>

<template>
  <UCard v-if="items.length > 0" :ui="{ body: 'p-4' }">
    <div class="mb-4 flex items-center gap-2">
      <UIcon name="i-lucide-chart-column-big" class="size-4 text-primary" />
      <p class="text-sm font-semibold text-highlighted">
        Top itens vendidos
      </p>
    </div>

    <ChartsBar
      :categories="categories"
      :series="series"
      :height="280"
      :colors="['#0284c7', '#22c55e']"
      :format-value="(value: number) => formatCurrency(value)"
      column-width="52%"
    />
  </UCard>
</template>
