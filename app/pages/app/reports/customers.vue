<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Clientes' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { dateFrom, dateTo } = useReportDateRange()
const search = ref('')
const page = ref(1)
const pageSize = 20
const selectedClientId = ref<string | null>(null)
const orderStatusFilters = ref<string[]>([])
const paymentStatusFilters = ref<string[]>([])

const orderStatusOptions = [
  { value: 'open', label: 'Aberta', color: 'info' as const, icon: 'i-lucide-circle-dot' },
  { value: 'in_progress', label: 'Em andamento', color: 'warning' as const, icon: 'i-lucide-wrench' },
  { value: 'waiting_for_part', label: 'Aguard. peça', color: 'warning' as const, icon: 'i-lucide-package-search' },
  { value: 'completed', label: 'Concluída', color: 'success' as const, icon: 'i-lucide-check-circle-2' },
  { value: 'delivered', label: 'Entregue', color: 'success' as const, icon: 'i-lucide-truck' },
  { value: 'estimate', label: 'Orçamento', color: 'neutral' as const, icon: 'i-lucide-file-text' },
]

const paymentStatusOptions = [
  { value: 'pending', label: 'Pendente', color: 'warning' as const, icon: 'i-lucide-clock' },
  { value: 'paid', label: 'Pago', color: 'success' as const, icon: 'i-lucide-circle-check' },
  { value: 'partial', label: 'Parcial', color: 'info' as const, icon: 'i-lucide-split' },
]

const { data, status } = await useAsyncData(
  () => `report-customers-${dateFrom.value}-${dateTo.value}-${page.value}-${search.value}-${orderStatusFilters.value.join(',')}-${paymentStatusFilters.value.join(',')}`,
  () => requestFetch<{ data: any }>('/api/reports/customers', {
    headers: requestHeaders,
    query: {
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      page: page.value,
      pageSize,
      searchTerm: search.value || undefined,
      selectedClientId: selectedClientId.value || undefined,
      orderStatusFilters: orderStatusFilters.value.length ? orderStatusFilters.value : undefined,
      paymentStatusFilters: paymentStatusFilters.value.length ? paymentStatusFilters.value : undefined,
    }
  }),
  { watch: [dateFrom, dateTo, page, search, orderStatusFilters, paymentStatusFilters] }
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
      <AppPageHeader title="Relatório de Clientes" />
    </template>

    <template #body>
      <div class="space-y-4 p-4">
        <!-- Filter card -->
        <UCard :ui="{ body: 'p-3' }">
          <div class="grid grid-cols-2 gap-2 sm:gap-3">
            <div class="flex items-center gap-2 shrink-0 text-muted col-span-2">
              <UIcon name="i-lucide-filter" class="size-4" />
              <span class="text-sm font-medium">Filtros</span>
            </div>
            <UiDateRangePicker v-model:from="dateFrom" v-model:to="dateTo" class="w-full col-span-2" />
            
            <UiTagFilter
              v-model="orderStatusFilters"
              :options="orderStatusOptions"
              placeholder="Status da OS"
              class="w-full"
            />

            <UiTagFilter
              v-model="paymentStatusFilters"
              :options="paymentStatusOptions"
              placeholder="Pagamento"
              class="w-full"
            />
          </div>
        </UCard>
        <!-- Summary cards -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <UCard
          v-for="stat in [
            { label: 'Receita total', value: formatCurrency(summary.totalRevenue ?? 0), icon: 'i-lucide-trending-up', color: 'text-success', description: 'no período' },
            { label: 'Clientes ativos', value: summary.totalActiveClients ?? 0, icon: 'i-lucide-users', color: 'text-primary', description: 'com movimentação' },
            { label: 'Total de OS', value: summary.totalOrders ?? 0, icon: 'i-lucide-clipboard-list', color: 'text-info', description: 'ordens finalizadas' },
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
          empty-icon="i-lucide-users"
          empty-title="Nenhum cliente encontrado"
          empty-description="Não há clientes com movimentação no período selecionado."
          @search-change="page = 1"
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
        </AppDataTable>
      </div>
    </template>
  </UDashboardPanel>
</template>


