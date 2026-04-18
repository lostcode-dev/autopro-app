<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Clientes' })

interface CustomerOrder {
  id: string
  number: string | number
  entry_date: string
  status: string
  payment_status: string
  total_amount: number
}

interface CustomerDetail {
  client: { name: string, phone?: string, email?: string, document?: string }
  orders: CustomerOrder[]
  stats: { totalSpent: number, totalOrders: number, averageTicket: number }
}

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { dateFrom, dateTo } = useReportDateRange()
const search = ref('')
const page = ref(1)
const pageSize = 20
const orderStatusFilters = ref<string[]>([])
const paymentStatusFilters = ref<string[]>([])

const isDetailOpen = ref(false)
const detailLoading = ref(false)
const detailData = ref<CustomerDetail | null>(null)
const toast = useToast()

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

const statusColorMap: Record<string, string> = {
  estimate: 'neutral',
  open: 'info',
  in_progress: 'warning',
  waiting_for_part: 'warning',
  completed: 'success',
  delivered: 'success',
  cancelled: 'error'
}
const statusLabelMap: Record<string, string> = {
  estimate: 'Orçamento',
  open: 'Aberta',
  in_progress: 'Em andamento',
  waiting_for_part: 'Aguard. peça',
  completed: 'Concluída',
  delivered: 'Entregue',
  cancelled: 'Cancelada'
}
const paymentColorMap: Record<string, string> = { pending: 'warning', paid: 'success', partial: 'info' }
const paymentLabelMap: Record<string, string> = { pending: 'Pendente', paid: 'Pago', partial: 'Parcial' }

const { data, status } = await useAsyncData(
  () => `report-customers-${dateFrom.value}-${dateTo.value}-${page.value}-${search.value}-${orderStatusFilters.value.join(',')}-${paymentStatusFilters.value.join(',')}`,
  () => requestFetch<{ data: unknown }>('/api/reports/customers', {
    headers: requestHeaders,
    query: {
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      page: page.value,
      pageSize,
      searchTerm: search.value || undefined,
      orderStatusFilters: orderStatusFilters.value.length ? orderStatusFilters.value : undefined,
      paymentStatusFilters: paymentStatusFilters.value.length ? paymentStatusFilters.value : undefined,
    }
  }),
  { watch: [dateFrom, dateTo, page, search, orderStatusFilters, paymentStatusFilters] }
)

const items = computed(() => (data.value as { data?: { items?: unknown[] } })?.data?.items ?? [])
const summary = computed(() => (data.value as { data?: { summary?: Record<string, number> } })?.data?.summary ?? {})
const pagination = computed(() => (data.value as { data?: { pagination?: { totalItems: number } } })?.data?.pagination ?? null)

