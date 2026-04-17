<script setup lang="ts">
import type { RowSelectionState, SortingState } from '@tanstack/table-core'
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Devoluções' })

type ViewMode = 'table' | 'card'
type ReturnStatusFilter = 'all' | 'pending' | 'completed'
type ReturnReasonFilter = 'all' | 'warranty' | 'wrong_part' | 'manufacturing_defect' | 'damaged_product' | 'incompatible' | 'other'

type PurchaseOption = {
  id: string
  supplier_id: string
  suppliers?: { name: string } | null
  invoice_number?: string | null
  purchase_date?: string | null
}

type PurchaseReturnItem = {
  id: string
  purchase_id: string
  supplier_id: string
  return_date: string
  reason: Exclude<ReturnReasonFilter, 'all'>
  status: Exclude<ReturnStatusFilter, 'all'>
  total_returned_amount: number
  notes: string | null
  returned_items: unknown[] | null
  suppliers?: { id: string, name: string } | null
}

type PurchaseReturnsResponse = {
  items: PurchaseReturnItem[]
  total: number
  page: number
  page_size: number
}

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const MANAGED_QUERY_KEYS = ['status', 'reason', 'page', 'pageSize', 'view', 'sortBy', 'sortOrder'] as const

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const route = useRoute()
const router = useRouter()

const canRead = computed(() => workshop.can(ActionCode.RETURNS_READ))
const canCreate = computed(() => workshop.can(ActionCode.RETURNS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.RETURNS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.RETURNS_DELETE))

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

function parseStatus(value: unknown): ReturnStatusFilter {
  return value === 'pending' || value === 'completed' ? value : 'all'
}

function parseReason(value: unknown): ReturnReasonFilter {
  return value === 'warranty'
    || value === 'wrong_part'
    || value === 'manufacturing_defect'
    || value === 'damaged_product'
    || value === 'incompatible'
    || value === 'other'
    ? value
    : 'all'
}

const statusFilter = ref<ReturnStatusFilter>(parseStatus(route.query.status))
const reasonFilter = ref<ReturnReasonFilter>(parseReason(route.query.reason))
const page = ref(parsePage(route.query.page))
const pageSize = ref(parsePageSize(route.query.pageSize))
const viewMode = ref<ViewMode>(parseView(route.query.view))

const DEFAULT_SORT = { id: 'return_date', desc: true }
const sorting = ref<SortingState>(
  typeof route.query.sortBy === 'string' && route.query.sortBy
    ? [{ id: route.query.sortBy, desc: route.query.sortOrder === 'desc' }]
    : [DEFAULT_SORT]
)

const requestQuery = computed(() => ({
  status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
  reason: reasonFilter.value !== 'all' ? reasonFilter.value : undefined,
  page: page.value,
  page_size: pageSize.value,
  sort_by: sorting.value[0]?.id || undefined,
  sort_order: sorting.value[0]?.desc ? 'desc' : 'asc'
}))

