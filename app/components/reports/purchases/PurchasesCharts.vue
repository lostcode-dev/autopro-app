<script setup lang="ts">
interface SupplierChartItem {
  name: string
  total: number
}

interface DailyChartItem {
  name: string
  total: number
}

const props = defineProps<{
  bySupplier: SupplierChartItem[]
  byDay: DailyChartItem[]
}>()

function formatCurrency(v: number) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const supplierCategories = computed(() => props.bySupplier.map(item => item.name))
const supplierSeries = computed(() => [
  { name: 'Total comprado', data: props.bySupplier.map(item => item.total) }
])

const dayCategories = computed(() => props.byDay.map(item => item.name))
const daySeries = computed(() => [
  { name: 'Total comprado', data: props.byDay.map(item => item.total) }
])
</script>

<template>
  <div v-if="bySupplier.length > 0 || byDay.length > 0" class="grid grid-cols-1 gap-4 xl:grid-cols-5">
    <UCard v-if="bySupplier.length > 0" :ui="{ body: 'p-4' }" class="xl:col-span-2">
      <div class="mb-4 flex items-center gap-2">
        <UIcon name="i-lucide-building-2" class="size-4 text-primary" />
        <p class="text-sm font-semibold text-highlighted">
          Top 10 fornecedores
        </p>
      </div>
      <ChartsBar
        :categories="supplierCategories"
        :series="supplierSeries"
        :height="300"
        :colors="['#0ea5e9']"
        :format-value="formatCurrency"
        column-width="58%"
      />
    </UCard>

    <UCard v-if="byDay.length > 0" :ui="{ body: 'p-4' }" :class="bySupplier.length > 0 ? 'xl:col-span-3' : 'xl:col-span-5'">
      <div class="mb-4 flex items-center gap-2">
        <UIcon name="i-lucide-trending-up" class="size-4 text-primary" />
        <p class="text-sm font-semibold text-highlighted">
          Compras por dia
        </p>
      </div>
      <ChartsLine
        :categories="dayCategories"
        :series="daySeries"
        :height="300"
        :colors="['#14b8a6']"
        :format-value="formatCurrency"
        show-markers
      />
    </UCard>
  </div>
</template>
