<script setup lang="ts">
interface SupplierChartItem {
  name: string
  total: number
}

const props = defineProps<{
  topSuppliers: SupplierChartItem[]
}>()

function formatCurrency(v: number) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const categories = computed(() => props.topSuppliers.map(item => item.name))
const series = computed(() => [
  { name: 'Total comprado', data: props.topSuppliers.map(item => item.total) }
])
</script>

<template>
  <UCard v-if="topSuppliers.length > 0" :ui="{ body: 'p-4' }">
    <div class="mb-4 flex items-center gap-2">
      <UIcon name="i-lucide-bar-chart-3" class="size-4 text-primary" />
      <p class="text-sm font-semibold text-highlighted">
        Top 10 fornecedores
      </p>
    </div>

    <ChartsBar
      :categories="categories"
      :series="series"
      :height="300"
      :colors="['#0284c7']"
      :format-value="formatCurrency"
      column-width="56%"
    />
  </UCard>
</template>