const { data, status, refresh } = await useAsyncData(
  () => `purchase-returns-${statusFilter.value}-${reasonFilter.value}-${page.value}-${pageSize.value}-${sorting.value[0]?.id}-${sorting.value[0]?.desc}`,
  async () => {
    if (!canRead.value) {
      return {
        items: [],
        total: 0,
        page: 1,
        page_size: pageSize.value
      } satisfies PurchaseReturnsResponse
    }

    return requestFetch<PurchaseReturnsResponse>('/api/purchase-returns', {
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

const { data: purchasesData } = await useAsyncData(
  'purchase-returns-purchases-options',
  () => requestFetch<{ items: PurchaseOption[] }>('/api/purchases', {
    headers: requestHeaders,
    query: { page: 1, page_size: 300, sort_by: 'purchase_date', sort_order: 'desc' }
  }),
  { default: () => ({ items: [] }) }
)

const purchaseReturnItems = computed(() => data.value?.items ?? [])
const totalReturns = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalReturns.value / pageSize.value)))

const purchaseOptions = computed(() =>
  (purchasesData.value.items ?? []).map(purchase => ({
    label: [
      purchase.suppliers?.name,
      purchase.invoice_number,
      purchase.purchase_date
    ].filter(Boolean).join(' - '),
    value: purchase.id,
    supplier_id: purchase.supplier_id
  }))
)

function buildManagedQuery() {
  return {
    status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
    reason: reasonFilter.value !== 'all' ? reasonFilter.value : undefined,
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
    const nextStatus = parseStatus(query.status)
    const nextReason = parseReason(query.reason)
    const nextPage = parsePage(query.page)
    const nextPageSize = parsePageSize(query.pageSize)
    const nextView = parseView(query.view)

    if (statusFilter.value !== nextStatus)
      statusFilter.value = nextStatus

    if (reasonFilter.value !== nextReason)
      reasonFilter.value = nextReason

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

watch(statusFilter, async () => {
  page.value = 1
  await syncQuery()
})

watch(reasonFilter, async () => {
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

const statusFilterOptions = [
  { label: 'Todos os status', value: 'all' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Concluídas', value: 'completed' }
]

const statusFormOptions = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Concluída', value: 'completed' }
]

const reasonFilterOptions = [
  { label: 'Todos os motivos', value: 'all' },
  { label: 'Garantia', value: 'warranty' },
  { label: 'Peça errada', value: 'wrong_part' },
  { label: 'Defeito de fabricação', value: 'manufacturing_defect' },
  { label: 'Produto danificado', value: 'damaged_product' },
  { label: 'Incompatível', value: 'incompatible' },
  { label: 'Outros', value: 'other' }
]

const reasonFormOptions = reasonFilterOptions.filter(option => option.value !== 'all')

const statusColorMap: Record<string, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  completed: 'success'
}

const statusLabelMap: Record<string, string> = {
  pending: 'Pendente',
  completed: 'Concluída'
}

const reasonLabelMap: Record<string, string> = {
  warranty: 'Garantia',
  wrong_part: 'Peça errada',
  manufacturing_defect: 'Defeito de fabricação',
  damaged_product: 'Produto danificado',
  incompatible: 'Incompatível',
  other: 'Outros'
}

const showModal = ref(false)
const selectedReturn = ref<PurchaseReturnItem | null>(null)
const isSaving = ref(false)
const isDeleting = ref(false)
const showDeleteModal = ref(false)
const showBulkDeleteModal = ref(false)
const returnPendingDeletion = ref<PurchaseReturnItem | null>(null)
const isBulkDeleting = ref(false)
const returnedItemsJson = ref('[]')

const form = reactive({
  purchase_id: '',
  supplier_id: '',
  return_date: new Date().toISOString().split('T')[0] || '',
  reason: 'other',
  status: 'pending',
  total_returned_amount: '' as string | number,
  notes: ''
})

watch(() => form.purchase_id, (purchaseId) => {
  const purchase = purchaseOptions.value.find(option => option.value === purchaseId)
  if (purchase)
    form.supplier_id = purchase.supplier_id
})

function resetForm() {
  Object.assign(form, {
    purchase_id: '',
    supplier_id: '',
    return_date: new Date().toISOString().split('T')[0] || '',
    reason: 'other',
    status: 'pending',
    total_returned_amount: '',
    notes: ''
  })
  returnedItemsJson.value = '[]'
}

function openCreate() {
  selectedReturn.value = null
  resetForm()
  showModal.value = true
}

function openEdit(item: PurchaseReturnItem) {
  selectedReturn.value = item
  Object.assign(form, {
    purchase_id: item.purchase_id ?? '',
    supplier_id: item.supplier_id ?? '',
    return_date: item.return_date ?? '',
    reason: item.reason ?? 'other',
    status: item.status ?? 'pending',
    total_returned_amount: item.total_returned_amount ?? '',
    notes: item.notes ?? ''
  })
  returnedItemsJson.value = item.returned_items ? JSON.stringify(item.returned_items, null, 2) : '[]'
  showModal.value = true
}

async function save() {
  if (isSaving.value)
    return

  if (!form.purchase_id || !form.return_date || !form.total_returned_amount) {
    toast.add({
      title: 'Preencha compra, data e valor total da devolução',
      color: 'warning'
    })
    return
  }

  let parsedItems: unknown[] = []
  try {
    parsedItems = JSON.parse(returnedItemsJson.value)
  } catch {
    parsedItems = []
  }

  isSaving.value = true

  try {
    const body = {
      purchase_id: form.purchase_id,
      supplier_id: form.supplier_id,
      return_date: form.return_date,
      reason: form.reason,
      status: form.status,
      total_returned_amount: Number(form.total_returned_amount),
      returned_items: parsedItems,
      notes: form.notes || null
    }

    if (selectedReturn.value?.id) {
      await $fetch(`/api/purchase-returns/${selectedReturn.value.id}`, {
        method: 'PUT',
        body
      })
      toast.add({ title: 'Devolução atualizada', color: 'success' })
    } else {
      await $fetch('/api/purchase-returns', {
        method: 'POST',
        body
      })
      toast.add({ title: 'Devolução registrada', color: 'success' })
    }

    showModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao salvar devolução',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

function requestRemove(item: PurchaseReturnItem) {
  if (isDeleting.value)
    return

  returnPendingDeletion.value = item
  showDeleteModal.value = true
}

async function remove(item: PurchaseReturnItem) {
  if (isDeleting.value)
    return

  isDeleting.value = true

  try {
    await $fetch(`/api/purchase-returns/${item.id}`, { method: 'DELETE' })
    toast.add({ title: 'Devolução removida', color: 'success' })
    showDeleteModal.value = false
    returnPendingDeletion.value = null

    if (purchaseReturnItems.value.length === 1 && page.value > 1)
      page.value -= 1

    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao remover devolução',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

async function confirmRemove() {
  if (!returnPendingDeletion.value)
    return

  await remove(returnPendingDeletion.value)
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
      selectedIds.value.map(id => $fetch(`/api/purchase-returns/${id}`, { method: 'DELETE' }))
    )

    toast.add({
      title: `${selectedIds.value.length} devolução(ões) removida(s)`,
      color: 'success'
    })

    rowSelection.value = {}
    showBulkDeleteModal.value = false
    await refresh()
  } catch {
    toast.add({
      title: 'Erro ao excluir devoluções',
      color: 'error'
    })
  } finally {
    isBulkDeleting.value = false
  }
}

const lineColumns = [
  { accessorKey: 'return_date', header: 'Data', enableSorting: true },
  { id: 'supplier', header: 'Fornecedor', enableSorting: false },
  { accessorKey: 'reason', header: 'Motivo', enableSorting: true },
  { accessorKey: 'total_returned_amount', header: 'Valor', enableSorting: true },
  { accessorKey: 'status', header: 'Status', enableSorting: true },
  { id: 'actions', header: 'Ações', enableSorting: false }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Devoluções" />
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">
          Você não tem permissão para visualizar devoluções.
        </p>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="flex min-h-0 flex-1 flex-col p-4">
          <AppDataTable
            v-model:display-mode="viewMode"
            v-model:page="page"
            v-model:page-size="pageSize"
            v-model:sorting="sorting"
            v-model:row-selection="rowSelection"
            :columns="lineColumns"
            :data="purchaseReturnItems"
            :loading="status === 'pending'"
            :loading-variant="viewMode === 'card' ? 'card' : 'row'"
            :selectable="viewMode === 'table'"
            :sticky-header="viewMode === 'table'"
            :get-row-id="(row) => String(row.id ?? '')"
            :page-size-options="PAGE_SIZE_OPTIONS"
            :total="totalReturns"
            :show-search="false"
            :show-view-mode-toggle="true"
            card-grid-class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2"
            empty-icon="i-lucide-undo-2"
            empty-title="Nenhuma devolução encontrada"
            empty-description="Registre devoluções ou ajuste os filtros para continuar."
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
                label="Nova devolução"
                icon="i-lucide-plus"
                size="sm"
                @click="openCreate"
              />
            </template>

            <template #filters>
              <USelectMenu
                v-model="statusFilter"
                :items="statusFilterOptions"
                value-key="value"
                class="w-full sm:w-44"
                :search-input="false"
              />

              <USelectMenu
                v-model="reasonFilter"
                :items="reasonFilterOptions"
                value-key="value"
                class="w-full sm:w-52"
                :search-input="false"
              />
            </template>

            <template #return_date-cell="{ row }">
              <span class="text-sm text-muted">
                {{ formatDate(row.original.return_date) }}
              </span>
            </template>

            <template #supplier-cell="{ row }">
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ row.original.suppliers?.name || 'Fornecedor não informado' }}
                </p>
              </div>
            </template>

            <template #reason-cell="{ row }">
              <span class="text-sm text-muted">
                {{ reasonLabelMap[row.original.reason] || row.original.reason }}
              </span>
            </template>

            <template #total_returned_amount-cell="{ row }">
              <span class="text-sm text-muted">
                {{ formatCurrency(row.original.total_returned_amount) }}
              </span>
            </template>

            <template #status-cell="{ row }">
              <UBadge
                :label="statusLabelMap[row.original.status] || row.original.status"
                :color="statusColorMap[row.original.status] || 'neutral'"
                variant="subtle"
                size="xs"
              />
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-2">
                <UButton
                  v-if="canUpdate"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="openEdit(row.original as PurchaseReturnItem)"
                />

                <UButton
                  v-if="canDelete"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :loading="isDeleting"
                  @click="requestRemove(row.original as PurchaseReturnItem)"
                />
              </div>
            </template>
          </AppDataTable>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="showModal"
    :title="selectedReturn ? 'Editar devolução' : 'Nova devolução'"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Compra" required class="sm:col-span-2">
            <USelectMenu
              v-model="form.purchase_id"
              :items="purchaseOptions"
              value-key="value"
              class="w-full"
              searchable
            />
          </UFormField>

          <UFormField label="Data da devolução" required>
            <UInput v-model="form.return_date" type="date" class="w-full" />
          </UFormField>

          <UFormField label="Motivo">
            <USelectMenu
              v-model="form.reason"
              :items="reasonFormOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Valor total devolvido" required>
            <UInput
              v-model="form.total_returned_amount"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Status">
            <USelectMenu
              v-model="form.status"
              :items="statusFormOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Itens devolvidos (JSON)" class="sm:col-span-2">
            <UTextarea v-model="returnedItemsJson" :rows="6" class="w-full font-mono text-xs" />
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
    confirm-label="Excluir devolução"
    confirm-color="error"
    :loading="isDeleting"
    @confirm="confirmRemove"
    @update:open="
      (value: boolean) => {
        showDeleteModal = value
        if (!value && !isDeleting) returnPendingDeletion = null
      }
    "
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir a devolução
        <strong class="text-highlighted">
          {{ returnPendingDeletion?.suppliers?.name || 'selecionada' }}
        </strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>

  <AppConfirmModal
    v-model:open="showBulkDeleteModal"
    title="Excluir devoluções selecionadas"
    confirm-label="Excluir todas"
    confirm-color="error"
    :loading="isBulkDeleting"
    @confirm="confirmBulkDelete"
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir
        <strong class="text-highlighted">{{ selectedCount }} devolução(ões)</strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>
</template>
