<script setup lang="ts">
interface EvolutionPoint {
  name: string
  revenue: number
  costs: number
  profit: number
}

interface PeriodData {
  revenue: number
  costs: number
  profit: number
  profitMargin: number
}

interface VariationValue {
  variation: number
  type: 'increase' | 'decrease' | 'equal'
}

interface Variations {
  revenue: VariationValue
  costs: VariationValue
  profit: VariationValue
  margin: VariationValue
}

interface TopOrder {
  number: string
  revenue: number
  cost: number
  profit: number
  margin: number
}

interface ComparisonMeta {
  mode: string
  modeLabel: string
  currentPeriodLabel: string
  previousPeriodLabel: string
}

interface ProfitReportResponse {
  data?: {
    profitReport?: {
      currentData?: PeriodData | null
      previousData?: PeriodData | null
      variations?: Variations | null
      evolutionData?: EvolutionPoint[]
      topProfitableOrders?: TopOrder[]
      comparisonMeta?: ComparisonMeta | null
    }
  }
}

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Lucro' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { dateFrom, dateTo } = useReportDateRange()
const statusFilters = useReportQueryParam('status', ['paid'] as string[])
const compareMode = useReportQueryParam('compare', 'no_compare')

const compareWithPreviousPeriod = computed(() => compareMode.value !== 'no_compare')

const { data, status } = await useAsyncData(
  () => `report-profit-${dateFrom.value}-${dateTo.value}-${statusFilters.value.join(',')}-${compareMode.value}`,
  () => requestFetch<ProfitReportResponse>('/api/reports/costs-profit', {
    headers: requestHeaders,
    query: {
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      status: statusFilters.value.length ? statusFilters.value : undefined,
      includeProfitReport: 'true',
      compareWithPreviousPeriod: compareWithPreviousPeriod.value ? 'true' : 'false',
      compareMode: compareWithPreviousPeriod.value ? compareMode.value : undefined
    }
  }),
  { watch: [dateFrom, dateTo, statusFilters, compareMode] }
)

const profitReport = computed(() => data.value?.data?.profitReport)
const current = computed(() => profitReport.value?.currentData ?? null)
const previous = computed(() => profitReport.value?.previousData ?? null)
const variations = computed(() => profitReport.value?.variations ?? null)
const evolution = computed(() => profitReport.value?.evolutionData ?? [])
const topOrders = computed(() => profitReport.value?.topProfitableOrders ?? [])
const comparisonMeta = computed(() => profitReport.value?.comparisonMeta ?? null)

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPercent(v: number | string) {
  return `${parseFloat(String(v || 0)).toFixed(1)}%`
}

function variationText(value?: VariationValue | null, suffix = '') {
  if (!value) return '—'
  if (!Number.isFinite(Number(value.variation))) return `Novo${suffix ? ` ${suffix}` : ''}`
  return `${Number(value.variation || 0).toFixed(1)}%${suffix}`
}

function variationIcon(value?: VariationValue | null) {
  if (value?.type === 'increase') return 'i-lucide-trending-up'
  if (value?.type === 'decrease') return 'i-lucide-trending-down'
  return 'i-lucide-minus'
}

