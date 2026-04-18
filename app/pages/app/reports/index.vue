<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatórios - Visão Geral' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const now = new Date()
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

const { dateFrom, dateTo } = useReportDateRange()

interface ChartPoint { name: string, revenue: number, cost: number }
interface TopItem { name: string, count: number }
interface Overview {
  grossRevenue: number
  totalCosts: number
  netProfit: number
  profitMargin: number
  averageTicket: number
  activeClients: number
  totalOrders: number
  newClients: number
  chartData: ChartPoint[]
  topItems: TopItem[]
}

const { data, status } = await useAsyncData(
  () => `report-overview-${dateFrom.value}-${dateTo.value}`,
  () => requestFetch<{ data: { overview: Overview } }>('/api/reports/overview', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value }
  }),
  { watch: [dateFrom, dateTo] }
)

const overview = computed(() => data.value?.data?.overview)
const chartData = computed(() => overview.value?.chartData ?? [])
const topItems = computed(() => overview.value?.topItems ?? [])

const barCategories = computed(() => chartData.value.map(d => d.name))
const barSeries = computed(() => [
  { name: 'Faturamento', data: chartData.value.map(d => d.revenue) },
  { name: 'Custo', data: chartData.value.map(d => d.cost) }
])

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatPercent(v: number) {
  return `${parseFloat(String(v || 0)).toFixed(1)}%`
}

const kpis = computed(() => [
  { label: 'Receita bruta', value: formatCurrency(overview.value?.grossRevenue ?? 0), icon: 'i-lucide-trending-up', color: 'text-green-600' },
  { label: 'Custos totais', value: formatCurrency(overview.value?.totalCosts ?? 0), icon: 'i-lucide-receipt', color: 'text-red-500' },
  { label: 'Lucro líquido', value: formatCurrency(overview.value?.netProfit ?? 0), icon: 'i-lucide-circle-dollar-sign', color: 'text-blue-600' },
  { label: 'Margem de lucro', value: formatPercent(overview.value?.profitMargin ?? 0), icon: 'i-lucide-percent', color: 'text-purple-600' },
  { label: 'Ticket médio', value: formatCurrency(overview.value?.averageTicket ?? 0), icon: 'i-lucide-tag', color: 'text-orange-500' },
  { label: 'Clientes ativos', value: String(overview.value?.activeClients ?? 0), icon: 'i-lucide-users', color: 'text-primary' },
  { label: 'Ordens finalizadas', value: String(overview.value?.totalOrders ?? 0), icon: 'i-lucide-check-circle-2', color: 'text-green-600' },
  { label: 'Novos clientes', value: String(overview.value?.newClients ?? 0), icon: 'i-lucide-user-plus', color: 'text-primary' }
])
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Visão Geral" />
    </template>

    <template #body>
      <div class="p-4 pb-0">
        <UCard :ui="{ body: 'p-3' }">
          <div class="space-y-3 grid grid-cols-2">
            <div class="flex items-center gap-2 text-muted col-span-2">
              <UIcon name="i-lucide-filter" class="size-4" />
              <span class="text-sm font-medium">Filtros</span>
            </div>
            <div class="w-full">
              <p class="mb-1 text-xs font-medium text-muted">Período</p>
              <UiDateRangePicker v-model:from="dateFrom" v-model:to="dateTo" class="w-full sm:w-auto" />
            </div>
          </div>
        </UCard>
      </div>
      <div v-if="status === 'pending'" class="p-6 space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <USkeleton v-for="i in 8" :key="i" class="h-20 rounded-xl" />
        </div>
        <USkeleton class="h-64 rounded-xl" />
        <USkeleton class="h-40 rounded-xl" />
      </div>

      <div v-else class="p-4 space-y-4 pt-0">
        <!-- KPI Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <UPageCard
            v-for="kpi in kpis"
            :key="kpi.label"
            variant="subtle"
          >
            <div class="flex items-center gap-3">
              <div class="size-9 rounded-xl flex items-center justify-center bg-elevated shrink-0">
                <UIcon
                  :name="kpi.icon"
                  class="size-5"
                  :class="kpi.color"
                />
              </div>
              <div class="min-w-0">
                <p
                  class="text-base font-bold leading-tight"
                  :class="kpi.color"
                >
                  {{ kpi.value }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ kpi.label }}
                </p>
              </div>
            </div>
          </UPageCard>
        </div>

        <!-- Revenue vs Cost Chart -->
        <UPageCard variant="subtle">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-bar-chart-2" class="size-4 text-primary shrink-0" />
              <p class="text-sm font-semibold">Faturamento vs Custo</p>
            </div>
          </template>
          <ChartsBar
            :categories="barCategories"
            :series="barSeries"
            :height="240"
            :colors="['#22c55e', '#f87171']"
            :format-value="formatCurrency"
          />
        </UPageCard>

        <!-- Top Items -->
        <UPageCard v-if="topItems.length" variant="subtle">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-list-checks" class="size-4 text-primary shrink-0" />
              <p class="text-sm font-semibold">Itens mais vendidos</p>
            </div>
          </template>
          <div class="divide-y divide-default">
            <div
              v-for="(item, i) in topItems.slice(0, 10)"
              :key="item.name"
              class="flex items-center gap-3 py-2"
            >
              <span class="text-muted text-xs w-5 text-right shrink-0 font-medium">{{ i + 1 }}</span>
              <span class="flex-1 text-sm truncate">{{ item.name }}</span>
              <UBadge
                :label="`${item.count}×`"
                color="primary"
                variant="subtle"
                size="xs"
              />
            </div>
          </div>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
