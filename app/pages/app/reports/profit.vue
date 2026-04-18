<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Lucro' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

const dateFrom = ref(defaultFrom)
const dateTo = ref(defaultTo)

interface EvolutionPoint { name: string, revenue: number, costs: number, profit: number }
interface PeriodData { revenue: number, costs: number, profit: number, profitMargin: number }
interface Variations { revenue: number, costs: number, profit: number, margin: number }
interface TopOrder { number: string, revenue: number, cost: number, profit: number, margin: number }

const { data, status } = await useAsyncData(
  () => `report-profit-${dateFrom.value}-${dateTo.value}`,
  () => requestFetch<{ data: { profitReport: {
    currentData: PeriodData
    previousData: PeriodData | null
    variations: Variations | null
    evolutionData: EvolutionPoint[]
    topProfitableOrders: TopOrder[]
  } } }>('/api/reports/costs-profit', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, includeProfitReport: 'true' }
  }),
  { watch: [dateFrom, dateTo] }
)

const profitReport = computed(() => data.value?.data?.profitReport)
const current = computed(() => profitReport.value?.currentData)
const variations = computed(() => profitReport.value?.variations ?? null)
const evolution = computed(() => profitReport.value?.evolutionData ?? [])
const topOrders = computed(() => profitReport.value?.topProfitableOrders ?? [])

const evoCategories = computed(() => evolution.value.map(d => d.name))
const evoSeries = computed(() => [
  { name: 'Receita', data: evolution.value.map(d => d.revenue) },
  { name: 'Custos', data: evolution.value.map(d => d.costs) },
  { name: 'Lucro', data: evolution.value.map(d => d.profit) }
])

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatPercent(v: number) {
  return `${parseFloat(String(v || 0)).toFixed(1)}%`
}
function variationColor(v: number) {
  return v >= 0 ? 'text-green-600' : 'text-red-500'
}
function variationIcon(v: number) {
  return v >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
}

const variationLabels: Record<string, string> = {
  revenue: 'Receita',
  costs: 'Custos',
  profit: 'Lucro',
  margin: 'Margem'
}

const topOrderColumns = [
  { accessorKey: 'number', header: 'OS' },
  { id: 'revenue', header: 'Receita' },
  { id: 'cost', header: 'Custo' },
  { id: 'profit', header: 'Lucro' },
  { id: 'margin', header: 'Margem' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Relatório de Lucro">
        <template #right>
          <div class="flex items-center gap-2">
            <UInput v-model="dateFrom" type="date" size="sm" class="w-36" />
            <span class="text-muted text-sm">até</span>
            <UInput v-model="dateTo" type="date" size="sm" class="w-36" />
          </div>
        </template>
      </AppPageHeader>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="p-6 space-y-4">
        <USkeleton v-for="i in 6" :key="i" class="h-20 rounded-xl" />
      </div>

      <div v-else class="p-4 space-y-4">
        <!-- KPIs -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-green-600">
              {{ formatCurrency(current?.revenue ?? current?.grossRevenue ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Receita bruta
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-red-500">
              {{ formatCurrency(current?.costs ?? current?.totalCosts ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Custos
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-blue-600">
              {{ formatCurrency(current?.profit ?? current?.netProfit ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Lucro líquido
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold">
              {{ formatPercent(current?.profitMargin ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Margem
            </p>
          </UPageCard>
        </div>

        <!-- Evolution Area Chart -->
        <UPageCard v-if="evolution.length" variant="subtle">
          <template #header>
            <p class="text-sm font-semibold">
              Evolução do período
            </p>
          </template>
          <ChartsAreaChart
            :categories="evoCategories"
            :series="evoSeries"
            :height="240"
            :colors="['#22c55e', '#f87171', '#3b82f6']"
            :format-value="formatCurrency"
          />
        </UPageCard>

        <!-- Variation vs previous period -->
        <UPageCard v-if="variations" variant="subtle">
          <template #header>
            <p class="text-sm font-semibold">
              Variação vs. período anterior
            </p>
          </template>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div
              v-for="(val, key) in variations"
              :key="key"
              class="flex items-center gap-2"
            >
              <UIcon
                :name="variationIcon(Number(val))"
                :class="variationColor(Number(val))"
              />
              <div>
                <p class="text-muted text-xs">
                  {{ variationLabels[String(key)] ?? key }}
                </p>
                <p :class="['font-medium', variationColor(Number(val))]">
                  {{ formatPercent(Number(val)) }}
                </p>
              </div>
            </div>
          </div>
        </UPageCard>

        <!-- Top profitable orders -->
        <div class="space-y-2">
          <p class="px-1 text-sm font-semibold">
            Ordens mais lucrativas
          </p>
          <AppDataTable
            :columns="topOrderColumns"
            :data="topOrders"
            :show-footer="false"
            empty-icon="i-lucide-trophy"
            empty-title="Nenhuma OS encontrada"
            empty-description="Não há ordens lucrativas para exibir no período."
          >
            <template #revenue-cell="{ row }">
              {{ formatCurrency(row.original.revenue ?? 0) }}
            </template>
            <template #cost-cell="{ row }">
              {{ formatCurrency(row.original.cost ?? 0) }}
            </template>
            <template #profit-cell="{ row }">
              <span class="font-medium text-blue-600">{{ formatCurrency(row.original.profit ?? 0) }}</span>
            </template>
            <template #margin-cell="{ row }">
              {{ formatPercent(row.original.margin ?? 0) }}
            </template>
          </AppDataTable>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
