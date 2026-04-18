<script setup lang="ts">
import type { SortingState } from '@tanstack/vue-table'
import type { DebtorDetailData, DebtorPendingItem } from '~/components/reports/debtors/DebtorsDetailSlideover.vue'
import {
  debtorStatusColor,
  formatDebtorStatusLabel
} from '~/utils/report-debtors'

interface DebtorClient {
  id?: string
  name?: string | null
  phone?: string | null
  email?: string | null
}

interface DebtorReportItem {
  clientId: string
  clientName: string
  phone: string | null
  email: string | null
  totalOwed: number
  pendingItems: DebtorPendingItem[]
  daysOverdue: number
  earliestDue: string | null
  status: string
  client?: DebtorClient | null
}

interface DebtorOrderRow {
  rowId: string
  orderId: string | null
  orderNumber: string | null
  clientId: string
  clientName: string
  phone: string | null
  email: string | null
  totalOwed: number
  pendingItems: DebtorPendingItem[]
  daysOverdue: number
  earliestDue: string | null
  status: string
}

interface DebtorsTotals {
  total?: number
  overdue?: number
  current?: number
}

interface DebtorsPagination {
  totalItems?: number
}

interface DebtorsFilters {
  availableClients?: Array<{ value: string, label: string }>
}

interface DebtorsReportResponse {
  data?: {
    debtorsReport?: {
      filters?: DebtorsFilters
      items?: DebtorReportItem[]
      orderItems?: DebtorOrderRow[]
      totals?: DebtorsTotals
      counts?: { clients?: number, orders?: number }
      pagination?: DebtorsPagination | null
      sort?: { sortBy?: string, sortOrder?: string }
    }
  }
}

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Devedores' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { dateFrom, dateTo } = useReportDateRange()
const search = ref('')
const page = ref(1)
const pageSize = 20
const viewMode = ref<'clients' | 'orders'>('clients')
const clientIds = ref<string[]>([])
const statusFilters = ref<string[]>([])
const paymentMethodFilters = ref<string[]>([])
const orderStatusFilters = ref<string[]>(['completed'])
const detailOpen = ref(false)
const detailData = ref<DebtorDetailData | null>(null)

const sorting = ref<SortingState>([{ id: 'earliestDue', desc: false }])

const sortByMap: Record<string, string> = {
  clientName: 'client_name',
  totalOwed: 'total_owed',
  daysOverdue: 'days_overdue',
  earliestDue: 'earliest_due',
  status_col: 'status',
  orderNumber: 'order_number'
}

const sortBy = computed(() => sortByMap[sorting.value[0]?.id ?? ''] ?? 'earliest_due')
const sortOrder = computed(() => (sorting.value[0]?.desc === false ? 'asc' : 'desc'))

watch([dateFrom, dateTo, search, clientIds, statusFilters, paymentMethodFilters, orderStatusFilters, viewMode, sortBy, sortOrder], () => {
  page.value = 1
})

const queryKey = computed(() =>
  `report-debtors-${viewMode.value}-${page.value}-${search.value}-${dateFrom.value}-${dateTo.value}-${clientIds.value.join(',')}-${statusFilters.value.join(',')}-${paymentMethodFilters.value.join(',')}-${orderStatusFilters.value.join(',')}-${sortBy.value}-${sortOrder.value}`
)

const { data, status } = await useAsyncData(
  () => queryKey.value,
  () => requestFetch<DebtorsReportResponse>('/api/reports/debtors', {
    headers: requestHeaders,
    query: {
      viewMode: viewMode.value,
      page: page.value,
      pageSize,
      searchTerm: search.value || undefined,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      clientIds: clientIds.value.length ? clientIds.value : undefined,
      statusFilters: statusFilters.value.length ? statusFilters.value : undefined,
      paymentMethodFilters: paymentMethodFilters.value.length ? paymentMethodFilters.value : undefined,
      orderStatusFilters: orderStatusFilters.value.length ? orderStatusFilters.value : undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
    }
  }),
  { watch: [queryKey] }
)

const report = computed(() => data.value?.data?.debtorsReport)
const clientItems = computed<DebtorReportItem[]>(() => report.value?.items ?? [])
const orderItems = computed<DebtorOrderRow[]>(() => report.value?.orderItems ?? [])
const items = computed<Array<DebtorReportItem | DebtorOrderRow>>(() => (viewMode.value === 'clients' ? clientItems.value : orderItems.value))
const totals = computed<DebtorsTotals>(() => report.value?.totals ?? {})
const counts = computed(() => report.value?.counts ?? { clients: 0, orders: 0 })
const pagination = computed<DebtorsPagination | null>(() => report.value?.pagination ?? null)
const availableClients = computed(() => report.value?.filters?.availableClients ?? [])

const clientColumns = [
  { accessorKey: 'clientName', header: 'Cliente' },
  { id: 'pending_items', header: 'Itens', enableSorting: false },
  { accessorKey: 'earliestDue', header: 'Vencimento' },
  { accessorKey: 'totalOwed', header: 'Total devido' },
  { id: 'status_col', header: 'Status' },
  { id: 'actions', header: '', enableSorting: false }
]

const orderColumns = [
  { accessorKey: 'orderNumber', header: 'OS' },
  { accessorKey: 'clientName', header: 'Cliente' },
  { id: 'pending_items', header: 'Itens', enableSorting: false },
  { accessorKey: 'earliestDue', header: 'Vencimento' },
  { accessorKey: 'totalOwed', header: 'Total devido' },
  { id: 'status_col', header: 'Status' },
  { id: 'actions', header: '', enableSorting: false }
]

