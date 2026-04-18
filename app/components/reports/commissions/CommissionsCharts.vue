<script setup lang="ts">
interface EmployeeChartItem {
  name: string
  total: number
  paid: number
  pending: number
}

interface StatusDist {
  name: string
  value: number
  color: string
}

const props = defineProps<{
  byEmployee: EmployeeChartItem[]
  statusDistribution: StatusDist[]
}>()

function fmt(v: number) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const barCategories = computed(() => props.byEmployee.map(e => e.name))
const barSeries = computed(() => [
  { name: 'Pagas', data: props.byEmployee.map(e => e.paid) },
  { name: 'Pendentes', data: props.byEmployee.map(e => e.pending) }
])

const donutLabels = computed(() => props.statusDistribution.map(s => s.name))
const donutSeries = computed(() => props.statusDistribution.map(s => s.value))
const donutColors = computed(() => props.statusDistribution.map(s => s.color))
</script>

<template>
  <div v-if="byEmployee.length > 0" class="grid grid-cols-1 gap-4 xl:grid-cols-3">
    <!-- Bar chart: commissions per employee -->
    <UCard :ui="{ body: 'p-4' }" class="xl:col-span-2">
      <div class="flex items-center gap-2 mb-4">
        <UIcon name="i-lucide-bar-chart-2" class="size-4 text-primary" />
        <p class="text-sm font-semibold text-highlighted">
          Comissões por funcionário
        </p>
      </div>
      <ChartsBar
        :categories="barCategories"
        :series="barSeries"
        :height="260"
        :colors="['#22c55e', '#f59e0b']"
        :format-value="fmt"
        stacked
      />
    </UCard>

    <!-- Donut: status distribution -->
    <UCard :ui="{ body: 'p-4' }">
      <div class="flex items-center gap-2 mb-4">
        <UIcon name="i-lucide-pie-chart" class="size-4 text-primary" />
        <p class="text-sm font-semibold text-highlighted">
          Distribuição por status
        </p>
      </div>
      <ChartsDonut
        :labels="donutLabels"
        :series="donutSeries"
        :colors="donutColors"
        :height="260"
        :format-value="fmt"
      />
    </UCard>
  </div>
</template>
