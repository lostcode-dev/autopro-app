<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Itens Vendidos' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

const dateFrom = ref(defaultFrom)
const dateTo = ref(defaultTo)
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
      <AppPageHeader title="Itens Vendidos">
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
      <!-- Summary bar -->
      <div class="grid grid-cols-3 divide-x divide-default border-b border-default text-center text-sm py-3">
        <div>
          <p class="text-muted text-xs">
            Total itens
          </p>
          <p class="font-bold">
            {{ summary.totalItems ?? summary.totalQuantity ?? 0 }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Receita total
          </p>
          <p class="font-bold text-green-600">
            {{ formatCurrency(summary.totalRevenue ?? 0) }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Lucro total
          </p>
          <p class="font-bold text-blue-600">
            {{ formatCurrency(summary.totalProfit ?? 0) }}
          </p>
        </div>
      </div>

      <div class="p-4 space-y-4">
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
