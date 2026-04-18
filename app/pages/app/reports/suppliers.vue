<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Fornecedores' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { dateFrom, dateTo } = useReportDateRange()
const search = ref('')
const page = ref(1)
const pageSize = 20

const { data, status } = await useAsyncData(
  () => `report-suppliers-${dateFrom.value}-${dateTo.value}-${page.value}-${search.value}`,
  () => requestFetch<{ data: any }>('/api/reports/suppliers', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, page: page.value, pageSize, searchTerm: search.value || undefined }
  }),
  { watch: [dateFrom, dateTo, page, search] }
)

const items = computed(() => data.value?.data?.suppliersReport?.items ?? [])
const summary = computed(() => data.value?.data?.suppliersReport?.summary ?? {})
const pagination = computed(() => data.value?.data?.suppliersReport?.pagination ?? null)

const chartData = computed(() =>
  [...items.value]
    .sort((a: any, b: any) => (b.totalPurchased ?? b.totalAmount ?? 0) - (a.totalPurchased ?? a.totalAmount ?? 0))
    .slice(0, 10)
    .map((s: any) => ({
      name: String(s.name ?? '?').substring(0, 14),
      amount: Number(s.totalPurchased ?? s.totalAmount ?? 0)
    }))
)

const chartCategories = computed(() => chartData.value.map(d => d.name))
const chartSeries = computed(() => [{ name: 'Total comprado', data: chartData.value.map(d => d.amount) }])

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const columns = [
  { accessorKey: 'name', header: 'Fornecedor' },
  { id: 'totalPurchased', header: 'Total comprado' },
  { accessorKey: 'purchaseCount', header: 'Compras' },
  { id: 'averagePurchase', header: 'Ticket médio' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Relatório de Fornecedores" />
    </template>

    <template #body>
      <div class="space-y-4 p-4">
        <!-- Filter card -->
        <UCard :ui="{ body: 'p-3' }">
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-muted">
              <UIcon name="i-lucide-filter" class="size-4" />
              <span class="text-sm font-medium">Filtros</span>
            </div>
            <div>
              <p class="mb-1 text-xs font-medium text-muted">Período</p>
              <UiDateRangePicker v-model:from="dateFrom" v-model:to="dateTo" class="w-full sm:w-auto" />
            </div>
          </div>
        </UCard>
        <!-- Summary cards -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <UCard
          v-for="stat in [
            { label: 'Total em compras', value: formatCurrency(summary.totalPurchased ?? 0), icon: 'i-lucide-truck', color: 'text-primary', description: 'no período' },
            { label: 'Fornecedores ativos', value: summary.supplierCount ?? items.length, icon: 'i-lucide-building-2', color: 'text-info', description: 'com movimentação' },
            { label: 'Total de compras', value: summary.purchaseCount ?? 0, icon: 'i-lucide-shopping-bag', color: 'text-warning', description: 'transações' },
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
        <!-- Top suppliers chart -->
        <UPageCard v-if="chartData.length" variant="subtle" class="overflow-hidden">
          <template #header>
            <p class="text-sm font-semibold">
              Top fornecedores por volume
            </p>
          </template>
          <ChartsBar
            :categories="chartCategories"
            :series="chartSeries"
            :height="200"
            :colors="['#60a5fa']"
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
          search-placeholder="Buscar fornecedor..."
          empty-icon="i-lucide-truck"
          empty-title="Nenhum fornecedor encontrado"
          empty-description="Não há fornecedores com compras no período selecionado."
          @search-change="page = 1"
        >
          <template #totalPurchased-cell="{ row }">
            <span class="font-medium">{{ formatCurrency(row.original.totalPurchased ?? row.original.totalAmount ?? 0) }}</span>
          </template>
          <template #averagePurchase-cell="{ row }">
            {{ formatCurrency(row.original.averagePurchase ?? row.original.avgPerPurchase ?? 0) }}
          </template>
        </AppDataTable>
      </div>
    </template>
  </UDashboardPanel>
</template>