function variationColor(value?: VariationValue | null, invert = false) {
  if (!value || value.type === 'equal') return 'text-muted'
  if (invert) return value.type === 'increase' ? 'text-error' : 'text-success'
  return value.type === 'increase' ? 'text-success' : 'text-error'
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
      <AppPageHeader title="Relatório de Lucro" />
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="space-y-4 p-4">
        <USkeleton class="h-32 rounded-xl" />
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <USkeleton
            v-for="index in 4"
            :key="index"
            class="h-28 rounded-xl"
          />
        </div>
        <USkeleton class="h-80 rounded-xl" />
        <USkeleton class="h-72 rounded-xl" />
      </div>

      <div v-else class="space-y-4 p-4">
        <ReportsProfitFilters
          v-model:date-from="dateFrom"
          v-model:date-to="dateTo"
          v-model:status-filters="statusFilters"
          v-model:compare-mode="compareMode"
        />

        <UCard :ui="{ body: 'p-3' }">
          <div class="flex items-start gap-3">
            <div class="rounded-xl bg-primary/10 p-2">
              <UIcon name="i-lucide-git-compare-arrows" class="size-5 text-primary" />
            </div>
            <div>
              <p class="text-sm font-semibold text-highlighted">
                {{ comparisonMeta ? 'Comparação ativa' : 'Sem comparação' }}
              </p>
              <p class="text-sm text-muted">
                {{
                  comparisonMeta
                    ? `Comparando ${comparisonMeta.currentPeriodLabel} com ${comparisonMeta.previousPeriodLabel} (${comparisonMeta.modeLabel}).`
                    : 'Selecione um modo de comparação para ver a variação entre períodos.'
                }}
              </p>
            </div>
          </div>
        </UCard>

        <ReportsProfitSummary
          :current-data="current"
          :variations="variations"
        />

        <ReportsProfitCharts :evolution="evolution" />

        <UCard
          v-if="comparisonMeta && current && previous"
          :ui="{ body: 'p-4' }"
        >
          <div class="mb-4 flex items-center gap-2">
            <UIcon name="i-lucide-scale" class="size-4 text-primary" />
            <p class="text-sm font-semibold text-highlighted">
              Comparação de períodos
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-xl border border-default bg-elevated/40 p-3">
              <p class="text-xs text-muted">
                Faturamento
              </p>
              <p class="mt-1 text-sm font-bold text-primary">
                Atual: {{ formatCurrency(current.revenue) }}
              </p>
              <p class="mt-1 text-xs text-muted">
                Anterior: {{ formatCurrency(previous.revenue) }}
              </p>
              <div class="mt-2 flex items-center gap-1 text-xs">
                <UIcon
                  :name="variationIcon(variations?.revenue)"
                  :class="[variationColor(variations?.revenue), 'size-3.5']"
                />
                <span :class="variationColor(variations?.revenue)">
                  {{ variationText(variations?.revenue) }}
                </span>
              </div>
            </div>

            <div class="rounded-xl border border-default bg-elevated/40 p-3">
              <p class="text-xs text-muted">
                Custos
              </p>
              <p class="mt-1 text-sm font-bold text-error">
                Atual: {{ formatCurrency(current.costs) }}
              </p>
              <p class="mt-1 text-xs text-muted">
                Anterior: {{ formatCurrency(previous.costs) }}
              </p>
              <div class="mt-2 flex items-center gap-1 text-xs">
                <UIcon
                  :name="variationIcon(variations?.costs)"
                  :class="[variationColor(variations?.costs, true), 'size-3.5']"
                />
                <span :class="variationColor(variations?.costs, true)">
                  {{ variationText(variations?.costs) }}
                </span>
              </div>
            </div>

            <div class="rounded-xl border border-default bg-elevated/40 p-3">
              <p class="text-xs text-muted">
                Lucro
              </p>
              <p class="mt-1 text-sm font-bold" :class="current.profit >= 0 ? 'text-success' : 'text-error'">
                Atual: {{ formatCurrency(current.profit) }}
              </p>
              <p class="mt-1 text-xs text-muted">
                Anterior: {{ formatCurrency(previous.profit) }}
              </p>
              <div class="mt-2 flex items-center gap-1 text-xs">
                <UIcon
                  :name="variationIcon(variations?.profit)"
                  :class="[variationColor(variations?.profit), 'size-3.5']"
                />
                <span :class="variationColor(variations?.profit)">
                  {{ variationText(variations?.profit) }}
                </span>
              </div>
            </div>

            <div class="rounded-xl border border-default bg-elevated/40 p-3">
              <p class="text-xs text-muted">
                Margem
              </p>
              <p class="mt-1 text-sm font-bold text-info">
                Atual: {{ formatPercent(current.profitMargin) }}
              </p>
              <p class="mt-1 text-xs text-muted">
                Anterior: {{ formatPercent(previous.profitMargin) }}
              </p>
              <div class="mt-2 flex items-center gap-1 text-xs">
                <UIcon
                  :name="variationIcon(variations?.margin)"
                  :class="[variationColor(variations?.margin), 'size-3.5']"
                />
                <span :class="variationColor(variations?.margin)">
                  {{ variationText(variations?.margin, ' pp') }}
                </span>
              </div>
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-0' }">
          <div class="flex items-center gap-2 border-b border-default px-4 py-3">
            <UIcon name="i-lucide-trophy" class="size-4 text-primary" />
            <p class="text-sm font-semibold text-highlighted">
              Ordens mais lucrativas
            </p>
          </div>

          <AppDataTable
            :columns="topOrderColumns"
            :data="topOrders as Record<string, unknown>[]"
            :show-footer="false"
            empty-icon="i-lucide-trophy"
            empty-title="Nenhuma OS encontrada"
            empty-description="Não há ordens lucrativas para exibir no período."
          >
            <template #number-cell="{ row }">
              <span class="font-mono text-sm text-highlighted">
                #{{ row.original.number }}
              </span>
            </template>

            <template #revenue-cell="{ row }">
              {{ formatCurrency(Number(row.original.revenue ?? 0)) }}
            </template>

            <template #cost-cell="{ row }">
              <span class="text-error">
                {{ formatCurrency(Number(row.original.cost ?? 0)) }}
              </span>
            </template>

            <template #profit-cell="{ row }">
              <span class="font-medium" :class="Number(row.original.profit ?? 0) >= 0 ? 'text-success' : 'text-error'">
                {{ formatCurrency(Number(row.original.profit ?? 0)) }}
              </span>
            </template>

            <template #margin-cell="{ row }">
              {{ formatPercent(Number(row.original.margin ?? 0)) }}
            </template>
          </AppDataTable>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
