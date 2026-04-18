<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Custos e Lucro' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

const dateFrom = ref(defaultFrom)
const dateTo = ref(defaultTo)

interface CategoryRow { categoryKey: string, category: string, amount: number, percentage: number }
interface EvolutionPoint { name: string, cost: number }
interface Summary { totalCosts: number, totalRevenue: number, netProfit: number, profitMargin: number }

const { data, status } = await useAsyncData(
  () => `report-costs-${dateFrom.value}-${dateTo.value}`,
  () => requestFetch<{ data: { costsReport: {
    summary: Summary
    charts: { categories: CategoryRow[], evolution: EvolutionPoint[] }
  } } }>('/api/reports/costs-profit', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, includeReport: 'true' }
  }),
  { watch: [dateFrom, dateTo] }
)

const costsReport = computed(() => data.value?.data?.costsReport)
const summary = computed(() => costsReport.value?.summary)
const categories = computed(() => costsReport.value?.charts?.categories ?? [])
const evolution = computed(() => costsReport.value?.charts?.evolution ?? [])

const evoCategories = computed(() => evolution.value.map(d => d.name))
const evoSeries = computed(() => [{ name: 'Custo', data: evolution.value.map(d => d.cost) }])

const donutLabels = computed(() => categories.value.map(c => c.category))
const donutSeries = computed(() => categories.value.map(c => c.amount))

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatPercent(v: number) {
  return `${parseFloat(String(v || 0)).toFixed(1)}%`
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Custos e Lucro">
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
        <!-- KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-green-600">
              {{ formatCurrency(summary?.totalRevenue ?? summary?.grossRevenue ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Receita bruta
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-red-500">
              {{ formatCurrency(summary?.totalCosts ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Custos totais
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-blue-600">
              {{ formatCurrency(summary?.netProfit ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Lucro líquido
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold">
              {{ formatPercent(summary?.profitMargin ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Margem de lucro
            </p>
          </UPageCard>
        </div>

        <!-- Charts row -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Cost evolution bar chart -->
          <UPageCard v-if="evolution.length" variant="subtle" class="lg:col-span-2">
            <template #header>
              <p class="text-sm font-semibold">
                Evolução de custos
              </p>
            </template>
            <ChartsBar
              :categories="evoCategories"
              :series="evoSeries"
              :height="240"
              :colors="['#f87171']"
              :format-value="formatCurrency"
            />
          </UPageCard>

          <!-- Category donut chart -->
          <UPageCard v-if="categories.length" variant="subtle">
            <template #header>
              <p class="text-sm font-semibold">
                Custos por categoria
              </p>
            </template>
            <ChartsDonut
              :labels="donutLabels"
              :series="donutSeries"
              :height="260"
              :format-value="formatCurrency"
            />
          </UPageCard>
        </div>

        <!-- Category breakdown table -->
        <UPageCard v-if="categories.length" variant="subtle">
          <template #header>
            <p class="text-sm font-semibold">
              Detalhamento por categoria
            </p>
          </template>
          <div class="divide-y divide-default">
            <div
              v-for="cat in categories"
              :key="cat.categoryKey"
              class="flex items-center gap-4 py-2.5 text-sm"
            >
              <span class="flex-1 truncate font-medium">{{ cat.category }}</span>
              <div class="w-24 h-1.5 bg-elevated rounded-full overflow-hidden shrink-0">
                <div
                  class="h-full bg-red-400 rounded-full"
                  :style="{ width: `${cat.percentage ?? 0}%` }"
                />
              </div>
              <span class="text-muted text-xs w-10 text-right shrink-0">{{ formatPercent(cat.percentage ?? 0) }}</span>
              <span class="font-semibold w-28 text-right shrink-0">{{ formatCurrency(cat.amount ?? 0) }}</span>
            </div>
          </div>
        </UPageCard>

        <div v-if="!costsReport" class="text-center text-muted py-8 text-sm">
          Nenhum dado disponível para o período selecionado.
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
