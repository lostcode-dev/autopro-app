<script setup lang="ts">
import type { SortingState } from '@tanstack/vue-table'
import type { TagFilterOption } from '~/components/ui/TagFilter.vue'
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Comissões' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { can } = useWorkshopPermissions()
const toast = useToast()

const { dateFrom, dateTo, orderStatusFilters, paymentStatusFilters } = useReportDateRange()

// Filter state
const search = ref('')
const selectedEmployees = ref<string[]>([])
const commissionStatus = ref('all')
const recordType = ref('all')
const paymentMethods = ref<string[]>([])

// Pagination / sorting
const page = ref(1)
const pageSize = 20
const sorting = ref<SortingState>([{ id: 'reference_date', desc: true }])

const sortByMap: Record<string, string> = {
  employee_name: 'employee',
  reference_date: 'date',
  amount: 'amount',
  status_col: 'status',
}
const sortBy = computed(() => sortByMap[sorting.value[0]?.id ?? ''] ?? 'date')
const sortOrder = computed(() => (sorting.value[0]?.desc === false ? 'asc' : 'desc'))

// Selection for bulk pay
const selectedIds = ref<string[]>([])
const bulkPayOpen = ref(false)
const bankAccounts = ref<Array<{ id: string; account_name?: string; bank_name?: string }>>([])
const bulkPayLoading = ref(false)

// Delete confirm
const deleteTarget = ref<string | null>(null)
const deleteLoading = ref(false)

// Export
const exporting = ref<'csv' | 'pdf' | null>(null)

// Reset page on filter changes
watch(
  [dateFrom, dateTo, search, selectedEmployees, commissionStatus, recordType, orderStatusFilters, paymentStatusFilters, paymentMethods, sortBy, sortOrder],
  () => { page.value = 1 },
)

const queryKey = computed(() =>
  `rc-${dateFrom.value}-${dateTo.value}-${page.value}-${search.value}-${selectedEmployees.value.join(',')}-${commissionStatus.value}-${recordType.value}-${orderStatusFilters.value.join(',')}-${paymentStatusFilters.value.join(',')}-${paymentMethods.value.join(',')}-${sortBy.value}-${sortOrder.value}`,
)

const { data, status, refresh } = await useAsyncData(
  () => queryKey.value,
  () => requestFetch<{ data: any }>('/api/reports/commissions', {
    headers: requestHeaders,
    query: {
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      page: page.value,
      pageSize,
      searchTerm: search.value || undefined,
      employeeIds: selectedEmployees.value.length ? selectedEmployees.value : undefined,
      status: commissionStatus.value !== 'all' ? commissionStatus.value : undefined,
      recordType: recordType.value !== 'all' ? recordType.value : undefined,
      orderStatusFilters: orderStatusFilters.value.length ? orderStatusFilters.value : undefined,
      paymentStatusFilters: paymentStatusFilters.value.length ? paymentStatusFilters.value : undefined,
      paymentMethods: paymentMethods.value.length ? paymentMethods.value : undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
    },
  }),
  { watch: [queryKey] },
)

const items = computed(() => data.value?.data?.items ?? [])
const summary = computed(() => data.value?.data?.summary ?? {})
const pagination = computed(() => data.value?.data?.pagination ?? null)
const charts = computed(() => data.value?.data?.charts ?? { byEmployee: [], statusDistribution: [] })
const employees = computed(() => data.value?.data?.employees ?? [])

// Status maps
const orderStatusOptions: TagFilterOption[] = [
  { value: 'open', label: 'Aberta', color: 'info', icon: 'i-lucide-circle-dot' },
  { value: 'in_progress', label: 'Em andamento', color: 'warning', icon: 'i-lucide-wrench' },
  { value: 'waiting_for_part', label: 'Aguard. peça', color: 'warning', icon: 'i-lucide-package-search' },
  { value: 'completed', label: 'Concluída', color: 'success', icon: 'i-lucide-check-circle-2' },
  { value: 'delivered', label: 'Entregue', color: 'success', icon: 'i-lucide-truck' },
  { value: 'estimate', label: 'Orçamento', color: 'neutral', icon: 'i-lucide-file-text' },
]

const paymentStatusOptions: TagFilterOption[] = [
  { value: 'pending', label: 'Pendente', color: 'warning', icon: 'i-lucide-clock' },
  { value: 'paid', label: 'Pago', color: 'success', icon: 'i-lucide-circle-check' },
  { value: 'partial', label: 'Parcial', color: 'info', icon: 'i-lucide-split' },
]

