<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { ActionCode } from '~/constants/action-codes'
import type { ServiceOrder, ServiceOrderRaw } from '~/types/service-orders'

type ServiceOrdersApiResponse = {
  data: {
    items: ServiceOrder[]
    nextCursor: number | null
    totalFiltered: number
    totalAll: number
  }
}

// ─── Page meta ─────────────────────────────────────────────────────────────────

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Ordens de Serviço' })

// ─── Permissions ───────────────────────────────────────────────────────────────

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const route = useRoute()
const router = useRouter()

const canRead = computed(() => workshop.can(ActionCode.ORDERS_READ))
const canCreate = computed(() => workshop.can(ActionCode.ORDERS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.ORDERS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.ORDERS_DELETE))
const canCancel = computed(() => workshop.can(ActionCode.ORDERS_CANCEL))

// ─── Filters (URL-synced) ──────────────────────────────────────────────────────

const MANAGED_QUERY_KEYS = ['search', 'status', 'clientId', 'vehicleId', 'responsibleId', 'dateFrom', 'dateTo'] as const

const search = ref(
  typeof route.query.search === 'string' ? route.query.search : ''
)
const apiSearch = ref(search.value)
const statusFilter = ref(
  typeof route.query.status === 'string' ? route.query.status : 'all'
)
const clientIdFilter = ref(
  typeof route.query.clientId === 'string' ? route.query.clientId : 'all'
)
const vehicleIdFilter = ref(
  typeof route.query.vehicleId === 'string' ? route.query.vehicleId : 'all'
)
const responsibleIdFilter = ref(
  typeof route.query.responsibleId === 'string' ? route.query.responsibleId : 'all'
)
const dateFrom = ref(
  typeof route.query.dateFrom === 'string' ? route.query.dateFrom : ''
)
const dateTo = ref(
  typeof route.query.dateTo === 'string' ? route.query.dateTo : ''
)

async function syncQuery() {
  const next: Record<string, string | undefined> = {
    ...Object.fromEntries(
      Object.entries(route.query).filter(
        ([k]) =>
          !MANAGED_QUERY_KEYS.includes(k as (typeof MANAGED_QUERY_KEYS)[number])
      )
    ),
    search: search.value || undefined,
    status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
    clientId: clientIdFilter.value !== 'all' ? clientIdFilter.value : undefined,
    vehicleId: vehicleIdFilter.value !== 'all' ? vehicleIdFilter.value : undefined,
    responsibleId: responsibleIdFilter.value !== 'all' ? responsibleIdFilter.value : undefined,
    dateFrom: dateFrom.value || undefined,
    dateTo: dateTo.value || undefined
  }
  if (JSON.stringify(route.query) !== JSON.stringify(next))
    await router.replace({ query: next })
}

// ─── Data loading (useAsyncData + page accumulation) ─────────────────────────

const LIMIT = 20
const page = ref(1)
const refreshKey = ref(0)
const accumulatedOrders = ref<ServiceOrder[]>([])
const totalFiltered = ref(0)

const queryKey = computed(
  () => `service-orders-${refreshKey.value}-${page.value}-${apiSearch.value}-${statusFilter.value}-${clientIdFilter.value}-${vehicleIdFilter.value}-${responsibleIdFilter.value}-${dateFrom.value}-${dateTo.value}`
)

const { data, status: fetchStatus } = await useAsyncData(
  () => queryKey.value,
  async () => {
    if (!canRead.value) {
      return {
        data: { items: [] as ServiceOrder[], nextCursor: null, totalFiltered: 0, totalAll: 0 }
      } satisfies ServiceOrdersApiResponse
    }
    return requestFetch<ServiceOrdersApiResponse>('/api/service-orders', {
      headers: requestHeaders,
      query: {
        searchTerm: apiSearch.value || undefined,
        status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
        clientId: clientIdFilter.value !== 'all' ? clientIdFilter.value : undefined,
        vehicleId: vehicleIdFilter.value !== 'all' ? vehicleIdFilter.value : undefined,
        responsibleId: responsibleIdFilter.value !== 'all' ? responsibleIdFilter.value : undefined,
        useDateFilter: (dateFrom.value && dateTo.value) ? 'true' : undefined,
        dateFrom: dateFrom.value || undefined,
        dateTo: dateTo.value || undefined,
        cursor: (page.value - 1) * LIMIT,
        limit: LIMIT
      }
    })
  },
  { watch: [queryKey] }
)

