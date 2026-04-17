<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { RowSelectionState, SortingState } from '@tanstack/table-core'
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Compras' })

type ViewMode = 'table' | 'card'
type PurchaseStatusFilter = 'all' | 'pending' | 'paid'

type SupplierOption = { id: string, name: string }
type BankAccountOption = { id: string, account_name?: string | null, name?: string | null }

type PurchaseItem = {
  id: string
  supplier_id: string
  bank_account_id: string
  purchase_date: string
  total_amount: number
  payment_status: 'pending' | 'paid'
  invoice_number: string | null
  payment_date: string | null
  due_date: string | null
  notes: string | null
  items: unknown[] | null
  suppliers?: { id: string, name: string } | null
}

type PurchasesResponse = {
  items: PurchaseItem[]
  total: number
  page: number
  page_size: number
}

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const MANAGED_QUERY_KEYS = [
  'search',
  'status',
  'dateFrom',
  'dateTo',
  'page',
  'pageSize',
  'view',
  'sortBy',
  'sortOrder'
] as const

const now = new Date()
const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
const defaultDateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const defaultDateTo = `${now.getFullYear()}-${currentMonth}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const route = useRoute()
const router = useRouter()

const canRead = computed(() => workshop.can(ActionCode.PURCHASES_READ))
const canCreate = computed(() => workshop.can(ActionCode.PURCHASES_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.PURCHASES_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.PURCHASES_DELETE))

function parsePage(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
}

function parsePageSize(value: unknown) {
  const parsed = Number(value)
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE
}

function parseView(value: unknown): ViewMode {
  return value === 'card' ? 'card' : 'table'
}

function parseStatus(value: unknown): PurchaseStatusFilter {
  return value === 'pending' || value === 'paid' ? value : 'all'
}

const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const debouncedSearch = ref(search.value)
const statusFilter = ref<PurchaseStatusFilter>(parseStatus(route.query.status))
const dateFrom = ref(typeof route.query.dateFrom === 'string' ? route.query.dateFrom : defaultDateFrom)
const dateTo = ref(typeof route.query.dateTo === 'string' ? route.query.dateTo : defaultDateTo)
const page = ref(parsePage(route.query.page))
const pageSize = ref(parsePageSize(route.query.pageSize))
const viewMode = ref<ViewMode>(parseView(route.query.view))

const DEFAULT_SORT = { id: 'purchase_date', desc: true }
const sorting = ref<SortingState>(
  typeof route.query.sortBy === 'string' && route.query.sortBy
    ? [{ id: route.query.sortBy, desc: route.query.sortOrder === 'desc' }]
    : [DEFAULT_SORT]
)

const requestQuery = computed(() => ({
  search: debouncedSearch.value || undefined,
  payment_status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
  date_from: dateFrom.value || undefined,
  date_to: dateTo.value || undefined,
  page: page.value,
  page_size: pageSize.value,
  sort_by: sorting.value[0]?.id || undefined,
  sort_order: sorting.value[0]?.desc ? 'desc' : 'asc'
}))

const { data, status, refresh } = await useAsyncData(
  () => `purchases-${debouncedSearch.value}-${statusFilter.value}-${dateFrom.value}-${dateTo.value}-${page.value}-${pageSize.value}-${sorting.value[0]?.id}-${sorting.value[0]?.desc}`,
  async () => {
    if (!canRead.value) {
      return {
        items: [],
        total: 0,
        page: 1,
        page_size: pageSize.value
      } satisfies PurchasesResponse
    }

    return requestFetch<PurchasesResponse>('/api/purchases', {
      headers: requestHeaders,
      query: requestQuery.value
    })
  },
  {
    watch: [requestQuery],
    default: () => ({
      items: [],
      total: 0,
      page: 1,
      page_size: pageSize.value
    })
  }
)

const { data: suppliersData } = await useAsyncData(
  'purchases-suppliers-options',
  () => requestFetch<{ items: SupplierOption[] }>('/api/suppliers', {
    headers: requestHeaders,
    query: { page: 1, page_size: 500, sort_by: 'name', sort_order: 'asc' }
  }),
  { default: () => ({ items: [] }) }
)

const { data: bankAccountsData } = await useAsyncData(
  'purchases-bank-accounts-options',
  () => requestFetch<{ items: BankAccountOption[] }>('/api/bank-accounts', {
    headers: requestHeaders,
    query: { is_active: 'true' }
  }),
  { default: () => ({ items: [] }) }
)

const purchaseItems = computed(() => data.value?.items ?? [])
const totalPurchases = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalPurchases.value / pageSize.value)))

const supplierOptions = computed(() =>
  (suppliersData.value.items ?? []).map(supplier => ({
    label: supplier.name,
    value: supplier.id
  }))
)

const bankAccountOptions = computed(() =>
  (bankAccountsData.value.items ?? []).map(account => ({
    label: account.account_name ?? account.name ?? 'Conta bancária',
    value: account.id
  }))
)

function buildManagedQuery() {
  return {
    search: search.value || undefined,
    status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
    dateFrom: dateFrom.value !== defaultDateFrom ? dateFrom.value : undefined,
    dateTo: dateTo.value !== defaultDateTo ? dateTo.value : undefined,
    page: page.value > 1 ? String(page.value) : undefined,
    pageSize: pageSize.value !== DEFAULT_PAGE_SIZE ? String(pageSize.value) : undefined,
    view: viewMode.value !== 'table' ? viewMode.value : undefined,
    sortBy: sorting.value[0]?.id || undefined,
    sortOrder: sorting.value[0]?.desc ? 'desc' : undefined
  }
}

async function syncQuery() {
  const nextQuery = Object.fromEntries(
    Object.entries(route.query).filter(
      ([key]) => !MANAGED_QUERY_KEYS.includes(key as (typeof MANAGED_QUERY_KEYS)[number])
    )
  ) as Record<string, string | string[] | undefined>

  Object.assign(nextQuery, buildManagedQuery())

  if (JSON.stringify(route.query) === JSON.stringify(nextQuery))
    return

  await router.replace({ query: nextQuery })
}

watch(
  () => route.query,
  (query) => {
    const nextSearch = typeof query.search === 'string' ? query.search : ''
    const nextStatus = parseStatus(query.status)
    const nextDateFrom = typeof query.dateFrom === 'string' ? query.dateFrom : defaultDateFrom
    const nextDateTo = typeof query.dateTo === 'string' ? query.dateTo : defaultDateTo
    const nextPage = parsePage(query.page)
    const nextPageSize = parsePageSize(query.pageSize)
    const nextView = parseView(query.view)

    if (search.value !== nextSearch) {
      search.value = nextSearch
      debouncedSearch.value = nextSearch
    }

    if (statusFilter.value !== nextStatus)
      statusFilter.value = nextStatus

    if (dateFrom.value !== nextDateFrom)
      dateFrom.value = nextDateFrom

    if (dateTo.value !== nextDateTo)
      dateTo.value = nextDateTo

    if (page.value !== nextPage)
      page.value = nextPage

    if (pageSize.value !== nextPageSize)
      pageSize.value = nextPageSize

    if (viewMode.value !== nextView)
      viewMode.value = nextView

    const nextSortBy = typeof query.sortBy === 'string' ? query.sortBy : ''
    const nextSortDesc = query.sortOrder === 'desc'
    const currentSort = sorting.value[0]

    if (nextSortBy) {
      if (!currentSort || currentSort.id !== nextSortBy || currentSort.desc !== nextSortDesc)
        sorting.value = [{ id: nextSortBy, desc: nextSortDesc }]
    } else if (!currentSort || currentSort.id !== DEFAULT_SORT.id || currentSort.desc !== DEFAULT_SORT.desc) {
      sorting.value = [DEFAULT_SORT]
    }
  }
)

watchDebounced(
  search,
  async (value) => {
    debouncedSearch.value = value
    page.value = 1
    await syncQuery()
  },
  { debounce: 300, maxWait: 800 }
)

watch(statusFilter, async () => {
  page.value = 1
  await syncQuery()
})

watch(dateFrom, async () => {
  page.value = 1
  await syncQuery()
})

watch(dateTo, async () => {
  page.value = 1
  await syncQuery()
})

watch(page, async () => {
  if (page.value > totalPages.value && totalPages.value > 0)
    page.value = totalPages.value

  await syncQuery()
})

watch(pageSize, async () => {
  page.value = 1
  await syncQuery()
})

watch(viewMode, syncQuery)

watch(sorting, async () => {
  page.value = 1
  await syncQuery()
})

function formatCurrency(value: number | string | undefined | null) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function formatDate(value: string | null | undefined) {
  if (!value)
    return '-'

  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T00:00:00`))
}

