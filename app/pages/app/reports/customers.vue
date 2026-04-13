<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Clientes' })

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
const selectedClientId = ref<string | null>(null)

const { data, status } = await useAsyncData(
  () => `report-customers-${dateFrom.value}-${dateTo.value}-${page.value}-${search.value}`,
  () => requestFetch<{ data: any }>('/api/reports/customers', {
    headers: requestHeaders,
    query: {
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      page: page.value,
      pageSize,
      searchTerm: search.value || undefined,
      selectedClientId: selectedClientId.value || undefined
    }
  }),
  { watch: [dateFrom, dateTo, page, search] }
)

const items = computed(() => data.value?.data?.items ?? [])
const summary = computed(() => data.value?.data?.summary ?? {})
const pagination = computed(() => data.value?.data?.pagination ?? null)

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDate(v: string) {
  if (!v) return '—'
  const [y, m, d] = v.split('-')
  return `${d}/${m}/${y}`
}

const columns = [
  { accessorKey: 'name', header: 'Cliente' },
  { id: 'totalSpent', header: 'Total gasto' },
  { id: 'totalPaid', header: 'Total pago' },
  { accessorKey: 'totalOrders', header: 'OS' },
  { id: 'averageTicket', header: 'Ticket médio' },
  { id: 'lastVisit', header: 'Última visita' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Relatório de Clientes">
        <template #leading>
          <AppSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UInput
              v-model="dateFrom"
              type="date"
              size="sm"
              class="w-36"
            />
            <span class="text-muted text-sm">até</span>
            <UInput
              v-model="dateTo"
              type="date"
              size="sm"
              class="w-36"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Summary -->
      <div class="grid grid-cols-3 divide-x divide-default border-b border-default text-center text-sm py-3">
        <div>
          <p class="text-muted text-xs">
            Receita total
          </p>
          <p class="font-bold">
            {{ formatCurrency(summary.totalRevenue ?? 0) }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Clientes ativos
          </p>
          <p class="font-bold">
            {{ summary.totalActiveClients ?? 0 }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Total de OS
          </p>
          <p class="font-bold">
            {{ summary.totalOrders ?? 0 }}
          </p>
        </div>
      </div>

      <!-- Search -->
      <div class="p-4 border-b border-default">
        <UInput
          v-model="search"
          placeholder="Buscar cliente..."
          icon="i-lucide-search"
          class="w-72"
          @update:model-value="page = 1"
        />
      </div>

      <div v-if="status === 'pending'" class="p-4 space-y-3">
        <USkeleton v-for="i in 8" :key="i" class="h-10 w-full" />
      </div>

      <UTable
        v-else
        :columns="columns"
        :data="items"
        class="min-h-0 flex-1"
      >
        <template #totalSpent-cell="{ row }">
          <span class="font-medium">{{ formatCurrency(row.original.totalSpent) }}</span>
        </template>
        <template #totalPaid-cell="{ row }">
          {{ formatCurrency(row.original.totalPaid) }}
        </template>
        <template #averageTicket-cell="{ row }">
          {{ formatCurrency(row.original.averageTicket ?? 0) }}
        </template>
        <template #lastVisit-cell="{ row }">
          {{ formatDate(row.original.lastVisit) }}
        </template>
      </UTable>

      <div v-if="pagination && pagination.totalPages > 1" class="flex justify-center p-4 border-t border-default">
        <UPagination v-model="page" :page-count="pageSize" :total="pagination.totalItems" />
      </div>
    </template>
  </UDashboardPanel>
</template>