watch(
  data,
  (newData) => {
    const items = newData?.data.items ?? []
    totalFiltered.value = newData?.data.totalFiltered ?? 0
    if (page.value === 1) {
      accumulatedOrders.value = items
    } else {
      accumulatedOrders.value = [...accumulatedOrders.value, ...items]
    }
  },
  { immediate: true }
)

const hasMore = computed(
  () => accumulatedOrders.value.length < totalFiltered.value
)
const isLoading = computed(
  () => fetchStatus.value === 'pending' && page.value === 1
)
const isLoadingMore = computed(
  () => fetchStatus.value === 'pending' && page.value > 1
)

function loadMore() {
  if (hasMore.value && fetchStatus.value !== 'pending') page.value++
}

// ─── Watchers ──────────────────────────────────────────────────────────────────

watchDebounced(
  search,
  async (val) => {
    apiSearch.value = val
    await syncQuery()
  },
  { debounce: 300, maxWait: 800 }
)

watch([apiSearch, statusFilter, clientIdFilter, vehicleIdFilter, responsibleIdFilter, dateFrom, dateTo], () => {
  accumulatedOrders.value = []
  totalFiltered.value = 0
  page.value = 1
})

watch(statusFilter, syncQuery)

watch([clientIdFilter, vehicleIdFilter, responsibleIdFilter, dateFrom, dateTo], syncQuery)

watch(
  () => route.query,
  (q) => {
    const s = typeof q.search === 'string' ? q.search : ''
    const st = typeof q.status === 'string' ? q.status : 'all'
    const ci = typeof q.clientId === 'string' ? q.clientId : 'all'
    const vi = typeof q.vehicleId === 'string' ? q.vehicleId : 'all'
    const ri = typeof q.responsibleId === 'string' ? q.responsibleId : 'all'
    const df = typeof q.dateFrom === 'string' ? q.dateFrom : ''
    const dt = typeof q.dateTo === 'string' ? q.dateTo : ''
    if (search.value !== s) {
      search.value = s
      apiSearch.value = s
    }
    if (statusFilter.value !== st) statusFilter.value = st
    if (clientIdFilter.value !== ci) clientIdFilter.value = ci
    if (vehicleIdFilter.value !== vi) vehicleIdFilter.value = vi
    if (responsibleIdFilter.value !== ri) responsibleIdFilter.value = ri
    if (dateFrom.value !== df) dateFrom.value = df
    if (dateTo.value !== dt) dateTo.value = dt
  }
)

// ─── Detail Slideover ──────────────────────────────────────────────────────────

const showDetail = ref(false)
const selectedOrder = ref<ServiceOrder | null>(null)

function openDetail(order: ServiceOrder) {
  selectedOrder.value = order
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  selectedOrder.value = null
}

// ─── Advance status ────────────────────────────────────────────────────────────

const advancingIds = ref(new Set<string>())

function getNextStatus(status: string): string | null {
  if (status === 'estimate') return 'open'
  if (status === 'open') return 'in_progress'
  if (status === 'in_progress') return 'completed'
  return null
}

async function advanceStatus(order: ServiceOrder) {
  const nextStatus = getNextStatus(order.status)
  if (!nextStatus || advancingIds.value.has(order.id)) return

  advancingIds.value.add(order.id)
  try {
    await $fetch('/api/service-orders', {
      method: 'POST',
      body: { orderId: order.id, orderData: { status: nextStatus } }
    })
    toast.add({ title: 'Status atualizado', color: 'success' })
    forceReload()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao atualizar status',
      description: err?.data?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    advancingIds.value.delete(order.id)
  }
}

// ─── Duplicate ─────────────────────────────────────────────────────────────────

const duplicatingIds = ref(new Set<string>())