const paymentMethodOptions: TagFilterOption[] = [
  { value: 'cash', label: 'Dinheiro', color: 'neutral', icon: 'i-lucide-banknote' },
  { value: 'pix', label: 'Pix', color: 'success', icon: 'i-lucide-zap' },
  { value: 'credit_card', label: 'Cartão Crédito', color: 'primary', icon: 'i-lucide-credit-card' },
  { value: 'debit_card', label: 'Cartão Débito', color: 'info', icon: 'i-lucide-credit-card' },
  { value: 'bank_transfer', label: 'Transferência', color: 'neutral', icon: 'i-lucide-landmark' },
  { value: 'no_payment_method', label: 'Sem pagamento', color: 'error', icon: 'i-lucide-ban' },
]

const commissionStatusColorMap: Record<string, string> = { pending: 'warning', paid: 'success', cancelled: 'error' }
const commissionStatusLabelMap: Record<string, string> = { pending: 'Pendente', paid: 'Pago', cancelled: 'Cancelado' }

const orderStatusColorMap: Record<string, string> = {
  open: 'info', in_progress: 'warning', waiting_for_part: 'warning',
  completed: 'success', delivered: 'success', estimate: 'neutral',
}
const orderStatusLabelMap: Record<string, string> = {
  open: 'Aberta', in_progress: 'Em andamento', waiting_for_part: 'Aguard. peça',
  completed: 'Concluída', delivered: 'Entregue', estimate: 'Orçamento',
}

const paymentStatusColorMap: Record<string, string> = { pending: 'warning', paid: 'success', partial: 'info' }
const paymentStatusLabelMap: Record<string, string> = { pending: 'Pendente', paid: 'Pago', partial: 'Parcial' }

// Columns
const canUpdate = computed(() => can(ActionCode.FINANCIAL_UPDATE))
const canDelete = computed(() => can(ActionCode.FINANCIAL_DELETE))

const columns = computed(() => [
  ...(canUpdate.value ? [{ id: 'select', header: '', enableSorting: false }] : []),
  { accessorKey: 'employee_name', header: 'Funcionário' },
  { accessorKey: 'order_number', header: 'OS', enableSorting: false },
  { accessorKey: 'reference_date', header: 'Referência' },
  { accessorKey: 'order_entry_date', header: 'Entrada OS', enableSorting: false },
  { id: 'order_status_col', header: 'Status OS', enableSorting: false },
  { id: 'order_payment_col', header: 'Pgto OS', enableSorting: false },
  { accessorKey: 'amount', header: 'Comissão' },
  { id: 'status_col', header: 'Status Com.' },
  ...(canUpdate.value || canDelete.value ? [{ id: 'actions', header: '', enableSorting: false }] : []),
])

// Helpers
function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(v: string) {
  if (!v) return '—'
  const [y, m, d] = v.split('-')
  return `${d}/${m}/${y}`
}

// Selection
const pendingItems = computed(() => items.value.filter((i: any) => i.status === 'pending'))

const allPendingSelected = computed(
  () => pendingItems.value.length > 0 && pendingItems.value.every((i: any) => selectedIds.value.includes(i.id)),
)

function toggleSelectAll() {
  if (allPendingSelected.value) {
    selectedIds.value = []
  }
  else {
    selectedIds.value = pendingItems.value.map((i: any) => i.id)
  }
}

function toggleSelectRow(id: string, status: string) {
  if (status !== 'pending') return
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter(v => v !== id)
  }
  else {
    selectedIds.value = [...selectedIds.value, id]
  }
}

// Bulk pay
const bulkPayItems = computed(() =>
  items.value
    .filter((i: any) => selectedIds.value.includes(i.id))
    .map((i: any) => ({
      id: i.id,
      employeeName: i.employee_name,
      osLabel: i.order_number ? `#${i.order_number}` : null,
      dateLabel: formatDate(i.reference_date),
      amount: i.amount,
    })),
)

const bulkPayTotal = computed(() =>
  bulkPayItems.value.reduce((sum: number, i: any) => sum + parseFloat(String(i.amount || 0)), 0),
)

async function openBulkPay() {
  if (!bankAccounts.value.length) {
    const res = await $fetch<{ data: { items: any[] } }>('/api/bank-accounts', { query: { is_active: 'true' } })
    bankAccounts.value = res.data?.items ?? []
  }
  bulkPayOpen.value = true
}