const paymentStatusOptions = [
  { label: 'Todos os status', value: 'all' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Pagas', value: 'paid' }
]

const paymentStatusFormOptions = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Pago', value: 'paid' }
]

const statusColorMap: Record<string, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  paid: 'success'
}

const statusLabelMap: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago'
}

const showPayModal = ref(false)
const isPaying = ref(false)
const selectedPurchaseForPay = ref<PurchaseItem | null>(null)
const payDate = ref('')

function openPayModal(purchase: PurchaseItem) {
  selectedPurchaseForPay.value = purchase
  payDate.value = new Date().toISOString().split('T')[0] || ''
  showPayModal.value = true
}

async function confirmPayment() {
  if (isPaying.value || !selectedPurchaseForPay.value)
    return

  isPaying.value = true

  try {
    await $fetch(`/api/purchases/${selectedPurchaseForPay.value.id}/pay`, {
      method: 'POST',
      body: { payment_date: payDate.value }
    })
    toast.add({ title: 'Pagamento confirmado', color: 'success' })
    showPayModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao confirmar pagamento',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isPaying.value = false
  }
}

const showModal = ref(false)
const selectedPurchase = ref<PurchaseItem | null>(null)
const isSaving = ref(false)
const isDeleting = ref(false)
const showDeleteModal = ref(false)
const showBulkDeleteModal = ref(false)
const purchasePendingDeletion = ref<PurchaseItem | null>(null)
const isBulkDeleting = ref(false)
const itemsJson = ref('[]')

