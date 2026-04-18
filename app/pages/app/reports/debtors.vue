<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Inadimplentes' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const search = ref('')
const page = ref(1)
const pageSize = 20

const { data, status } = await useAsyncData(
  () => `report-debtors-${page.value}-${search.value}`,
  () => requestFetch<{ data: any }>('/api/reports/debtors', {
    headers: requestHeaders,
    query: { page: page.value, pageSize, searchTerm: search.value || undefined }
  }),
  { watch: [page, search] }
)

const items = computed(() => data.value?.data?.debtorsReport?.items ?? [])
const totals = computed(() => data.value?.data?.debtorsReport?.totals ?? {})
const pagination = computed(() => data.value?.data?.debtorsReport?.pagination ?? null)

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDate(v: string) {
  if (!v) return '—'
  const [y, m, d] = v.split('-')
  return `${d}/${m}/${y}`
}

const columns = [
  { accessorKey: 'clientName', header: 'Cliente' },
  { accessorKey: 'phone', header: 'Telefone' },
  { id: 'pendingAmount', header: 'Valor pendente' },
  { accessorKey: 'ordersCount', header: 'OS' },
  { id: 'lastOrderDate', header: 'Última OS' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Inadimplentes" />
    </template>

    <template #body>
      <div class="grid grid-cols-2 divide-x divide-default border-b border-default text-center text-sm py-3">
        <div>
          <p class="text-muted text-xs">
            Total em aberto
          </p>
          <p class="font-bold text-red-500">
            {{ formatCurrency(totals.totalPending ?? 0) }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Clientes inadimplentes
          </p>
          <p class="font-bold">
            {{ totals.clientCount ?? 0 }}
          </p>
        </div>
      </div>

      <div class="p-4">
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
          search-placeholder="Buscar cliente..."
          empty-icon="i-lucide-circle-check"
          empty-title="Nenhum inadimplente encontrado"
          empty-description="Ótimo! Não há clientes com pagamentos pendentes."
          @search-change="page = 1"
        >
          <template #pendingAmount-cell="{ row }">
            <span class="font-medium text-red-500">{{ formatCurrency(row.original.pendingAmount ?? row.original.totalPending ?? 0) }}</span>
          </template>
          <template #lastOrderDate-cell="{ row }">
            {{ formatDate(row.original.lastOrderDate ?? row.original.lastVisit) }}
          </template>
        </AppDataTable>
      </div>
    </template>
  </UDashboardPanel>
</template>

