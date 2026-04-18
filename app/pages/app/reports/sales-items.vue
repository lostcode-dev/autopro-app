<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Itens Vendidos' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { dateFrom, dateTo } = useReportDateRange()
const search = ref('')
const page = ref(1)
const pageSize = 20

const { data, status } = await useAsyncData(
  () => `report-sales-items-${dateFrom.value}-${dateTo.value}-${page.value}-${search.value}`,
  () => requestFetch<{ data: any }>('/api/reports/sales-items', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, searchTerm: search.value || undefined, page: page.value, pageSize }
  }),
  { watch: [dateFrom, dateTo, page, search] }
)

const items = computed(() => data.value?.data?.salesItemsReport?.table?.items ?? [])
const summary = computed(() => data.value?.data?.salesItemsReport?.summary ?? {})
const pagination = computed(() => data.value?.data?.salesItemsReport?.table?.pagination ?? null)

const chartData = computed(() =>
  [...items.value]
    .sort((a: any, b: any) => (b.quantity ?? 0) - (a.quantity ?? 0))
    .slice(0, 12)
    .map((it: any) => ({
      name: String(it.name ?? '?').substring(0, 12),
      qty: Number(it.quantity ?? 0),
      revenue: Number(it.totalRevenue ?? it.revenue ?? 0)
    }))
)

const chartBars = [
  { key: 'revenue', label: 'Receita', color: '#22c55e' },
  { key: 'qty', label: 'Quantidade', color: '#a78bfa' }
]

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const columns = [
  { accessorKey: 'name', header: 'Item' },
  { accessorKey: 'category', header: 'Categoria' },
  { accessorKey: 'quantity', header: 'Qtd.' },
  { id: 'revenue', header: 'Receita' },
  { id: 'cost', header: 'Custo' },
  { id: 'profit', header: 'Lucro' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Itens Vendidos" />
    </template>

    <template #body>
      <div class="space-y-4 p-4">
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
        <!-- Summary cards -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <UCard
          v-for="stat in [
            { label: 'Total itens', value: summary.totalItems ?? summary.totalQuantity ?? 0, icon: 'i-lucide-package', color: 'text-primary', description: 'unidades vendidas' },
            { label: 'Receita total', value: formatCurrency(summary.totalRevenue ?? 0), icon: 'i-lucide-trending-up', color: 'text-success', description: 'no período' },
            { label: 'Lucro total', value: formatCurrency(summary.totalProfit ?? 0), icon: 'i-lucide-circle-dollar-sign', color: 'text-info', description: 'resultado líquido' },
          ]"
          :key="stat.label"
          :ui="{ body: 'p-3 sm:p-4' }"
        >
          <div class="flex items-start gap-3">
            <UIcon :name="stat.icon" :class="stat.color" class="mt-0.5 size-5 shrink-0" />
            <div>
              <p class="text-lg font-bold leading-tight">
                {{ stat.value }}
              </p>
              <p class="text-xs font-medium text-highlighted">
                {{ stat.label }}
              </p>
              <p class="text-xs text-muted">
                {{ stat.description }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
        <!-- Top items chart -->
        <UPageCard v-if="chartData.length" variant="subtle">
          <template #header>
            <p class="text-sm font-semibold">
              Top itens por receita
            </p>
          </template>
          <AppBarChart
            :data="chartData"
            :bars="chartBars"
            :height="200"
            :format-value="formatCurrency"
          />
        </UPageCard>

        <AppDataTable
          :columns="columns"
          :data="items"
          :loading="status === 'pending'"
          v-model:page="page"
          :page-size="pageSize"
          :total="pagination?.totalItems ?? items.length"
          :show-page-size-selector="false"
          show-search
          v-model:search-term="search"
          search-placeholder="Buscar item..."
          empty-icon="i-lucide-list-checks"
          empty-title="Nenhum item encontrado"
          empty-description="Não há itens vendidos para o período ou busca selecionada."
          @search-change="page = 1"
        >
          <template #revenue-cell="{ row }">
            {{ formatCurrency(row.original.totalRevenue ?? row.original.revenue ?? 0) }}
          </template>
          <template #cost-cell="{ row }">
            {{ formatCurrency(row.original.totalCost ?? row.original.cost ?? 0) }}
          </template>
          <template #profit-cell="{ row }">
            <span class="font-medium text-blue-600">{{ formatCurrency(row.original.totalProfit ?? row.original.profit ?? 0) }}</span>
          </template>
        </AppDataTable>
      </div>
    </template>
  </UDashboardPanel>
</template>