async function duplicate(order: ServiceOrder) {
  if (duplicatingIds.value.has(order.id)) return

  duplicatingIds.value.add(order.id)
  try {
    const res = await $fetch<{ data: { order: Record<string, unknown> } }>(`/api/service-orders/${order.id}`)
    const orig = res.data.order

    await $fetch('/api/service-orders', {
      method: 'POST',
      body: {
        orderData: {
          client_id: orig.client_id || null,
          vehicle_id: orig.vehicle_id || null,
          master_product_id: orig.master_product_id || null,
          employee_responsible_id: orig.employee_responsible_id || null,
          responsible_employees: orig.responsible_employees || [],
          reported_defect: orig.reported_defect || null,
          diagnosis: orig.diagnosis || null,
          status: 'open',
          payment_status: 'pending',
          entry_date: new Date().toISOString().split('T')[0],
          items: orig.items || [],
          apply_taxes: orig.apply_taxes || false,
          selected_taxes: orig.selected_taxes || [],
          total_amount: orig.total_amount || 0,
          discount: orig.discount || 0,
          notes: orig.notes || null
        }
      }
    })
    toast.add({ title: 'OS duplicada com sucesso', color: 'success' })
    forceReload()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao duplicar OS',
      description: err?.data?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    duplicatingIds.value.delete(order.id)
  }
}

// ─── Payment ───────────────────────────────────────────────────────────────────

const showPaymentModal = ref(false)
const paymentOrder = ref<ServiceOrder | null>(null)

function requestPay(order: ServiceOrder) {
  paymentOrder.value = order
  showPaymentModal.value = true
}

function onPaymentDone() {
  showPaymentModal.value = false
  paymentOrder.value = null
  forceReload()
}

// ─── Cancel ────────────────────────────────────────────────────────────────────

const isCancelling = ref(false)
const showCancelModal = ref(false)
const orderPendingCancel = ref<ServiceOrder | null>(null)

function requestCancel(order: ServiceOrder) {
  if (isCancelling.value) return
  orderPendingCancel.value = order
  showCancelModal.value = true
}