async function openDetail(clientId: string) {
  isDetailOpen.value = true
  detailLoading.value = true
  detailData.value = null
  try {
    const res = await $fetch<{ data: { selectedCustomerDetail: CustomerDetail } }>('/api/reports/customers', {
      query: { selectedClientId: clientId, skipList: 'true', dateFrom: dateFrom.value, dateTo: dateTo.value }
    })
    detailData.value = res.data?.selectedCustomerDetail ?? null
  }
  catch {
    toast.add({ title: 'Erro ao carregar detalhes do cliente', color: 'error' })
    isDetailOpen.value = false
  }
  finally {
    detailLoading.value = false
  }
}

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
  { id: 'lastVisit', header: 'Última visita' },
  { id: 'actions', header: '' }
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
            <UiDateRangePicker
              v-model:from="dateFrom"
              v-model:to="dateTo"
              class="w-full col-span-2"
            />
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
              { label: 'Total de OS', value: summary.totalOrders ?? 0, icon: 'i-lucide-clipboard-list', color: 'text-info', description: 'ordens finalizadas' }
            ]"
            :key="stat.label"
            :ui="{ body: 'p-3 sm:p-4' }"
          >
            <div class="flex items-start gap-3">
              <UIcon
                :name="stat.icon"
                :class="stat.color"
                class="mt-0.5 size-5 shrink-0"
              />
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
          :data="(items as Record<string, unknown>[])"
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
            <span class="font-medium">{{ formatCurrency(row.original.totalSpent as number) }}</span>
          </template>
          <template #totalPaid-cell="{ row }">
            {{ formatCurrency(row.original.totalPaid as number) }}
          </template>
          <template #averageTicket-cell="{ row }">
            {{ formatCurrency((row.original.averageTicket as number) ?? 0) }}
          </template>
          <template #lastVisit-cell="{ row }">
            {{ formatDate(row.original.lastVisit as string) }}
          </template>
          <template #actions-cell="{ row }">
            <UButton
              icon="i-lucide-eye"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="openDetail(row.original.id as string)"
            />
          </template>
        </AppDataTable>
      </div>

      <!-- Customer Detail Slideover -->
      <USlideover
        :open="isDetailOpen"
        side="right"
        :ui="{ content: 'max-w-xl' }"
        @update:open="isDetailOpen = $event"
      >
        <template #header>
          <div v-if="detailLoading">
            <USkeleton class="h-6 w-40" />
            <USkeleton class="mt-1 h-4 w-28" />
          </div>
          <div v-else-if="detailData">
            <h2 class="text-lg font-bold text-highlighted">
              {{ detailData.client?.name ?? '—' }}
            </h2>
            <p class="text-sm text-muted mt-0.5">
              Detalhes do cliente
            </p>
          </div>
        </template>

        <template #body>
          <div v-if="detailLoading" class="space-y-4 p-6">
            <USkeleton class="h-24 w-full rounded-xl" />
            <USkeleton class="h-16 w-full rounded-xl" />
            <USkeleton class="h-40 w-full rounded-xl" />
          </div>

          <div v-else-if="detailData" class="space-y-5 p-4">
            <!-- Contact info -->
            <UPageCard title="Informações de contato" variant="subtle">
              <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div v-if="detailData.client?.phone">
                  <dt class="text-muted">
                    Telefone
                  </dt>
                  <dd class="font-medium">
                    {{ detailData.client.phone }}
                  </dd>
                </div>
                <div v-if="detailData.client?.email">
                  <dt class="text-muted">
                    E-mail
                  </dt>
                  <dd class="font-medium">
                    {{ detailData.client.email }}
                  </dd>
                </div>
                <div v-if="detailData.client?.document">
                  <dt class="text-muted">
                    Documento
                  </dt>
                  <dd>
                    {{ detailData.client.document }}
                  </dd>
                </div>
              </dl>
            </UPageCard>

            <!-- KPI stats -->
            <div class="grid grid-cols-3 gap-3">
              <UPageCard variant="subtle" class="text-center">
                <p class="text-base font-bold text-highlighted">
                  {{ formatCurrency(detailData.stats.totalSpent) }}
                </p>
                <p class="text-xs text-muted mt-0.5">
                  Total gasto
                </p>
              </UPageCard>
              <UPageCard variant="subtle" class="text-center">
                <p class="text-base font-bold text-highlighted">
                  {{ detailData.stats.totalOrders }}
                </p>
                <p class="text-xs text-muted mt-0.5">
                  Ordens
                </p>
              </UPageCard>
              <UPageCard variant="subtle" class="text-center">
                <p class="text-base font-bold text-highlighted">
                  {{ formatCurrency(detailData.stats.averageTicket) }}
                </p>
                <p class="text-xs text-muted mt-0.5">
                  Ticket médio
                </p>
              </UPageCard>
            </div>

            <!-- Order history -->
            <UPageCard v-if="detailData.orders.length" title="Histórico de OS" variant="subtle">
              <div class="divide-y divide-default">
                <div
                  v-for="order in detailData.orders"
                  :key="order.id"
                  class="flex items-center gap-3 py-2.5 text-sm"
                >
                  <div class="flex-1 min-w-0">
                    <p class="font-medium leading-tight">
                      OS #{{ order.number }}
                    </p>
                    <p class="text-xs text-muted mt-0.5">
                      {{ formatDate(order.entry_date) }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <UBadge
                      :color="(statusColorMap[order.status] as 'neutral' | 'info' | 'warning' | 'success' | 'error') ?? 'neutral'"
                      :label="statusLabelMap[order.status] ?? order.status"
                      variant="subtle"
                      size="xs"
                    />
                    <UBadge
                      v-if="order.payment_status"
                      :color="(paymentColorMap[order.payment_status] as 'warning' | 'success' | 'info') ?? 'neutral'"
                      :label="paymentLabelMap[order.payment_status] ?? order.payment_status"
                      variant="soft"
                      size="xs"
                    />
                  </div>
                  <span class="text-sm font-semibold shrink-0 w-24 text-right">
                    {{ formatCurrency(order.total_amount) }}
                  </span>
                </div>
              </div>
            </UPageCard>

            <p v-else class="text-center text-sm text-muted py-4">
              Nenhuma ordem encontrada para este cliente no período.
            </p>
          </div>
        </template>
      </USlideover>
    </template>
  </UDashboardPanel>
</template>