const columns = computed(() => (viewMode.value === 'clients' ? clientColumns : orderColumns))

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(v: string | null | undefined) {
  if (!v) return '—'
  const [year, month, day] = v.split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.charAt(0) ?? '?').toUpperCase()
  return ((parts[0]?.charAt(0) ?? '') + (parts[parts.length - 1]?.charAt(0) ?? '')).toUpperCase()
}

function openClientDetails(row: DebtorReportItem) {
  detailData.value = {
    mode: 'clients',
    clientId: row.clientId,
    clientName: row.clientName,
    phone: row.phone,
    email: row.email,
    status: row.status,
    daysOverdue: row.daysOverdue,
    totalOwed: row.totalOwed,
    earliestDue: row.earliestDue,
    pendingItems: row.pendingItems
  }
  detailOpen.value = true
}

function openOrderDetails(row: DebtorOrderRow) {
  detailData.value = {
    mode: 'orders',
    clientId: row.clientId,
    clientName: row.clientName,
    phone: row.phone,
    email: row.email,
    status: row.status,
    daysOverdue: row.daysOverdue,
    totalOwed: row.totalOwed,
    earliestDue: row.earliestDue,
    pendingItems: row.pendingItems,
    orderNumber: row.orderNumber,
    orderId: row.orderId
  }
  detailOpen.value = true
}

function handleOpenDetails(row: DebtorReportItem | DebtorOrderRow) {
  if (viewMode.value === 'clients') {
    openClientDetails(row as DebtorReportItem)
  } else {
    openOrderDetails(row as DebtorOrderRow)
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Relatório de Devedores" />
    </template>

    <template #body>
      <div class="space-y-4 p-4">
        <ReportsDebtorsFilters
          v-model:date-from="dateFrom"
          v-model:date-to="dateTo"
          v-model:client-ids="clientIds"
          v-model:status-filters="statusFilters"
          v-model:payment-method-filters="paymentMethodFilters"
          v-model:order-status-filters="orderStatusFilters"
          :clients="availableClients"
        />

        <ReportsDebtorsSummary
          :totals="totals"
          :counts="counts"
        />

        <AppDataTable
          v-model:page="page"
          v-model:sorting="sorting"
          v-model:search-term="search"
          :columns="columns"
          :data="items as Record<string, unknown>[]"
          :loading="status === 'pending'"
          :page-size="pageSize"
          :total="pagination?.totalItems ?? items.length"
          :show-page-size-selector="false"
          show-search
          search-placeholder="Buscar por nome, telefone ou e-mail..."
          empty-icon="i-lucide-badge-alert"
          empty-title="Nenhum devedor encontrado"
          empty-description="Ótimo! Não há pendências para os filtros selecionados."
          @search-change="page = 1"
        >
          <template #toolbar-right>
            <div class="flex items-center gap-2">
              <UTabs
                :model-value="viewMode"
                :items="[
                  { label: `Por cliente (${counts.clients ?? 0})`, value: 'clients' },
                  { label: `Por OS (${counts.orders ?? 0})`, value: 'orders' }
                ]"
                @update:model-value="value => viewMode = value as 'clients' | 'orders'"
              />
            </div>
          </template>

          <template #clientName-cell="{ row }">
            <div class="flex items-center gap-2">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span class="text-xs font-bold text-primary">
                  {{ getInitials(String(row.original.clientName ?? '')) }}
                </span>
              </div>
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ row.original.clientName }}
                </p>
                <p v-if="row.original.phone || row.original.email" class="truncate text-xs text-muted">
                  {{ row.original.phone || row.original.email }}
                </p>
              </div>
            </div>
          </template>

          <template #orderNumber-cell="{ row }">
            <span class="font-mono text-sm text-highlighted">
              #{{ row.original.orderNumber || '—' }}
            </span>
          </template>

          <template #pending_items-cell="{ row }">
            <UBadge
              color="info"
              variant="soft"
              size="xs"
              :label="String((row.original.pendingItems as unknown[] | undefined)?.length ?? 0)"
            />
          </template>

          <template #earliestDue-cell="{ row }">
            {{ formatDate(String(row.original.earliestDue ?? '')) }}
          </template>

          <template #totalOwed-cell="{ row }">
            <span class="font-medium text-error">{{ formatCurrency(Number(row.original.totalOwed ?? 0)) }}</span>
          </template>

          <template #status_col-cell="{ row }">
            <div class="flex items-center justify-start gap-2">
              <UBadge
                :color="debtorStatusColor(String(row.original.status ?? ''))"
                variant="subtle"
                :label="formatDebtorStatusLabel(String(row.original.status ?? ''))"
                size="xs"
              />
              <span v-if="Number(row.original.daysOverdue ?? 0) > 0" class="text-xs text-muted">
                {{ row.original.daysOverdue }} dia(s)
              </span>
            </div>
          </template>

          <template #actions-cell="{ row }">
            <UButton
              icon="i-lucide-eye"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="handleOpenDetails(row.original as DebtorReportItem | DebtorOrderRow)"
            />
          </template>
        </AppDataTable>
      </div>

      <ReportsDebtorsDetailSlideover
        :open="detailOpen"
        :loading="false"
        :data="detailData"
        @update:open="detailOpen = $event"
      />
    </template>
  </UDashboardPanel>
</template>