async function confirmCancel() {
  if (!orderPendingCancel.value || isCancelling.value) return
  const order = orderPendingCancel.value
  isCancelling.value = true
  try {
    await $fetch(`/api/service-orders/${order.id}/cancel`, { method: 'POST' })
    toast.add({ title: 'OS cancelada', color: 'success' })
    showCancelModal.value = false
    orderPendingCancel.value = null
    if (showDetail.value && selectedOrder.value?.id === order.id) closeDetail()
    forceReload()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || 'Não foi possível cancelar.',
      color: 'error'
    })
  } finally {
    isCancelling.value = false
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────────

const isDeleting = ref(false)
const showDeleteModal = ref(false)
const orderPendingDeletion = ref<ServiceOrder | null>(null)

function requestDelete(order: ServiceOrder) {
  if (isDeleting.value) return
  orderPendingDeletion.value = order
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!orderPendingDeletion.value || isDeleting.value) return
  const order = orderPendingDeletion.value
  isDeleting.value = true
  try {
    await $fetch(`/api/service-orders/${order.id}`, { method: 'DELETE' })
    toast.add({ title: 'OS removida', color: 'success' })
    showDeleteModal.value = false
    orderPendingDeletion.value = null
    if (showDetail.value && selectedOrder.value?.id === order.id) closeDetail()
    forceReload()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || 'Não foi possível remover.',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

// ─── Status options (kept for reference) are now in ServiceOrdersOrdersFilters ─

// ─── Force reload helper ──────────────────────────────────────────────────────

function forceReload() {
  accumulatedOrders.value = []
  totalFiltered.value = 0
  if (page.value === 1) {
    refreshKey.value++
  } else {
    page.value = 1
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

const showCreateModal = ref(false)
const editingOrder = ref<ServiceOrderRaw | null>(null)
const editingIds = ref(new Set<string>())

watch(showCreateModal, (opened) => {
  if (!opened) editingOrder.value = null
})

function openEdit(order: ServiceOrderRaw) {
  closeDetail()
  editingOrder.value = order
  showCreateModal.value = true
}

async function openEditFromList(order: ServiceOrder) {
  if (editingIds.value.has(order.id)) return

  editingIds.value.add(order.id)
  try {
    const res = await $fetch<{ data: { order: ServiceOrderRaw } }>(`/api/service-orders/${order.id}`)
    editingOrder.value = res.data.order
    showCreateModal.value = true
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao carregar OS para edição',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    editingIds.value.delete(order.id)
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Ordens de Serviço" />
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">
          Você não tem permissão para visualizar ordens de serviço.
        </p>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col p-4">
        <AppDataTableInfinite
          v-model:search-term="search"
          :columns="[]"
          :data="accumulatedOrders as Record<string, unknown>[]"
          :loading="isLoading"
          :loading-more="isLoadingMore"
          :has-more="hasMore"
          :total="totalFiltered"
          show-search
          search-placeholder="Buscar por número ou cliente..."
          empty-icon="i-lucide-clipboard-list"
          empty-title="Nenhuma ordem de serviço encontrada"
          empty-description="Crie uma OS ou ajuste os filtros para continuar."
          row-skeleton-class="h-24 w-full rounded-xl"
          @load-more="loadMore"
        >
          <template #filters>
            <ServiceOrdersFilters
              v-model:status-filter="statusFilter"
              v-model:client-id-filter="clientIdFilter"
              v-model:vehicle-id-filter="vehicleIdFilter"
              v-model:responsible-id-filter="responsibleIdFilter"
              v-model:date-from="dateFrom"
              v-model:date-to="dateTo"
            />
          </template>

          <template #toolbar-right>
            <UButton
              v-if="canCreate"
              label="Nova OS"
              icon="i-lucide-plus"
              size="sm"
              @click="showCreateModal = true"
            />
          </template>

          <template #card-list>
            <div class="space-y-3 p-4">
              <ServiceOrdersOrderCard
                v-for="order in accumulatedOrders"
                :key="order.id"
                :order="order"
                :can-cancel="canCancel"
                :can-delete="canDelete"
                :can-create="canCreate"
                :can-update="canUpdate"
                :is-advancing="advancingIds.has(order.id)"
                :is-editing="editingIds.has(order.id)"
                :is-duplicating="duplicatingIds.has(order.id)"
                @view="openDetail"
                @advance-status="advanceStatus"
                @edit="openEditFromList"
                @duplicate="duplicate"
                @pay="requestPay"
                @cancel="requestCancel"
                @delete="requestDelete"
              />
            </div>
          </template>
        </AppDataTableInfinite>
      </div>
    </template>
  </UDashboardPanel>

  <!-- ── Create Modal ────────────────────────────────────────────────────────── -->
  <ServiceOrdersCreateModal
    v-model:open="showCreateModal"
    :order-to-edit="editingOrder"
    @created="forceReload"
    @updated="forceReload"
  />

  <!-- ── Confirm cancel ───────────────────────────────────────────────────────── -->
  <AppConfirmModal
    v-model:open="showCancelModal"
    title="Cancelar OS"
    confirm-label="Cancelar OS"
    confirm-color="warning"
    :loading="isCancelling"
    @confirm="confirmCancel"
    @update:open="
      (v) => {
        showCancelModal = v
        if (!v && !isCancelling) orderPendingCancel = null
      }
    "
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja cancelar a
        <strong class="text-highlighted">
          OS #{{ orderPendingCancel?.number ?? '' }}
        </strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>

  <!-- ── Confirm delete ───────────────────────────────────────────────────────── -->
  <AppConfirmModal
    v-model:open="showDeleteModal"
    title="Excluir OS"
    confirm-label="Excluir OS"
    confirm-color="error"
    :loading="isDeleting"
    @confirm="confirmDelete"
    @update:open="
      (v) => {
        showDeleteModal = v
        if (!v && !isDeleting) orderPendingDeletion = null
      }
    "
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir a
        <strong class="text-highlighted">
          OS #{{ orderPendingDeletion?.number ?? '' }}
        </strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>

  <!-- ── Detail Modal ────────────────────────────────────────────────────────── -->
  <ServiceOrdersDetailModal
    v-model:open="showDetail"
    :order="selectedOrder"
    :can-update="canUpdate"
    :can-cancel="canCancel"
    :can-delete="canDelete"
    :can-create="canCreate"
    @edit="openEdit"
    @updated="forceReload"
    @deleted="() => { closeDetail(); forceReload() }"
  />

  <!-- ── Payment Modal ────────────────────────────────────────────────────────── -->
  <ServiceOrdersPaymentModal
    v-model:open="showPaymentModal"
    :order="paymentOrder"
    @paid="onPaymentDone"
  />
</template>