const form = reactive({
  supplier_id: '',
  bank_account_id: '',
  purchase_date: new Date().toISOString().split('T')[0] || '',
  total_amount: '' as string | number,
  payment_status: 'pending',
  invoice_number: '',
  due_date: '',
  notes: ''
})

function resetForm() {
  Object.assign(form, {
    supplier_id: '',
    bank_account_id: '',
    purchase_date: new Date().toISOString().split('T')[0] || '',
    total_amount: '',
    payment_status: 'pending',
    invoice_number: '',
    due_date: '',
    notes: ''
  })
  itemsJson.value = '[]'
}

function openCreate() {
  selectedPurchase.value = null
  resetForm()
  showModal.value = true
}

function openEdit(purchase: PurchaseItem) {
  selectedPurchase.value = purchase
  Object.assign(form, {
    supplier_id: purchase.supplier_id ?? '',
    bank_account_id: purchase.bank_account_id ?? '',
    purchase_date: purchase.purchase_date ?? '',
    total_amount: purchase.total_amount ?? '',
    payment_status: purchase.payment_status ?? 'pending',
    invoice_number: purchase.invoice_number ?? '',
    due_date: purchase.due_date ?? '',
    notes: purchase.notes ?? ''
  })
  itemsJson.value = purchase.items ? JSON.stringify(purchase.items, null, 2) : '[]'
  showModal.value = true
}