async function handleBulkPay(accountId: string) {
  bulkPayLoading.value = true
  try {
    await $fetch('/api/financial/pay-commissions-bulk', {
      method: 'POST',
      body: { registroIds: selectedIds.value, contaBancariaId: accountId },
    })
    toast.add({ title: 'Comissões pagas com sucesso!', color: 'success' })
    selectedIds.value = []
    bulkPayOpen.value = false
    await refresh()
  }
  catch {
    toast.add({ title: 'Erro ao pagar comissões', color: 'error' })
  }
  finally {
    bulkPayLoading.value = false
  }
}

// Row actions
async function payCommission(id: string) {
  try {
    await $fetch(`/api/reports/commissions/${id}/pay`, { method: 'POST' })
    toast.add({ title: 'Comissão marcada como paga!', color: 'success' })
    await refresh()
  }
  catch {
    toast.add({ title: 'Erro ao pagar comissão', color: 'error' })
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  const targetId = deleteTarget.value
  try {
    await $fetch(`/api/reports/commissions/${targetId}`, { method: 'DELETE' })
    toast.add({ title: 'Comissão excluída', color: 'success' })
    deleteTarget.value = null
    selectedIds.value = selectedIds.value.filter(id => id !== targetId)
    await refresh()
  }
  catch {
    toast.add({ title: 'Erro ao excluir comissão', color: 'error' })
  }
  finally {
    deleteLoading.value = false
  }
}

// Export
async function exportReport(format: 'csv' | 'pdf') {
  exporting.value = format
  try {
    const res = await $fetch<{ success: boolean; data: { fileName: string; contentType: string; base64: string } }>(
      '/api/reports/export-commissions',
      {
        method: 'POST',
        body: {
          format,
          dateFrom: dateFrom.value,
          dateTo: dateTo.value,
          employeeIds: selectedEmployees.value.length ? selectedEmployees.value : undefined,
          status: commissionStatus.value !== 'all' ? commissionStatus.value : undefined,
          recordType: recordType.value !== 'all' ? recordType.value : undefined,
          orderStatusFilters: orderStatusFilters.value.length ? orderStatusFilters.value : undefined,
          paymentStatusFilters: paymentStatusFilters.value.length ? paymentStatusFilters.value : undefined,
          paymentMethods: paymentMethods.value.length ? paymentMethods.value : undefined,
          searchTerm: search.value || undefined,
          sortBy: sortBy.value,
          sortOrder: sortOrder.value,
        },
      },
    )
    if (res.data?.base64) {
      const bstr = atob(res.data.base64)
      const bytes = new Uint8Array(bstr.length)
      for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i)!
      const blob = new Blob([bytes], { type: res.data.contentType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.data.fileName
      a.click()
      URL.revokeObjectURL(url)
    }
  }
  catch {
    toast.add({ title: 'Erro ao exportar relatório', color: 'error' })
  }
  finally {
    exporting.value = null
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Relatório de Comissões">
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-file-spreadsheet"
              label="CSV"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="exporting === 'csv'"
              @click="exportReport('csv')"
            />
            <UButton
              icon="i-lucide-file-text"
              label="PDF"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="exporting === 'pdf'"
              @click="exportReport('pdf')"
            />
          </div>
        </template>
      </AppPageHeader>
    </template>

    <template #body>
      <div class="space-y-4 p-4">
        <ReportsCommissionsFilters
          v-model:date-from="dateFrom"
          v-model:date-to="dateTo"
          v-model:search="search"
          v-model:selected-employees="selectedEmployees"
          v-model:commission-status="commissionStatus"
          v-model:record-type="recordType"
          v-model:order-status-filters="orderStatusFilters"
          v-model:payment-status-filters="paymentStatusFilters"
          v-model:payment-methods="paymentMethods"
          :employees="employees"
          :order-status-options="orderStatusOptions"
          :payment-status-options="paymentStatusOptions"
          :payment-method-options="paymentMethodOptions"
        />

        <ReportsCommissionsStats :summary="summary" />

        <ReportsCommissionsCharts
          :by-employee="charts.byEmployee"
          :status-distribution="charts.statusDistribution"
        />

        <!-- Bulk pay action bar -->
        <Transition
          enter-active-class="transition ease-out duration-150"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="selectedIds.length > 0 && canUpdate"
            class="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3"
          >
            <p class="text-sm font-medium text-highlighted">
              {{ selectedIds.length }} comissão{{ selectedIds.length !== 1 ? 'ões' : '' }}
              selecionada{{ selectedIds.length !== 1 ? 's' : '' }}
              — total {{ formatCurrency(bulkPayTotal) }}
            </p>
            <div class="flex items-center gap-2">
              <UButton label="Limpar" color="neutral" variant="ghost" size="sm" @click="selectedIds = []" />
              <UButton
                label="Pagar selecionadas"
                color="success"
                icon="i-lucide-credit-card"
                size="sm"
                @click="openBulkPay"
              />
            </div>
          </div>
        </Transition>

        <AppDataTable
          :columns="columns"
          :data="items as Record<string, unknown>[]"
          :loading="status === 'pending'"
          v-model:page="page"
          v-model:sorting="sorting"
          :page-size="pageSize"
          :total="pagination?.totalItems ?? items.length"
          :show-page-size-selector="false"
          empty-icon="i-lucide-badge-percent"
          empty-title="Nenhuma comissão encontrada"
          empty-description="Não há comissões registradas para o período selecionado."
        >
          <!-- Select all header -->
          <template #select-header>
            <UCheckbox
              :model-value="allPendingSelected"
              :disabled="pendingItems.length === 0"
              @update:model-value="toggleSelectAll"
            />
          </template>

          <!-- Select row cell -->
          <template #select-cell="{ row }">
            <UCheckbox
              v-if="(row.original as any).status === 'pending'"
              :model-value="selectedIds.includes((row.original as any).id)"
              @update:model-value="toggleSelectRow((row.original as any).id, (row.original as any).status)"
            />
          </template>

          <template #employee_name-cell="{ row }">
            <div class="flex items-center gap-2">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <span class="text-xs font-bold text-primary">
                  {{ String((row.original as any).employee_name ?? '?')[0]?.toUpperCase() }}
                </span>
              </div>
              <span class="truncate font-medium text-highlighted">{{ (row.original as any).employee_name }}</span>
            </div>
          </template>

          <template #order_number-cell="{ row }">
            <span v-if="(row.original as any).order_number" class="font-mono text-sm text-muted">
              #{{ (row.original as any).order_number }}
            </span>
            <span v-else class="text-muted">—</span>
          </template>

          <template #reference_date-cell="{ row }">
            {{ formatDate((row.original as any).reference_date) }}
          </template>

          <template #order_entry_date-cell="{ row }">
            {{ (row.original as any).order_entry_date ? formatDate((row.original as any).order_entry_date) : '—' }}
          </template>

          <template #order_status_col-cell="{ row }">
            <UBadge
              v-if="(row.original as any).order_status"
              :color="(orderStatusColorMap[(row.original as any).order_status] ?? 'neutral') as any"
              variant="subtle"
              :label="orderStatusLabelMap[(row.original as any).order_status] ?? String((row.original as any).order_status)"
              size="sm"
            />
            <span v-else class="text-sm text-muted">—</span>
          </template>

          <template #order_payment_col-cell="{ row }">
            <UBadge
              v-if="(row.original as any).order_payment_status"
              :color="(paymentStatusColorMap[(row.original as any).order_payment_status] ?? 'neutral') as any"
              variant="subtle"
              :label="paymentStatusLabelMap[(row.original as any).order_payment_status] ?? String((row.original as any).order_payment_status)"
              size="sm"
            />
            <span v-else class="text-sm text-muted">—</span>
          </template>

          <template #amount-cell="{ row }">
            <span class="font-bold text-success">{{ formatCurrency((row.original as any).amount) }}</span>
          </template>

          <template #status_col-cell="{ row }">
            <UBadge
              :color="(commissionStatusColorMap[(row.original as any).status] ?? 'neutral') as any"
              variant="subtle"
              :label="commissionStatusLabelMap[(row.original as any).status] ?? String((row.original as any).status)"
              size="sm"
            />
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-1">
              <UButton
                v-if="canUpdate && (row.original as any).status === 'pending'"
                icon="i-lucide-circle-check"
                color="success"
                variant="ghost"
                size="xs"
                title="Marcar como pago"
                @click="payCommission((row.original as any).id)"
              />
              <UButton
                v-if="canDelete"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                title="Excluir comissão"
                @click="deleteTarget = (row.original as any).id"
              />
            </div>
          </template>
        </AppDataTable>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Bulk pay modal -->
  <ReportsCommissionsBulkPayModal
    v-model:open="bulkPayOpen"
    :items="bulkPayItems"
    :total="bulkPayTotal"
    :accounts="bankAccounts"
    :loading="bulkPayLoading"
    @confirm="handleBulkPay"
  />

  <!-- Delete confirm modal -->
  <AppConfirmModal
    :open="deleteTarget !== null"
    title="Excluir comissão"
    description="Tem certeza que deseja excluir esta comissão? Esta ação não pode ser desfeita."
    confirm-label="Excluir"
    confirm-color="error"
    :loading="deleteLoading"
    @update:open="v => !v && (deleteTarget = null)"
    @confirm="confirmDelete"
  />
</template>