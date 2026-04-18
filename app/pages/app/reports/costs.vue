<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Custos e Lucro' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { dateFrom, dateTo } = useReportDateRange()

const { data, status } = await useAsyncData(
  () => `report-costs-${dateFrom.value}-${dateTo.value}`,
  () => requestFetch<{ data: any }>('/api/reports/costs-profit', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, includeReport: 'true' }
  }),
  { watch: [dateFrom, dateTo] }
)

const costsReport = computed(() => data.value?.data?.costsReport ?? {})
const summary = computed(() => costsReport.value?.summary ?? {})
const categories = computed(() => costsReport.value?.charts?.categories ?? [])
const evolution = computed(() => costsReport.value?.charts?.evolution ?? [])

const maxCategoryAmount = computed(() =>
  Math.max(1, ...categories.value.map((c: any) => Number(c.amount ?? 0)))
)

function catPct(amount: number) {
  return Math.max(2, Math.round((amount / maxCategoryAmount.value) * 100))
}

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatPercent(v: number) {
  return `${parseFloat(String(v || 0)).toFixed(1)}%`
}

const chartBars = [{ key: 'cost', label: 'Custo', color: '#f87171' }]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Custos e Lucro" />
    </template>

    <template #body>
      <div class="p-4 pb-0">
        <!-- Filter card -->
        <UCard :ui="{ body: 'p-3' }">
          <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
            <div class="flex items-center gap-2 shrink-0 text-muted">
              <UIcon name="i-lucide-filter" class="size-4" />
              <span class="text-sm font-medium">Filtros</span>
            </div>
            <UiDateRangePicker v-model:from="dateFrom" v-model:to="dateTo" class="w-full sm:w-72" />
          </div>
        </UCard>
      </div>
      <div v-if="status === 'pending'" class="p-6 space-y-4">
        <USkeleton v-for="i in 6" :key="i" class="h-20 rounded-xl" />
      </div>

      <div v-else class="p-4 space-y-4">
        <!-- KPI cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-green-600">
              {{ formatCurrency(summary.totalRevenue ?? summary.grossRevenue ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Receita bruta
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-red-500">
              {{ formatCurrency(summary.totalCosts ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Custos totais
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-blue-600">
              {{ formatCurrency(summary.netProfit ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Lucro líquido
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold">
              {{ formatPercent(summary.profitMargin ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Margem de lucro
            </p>
          </UPageCard>
        </div>

        <!-- Cost evolution chart -->
        <UPageCard v-if="evolution.length" variant="subtle" class="overflow-hidden">
          <template #header>
            <p class="text-sm font-semibold">
              Evolução de custos
            </p>
          </template>
          <AppBarChart
            :data="evolution"
            :bars="chartBars"
            :height="200"
            :format-value="formatCurrency"
          />
        </UPageCard>

        <!-- Category breakdown -->
        <UPageCard v-if="categories.length" variant="subtle">
          <template #header>
            <p class="text-sm font-semibold">
              Custos por categoria
            </p>
          </template>
          <div class="space-y-3">
            <div
              v-for="cat in categories"
              :key="cat.categoryKey"
              class="space-y-1"
            >
              <div class="flex items-center justify-between text-sm">
                <span class="truncate max-w-45">{{ cat.category }}</span>
                <div class="flex items-center gap-3 shrink-0">
                  <span class="text-muted text-xs">{{ formatPercent(cat.percentage ?? 0) }}</span>
                  <span class="font-medium text-xs w-24 text-right">{{ formatCurrency(cat.amount ?? 0) }}</span>
                </div>
              </div>
              <div class="h-1.5 bg-elevated rounded-full overflow-hidden">
                <div
                  class="h-full bg-red-400 rounded-full transition-all duration-300"
                  :style="{ width: catPct(cat.amount ?? 0) + '%' }"
                />
              </div>
            </div>
          </div>
        </UPageCard>

        <div v-if="!data?.data" class="flex min-h-48 items-center justify-center rounded-[1.25rem] border border-default/90 bg-default p-10 text-center">
          <div class="max-w-sm space-y-3">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-default/80 bg-elevated/60 text-primary">
              <UIcon name="i-lucide-trending-up" class="h-5 w-5" />
            </div>
            <div class="space-y-1.5">
              <p class="text-sm font-semibold text-highlighted">
                Nenhum dado disponível
              </p>
              <p class="text-sm text-muted">
                Não há dados de custos e lucro para o período selecionado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