async function save() {
  if (isSaving.value)
    return

  if (!form.supplier_id || !form.bank_account_id || !form.purchase_date || !form.total_amount) {
    toast.add({
      title: 'Preencha fornecedor, conta, data e valor total',
      color: 'warning'
    })
    return
  }

  let parsedItems: unknown[] = []
  try {
    parsedItems = JSON.parse(itemsJson.value)
  } catch {
    parsedItems = []
  }

  isSaving.value = true

  try {
    const body = {
      supplier_id: form.supplier_id,
      bank_account_id: form.bank_account_id,
      purchase_date: form.purchase_date,
      total_amount: Number(form.total_amount),
      payment_status: form.payment_status,
      invoice_number: form.invoice_number || null,
      due_date: form.due_date || null,
      notes: form.notes || null,
      items: parsedItems.length ? parsedItems : null
    }

    if (selectedPurchase.value?.id) {
      await $fetch(`/api/purchases/${selectedPurchase.value.id}`, {
        method: 'PUT',
        body
      })
      toast.add({ title: 'Compra atualizada', color: 'success' })
    } else {
      await $fetch('/api/purchases', {
        method: 'POST',
        body
      })
      toast.add({ title: 'Compra criada', color: 'success' })
    }

    showModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao salvar compra',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

function requestRemove(purchase: PurchaseItem) {
  if (isDeleting.value)
    return

  purchasePendingDeletion.value = purchase
  showDeleteModal.value = true
}

async function remove(purchase: PurchaseItem) {
  if (isDeleting.value)
    return

  isDeleting.value = true

  try {
    await $fetch(`/api/purchases/${purchase.id}`, { method: 'DELETE' })
    toast.add({ title: 'Compra removida', color: 'success' })
    showDeleteModal.value = false
    purchasePendingDeletion.value = null

    if (purchaseItems.value.length === 1 && page.value > 1)
      page.value -= 1

    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao remover compra',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

async function confirmRemove() {
  if (!purchasePendingDeletion.value)
    return

  await remove(purchasePendingDeletion.value)
}

const rowSelection = ref<RowSelectionState>({})
const selectedIds = computed(() =>
  Object.entries(rowSelection.value)
    .filter(([, value]) => value)
    .map(([id]) => id)
)
const selectedCount = computed(() => selectedIds.value.length)

watch(viewMode, () => {
  rowSelection.value = {}
})

async function confirmBulkDelete() {
  if (!selectedIds.value.length || isBulkDeleting.value)
    return

  isBulkDeleting.value = true

  try {
    await Promise.all(
      selectedIds.value.map(id => $fetch(`/api/purchases/${id}`, { method: 'DELETE' }))
    )

    toast.add({
      title: `${selectedIds.value.length} compra(s) removida(s)`,
      color: 'success'
    })

    rowSelection.value = {}
    showBulkDeleteModal.value = false
    await refresh()
  } catch {
    toast.add({
      title: 'Erro ao excluir compras',
      color: 'error'
    })
  } finally {
    isBulkDeleting.value = false
  }
}

const lineColumns = [
  { accessorKey: 'purchase_date', header: 'Data', enableSorting: true },
  { id: 'supplier', header: 'Fornecedor', enableSorting: false },
  { accessorKey: 'invoice_number', header: 'Nota fiscal', enableSorting: true },
  { accessorKey: 'total_amount', header: 'Total', enableSorting: true },
  { accessorKey: 'payment_status', header: 'Status', enableSorting: true },
  { id: 'actions', header: 'Ações', enableSorting: false }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Compras" />
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">
          Você não tem permissão para visualizar compras.
        </p>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="flex min-h-0 flex-1 flex-col p-4">
          <AppDataTable
            v-model:display-mode="viewMode"
            v-model:search-term="search"
            v-model:page="page"
            v-model:page-size="pageSize"
            v-model:sorting="sorting"
            v-model:row-selection="rowSelection"
            :columns="lineColumns"
            :data="purchaseItems"
            :loading="status === 'pending'"
            :loading-variant="viewMode === 'card' ? 'card' : 'row'"
            :selectable="viewMode === 'table'"
            :sticky-header="viewMode === 'table'"
            :get-row-id="(row) => String(row.id ?? '')"
            :page-size-options="PAGE_SIZE_OPTIONS"
            :total="totalPurchases"
            search-placeholder="Buscar por nota fiscal ou observações..."
            :show-search="true"
            :show-view-mode-toggle="true"
            card-grid-class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2"
            empty-icon="i-lucide-shopping-cart"
            empty-title="Nenhuma compra encontrada"
            empty-description="Cadastre compras ou ajuste os filtros para continuar."
          >
            <template #toolbar-right>
              <UTooltip
                v-if="canDelete"
                :text="selectedCount > 0 ? `Excluir ${selectedCount} selecionado(s)` : 'Excluir seleção'"
              >
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="outline"
                  size="sm"
                  :disabled="selectedCount === 0"
                  @click="showBulkDeleteModal = true"
                />
              </UTooltip>

              <UButton
                v-if="canCreate"
                label="Nova compra"
                icon="i-lucide-plus"
                size="sm"
                @click="openCreate"
              />
            </template>

            <template #filters>
              <USelectMenu
                v-model="statusFilter"
                :items="paymentStatusOptions"
                value-key="value"
                class="w-full sm:w-48"
                :search-input="false"
              />

              <UInput v-model="dateFrom" type="date" class="w-full sm:w-40" />
              <UInput v-model="dateTo" type="date" class="w-full sm:w-40" />
            </template>

            <template #purchase_date-cell="{ row }">
              <span class="text-sm text-muted">
                {{ formatDate(row.original.purchase_date) }}
              </span>
            </template>

            <template #supplier-cell="{ row }">
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ row.original.suppliers?.name || 'Fornecedor não informado' }}
                </p>
              </div>
            </template>

            <template #total_amount-cell="{ row }">
              <span class="text-sm text-muted">
                {{ formatCurrency(row.original.total_amount) }}
              </span>
            </template>

            <template #payment_status-cell="{ row }">
              <UBadge
                :label="statusLabelMap[row.original.payment_status] || row.original.payment_status"
                :color="statusColorMap[row.original.payment_status] || 'neutral'"
                variant="subtle"
                size="xs"
              />
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-2">
                <UButton
                  v-if="canUpdate && row.original.payment_status === 'pending'"
                  icon="i-lucide-check-circle"
                  color="success"
                  variant="ghost"
                  size="xs"
                  @click="openPayModal(row.original as PurchaseItem)"
                />

                <UButton
                  v-if="canUpdate"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="openEdit(row.original as PurchaseItem)"
                />

                <UButton
                  v-if="canDelete"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :loading="isDeleting"
                  @click="requestRemove(row.original as PurchaseItem)"
                />
              </div>
            </template>
          </AppDataTable>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="showPayModal" title="Confirmar pagamento">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Confirme o pagamento de
          <strong>{{ formatCurrency(selectedPurchaseForPay?.total_amount) }}</strong>
          para
          <strong>{{ selectedPurchaseForPay?.suppliers?.name || 'fornecedor' }}</strong>.
        </p>

        <UFormField label="Data de pagamento">
          <UInput v-model="payDate" type="date" class="w-full" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="showPayModal = false"
        />
        <UButton
          label="Confirmar pagamento"
          color="success"
          :loading="isPaying"
          :disabled="isPaying"
          @click="confirmPayment"
        />
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="showModal"
    :title="selectedPurchase ? 'Editar compra' : 'Nova compra'"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Fornecedor" required class="sm:col-span-2">
            <USelectMenu
              v-model="form.supplier_id"
              :items="supplierOptions"
              value-key="value"
              class="w-full"
              searchable
            />
          </UFormField>

          <UFormField label="Conta bancária" required class="sm:col-span-2">
            <USelectMenu
              v-model="form.bank_account_id"
              :items="bankAccountOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Data da compra" required>
            <UInput v-model="form.purchase_date" type="date" class="w-full" />
          </UFormField>

          <UFormField label="Vencimento">
            <UInput v-model="form.due_date" type="date" class="w-full" />
          </UFormField>

          <UFormField label="Valor total" required>
            <UInput
              v-model="form.total_amount"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Status">
            <USelectMenu
              v-model="form.payment_status"
              :items="paymentStatusFormOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Nota fiscal" class="sm:col-span-2">
            <UInput v-model="form.invoice_number" class="w-full" />
          </UFormField>

          <UFormField label="Itens (JSON)" class="sm:col-span-2">
            <UTextarea v-model="itemsJson" :rows="6" class="w-full font-mono text-xs" />
          </UFormField>

          <UFormField label="Observações" class="sm:col-span-2">
            <UTextarea v-model="form.notes" class="w-full" :rows="3" />
          </UFormField>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="showModal = false"
        />
        <UButton
          label="Salvar"
          :loading="isSaving"
          :disabled="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>

  <AppConfirmModal
    v-model:open="showDeleteModal"
    title="Confirmar exclusão"
    confirm-label="Excluir compra"
    confirm-color="error"
    :loading="isDeleting"
    @confirm="confirmRemove"
    @update:open="
      (value: boolean) => {
        showDeleteModal = value
        if (!value && !isDeleting) purchasePendingDeletion = null
      }
    "
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir a compra
        <strong class="text-highlighted">
          {{ purchasePendingDeletion?.invoice_number || purchasePendingDeletion?.suppliers?.name || 'selecionada' }}
        </strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>

  <AppConfirmModal
    v-model:open="showBulkDeleteModal"
    title="Excluir compras selecionadas"
    confirm-label="Excluir todas"
    confirm-color="error"
    :loading="isBulkDeleting"
    @confirm="confirmBulkDelete"
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir
        <strong class="text-highlighted">{{ selectedCount }} compra(s)</strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>
</template>
