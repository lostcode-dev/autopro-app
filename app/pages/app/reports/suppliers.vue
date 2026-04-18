<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Fornecedores' })

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

const chartBars = [{ key: 'amount', label: 'Total comprado', color: '#60a5fa' }]

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
      <AppPageHeader title="Relatório de Fornecedores">
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
            Total em compras
          </p>
          <p class="font-bold">
            {{ formatCurrency(summary.totalPurchased ?? 0) }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Fornecedores ativos
          </p>
          <p class="font-bold">
            {{ summary.supplierCount ?? items.length }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Total de compras
          </p>
          <p class="font-bold">
            {{ summary.purchaseCount ?? 0 }}
          </p>
        </div>
      </div>

      <div class="p-4 space-y-4">
        <!-- Top suppliers chart -->
        <UPageCard v-if="chartData.length" variant="subtle">
          <template #header>
            <p class="text-sm font-semibold">
              Top fornecedores por volume
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
