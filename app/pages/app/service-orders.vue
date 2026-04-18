<script setup lang="ts">
import { watchDebounced, useVirtualList, useIntersectionObserver } from '@vueuse/core'
import { ActionCode } from '~/constants/action-codes'

import type { ServiceOrder } from '~/types/service-orders'

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
const route = useRoute()
const router = useRouter()

const canRead = computed(() => workshop.can(ActionCode.ORDERS_READ))
const canCreate = computed(() => workshop.can(ActionCode.ORDERS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.ORDERS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.ORDERS_DELETE))
const canCancel = computed(() => workshop.can(ActionCode.ORDERS_CANCEL))

// ─── Filters (URL-synced) ──────────────────────────────────────────────────────

const MANAGED_QUERY_KEYS = ['search', 'status'] as const

const search = ref(
  typeof route.query.search === 'string' ? route.query.search : ''
)
const debouncedSearch = ref(search.value)
const statusFilter = ref(
  typeof route.query.status === 'string' ? route.query.status : 'all'
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
    status: statusFilter.value !== 'all' ? statusFilter.value : undefined
  }
  const cur = JSON.stringify(route.query)
  if (cur !== JSON.stringify(next)) await router.replace({ query: next })
}

// ─── Infinite scroll state ─────────────────────────────────────────────────────

const allOrders = ref<ServiceOrder[]>([])
const nextCursor = ref<number | null>(0)
const isLoadingMore = ref(false)
const totalFiltered = ref(0)
const hasMore = computed(() => nextCursor.value !== null)

const LIMIT = 20

async function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return
  isLoadingMore.value = true
  try {
    const res = await $fetch<ServiceOrdersApiResponse>('/api/service-orders', {
      query: {
        searchTerm: debouncedSearch.value || undefined,
        status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
        cursor: nextCursor.value,
        limit: LIMIT
      }
    })
    allOrders.value.push(...res.data.items)
    nextCursor.value = res.data.nextCursor
    totalFiltered.value = res.data.totalFiltered
  } catch {
    toast.add({ title: 'Erro ao carregar ordens', color: 'error' })
  } finally {
    isLoadingMore.value = false
  }
}

function resetAndLoad() {
  allOrders.value = []
  nextCursor.value = 0
  totalFiltered.value = 0
  loadMore()
}

// ─── Virtual list ──────────────────────────────────────────────────────────────

// Altura fixa por item = card (144px) + padding vertical (16px) = 160px
const ITEM_HEIGHT = 160

const { list: virtualList, containerProps, wrapperProps } = useVirtualList(
  allOrders,
  { itemHeight: ITEM_HEIGHT, overscan: 6 }
)

// Sentinel no fim do scroll
const sentinelRef = ref<HTMLElement | null>(null)
useIntersectionObserver(
  sentinelRef,
  ([entry]) => {
    if (entry.isIntersecting && hasMore.value && !isLoadingMore.value)
      loadMore()
  },
  { root: containerProps.ref, rootMargin: '300px' }
)

// ─── Watchers ──────────────────────────────────────────────────────────────────

watchDebounced(
  search,
  async (val) => {
    debouncedSearch.value = val
    await syncQuery()
    resetAndLoad()
  },
  { debounce: 300, maxWait: 800 }
)

watch(statusFilter, async () => {
  await syncQuery()
  resetAndLoad()
})

watch(
  () => route.query,
  (q) => {
    const s = typeof q.search === 'string' ? q.search : ''
    const st = typeof q.status === 'string' ? q.status : 'all'
    if (search.value !== s) { search.value = s; debouncedSearch.value = s }
    if (statusFilter.value !== st) statusFilter.value = st
  }
)

// Initial load
if (canRead.value) await loadMore()

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
    resetAndLoad()
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
    resetAndLoad()
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

const statusFilterOptions = [
  { label: 'Todas', value: 'all' },
  { label: 'Orçamento', value: 'estimate' },
  { label: 'Aberta', value: 'open' },
  { label: 'Em andamento', value: 'in_progress' },
  { label: 'Aguard. peça', value: 'waiting_for_part' },
  { label: 'Concluída', value: 'completed' },
  { label: 'Entregue', value: 'delivered' },
  { label: 'Cancelada', value: 'cancelled' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Ordens de Serviço">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Nova OS"
            icon="i-lucide-plus"
            color="neutral"
            disabled
          />
        </template>
      </AppPageHeader>
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">
          Você não tem permissão para visualizar ordens de serviço.
        </p>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Filtros -->
        <div
          class="flex shrink-0 flex-wrap items-center gap-3 border-b border-default p-4"
        >
          <UInput
            v-model="search"
            placeholder="Buscar por número ou cliente..."
            icon="i-lucide-search"
            class="w-72"
          />
          <USelectMenu
            v-model="statusFilter"
            :items="statusFilterOptions"
            value-key="value"
            class="w-44"
          />
          <span class="ml-auto text-sm text-muted">
            {{ totalFiltered }} resultado{{ totalFiltered !== 1 ? "s" : "" }}
          </span>
        </div>

        <!-- Estado vazio (sem permissão ou sem itens e não carregando) -->
        <div
          v-if="allOrders.length === 0 && !isLoadingMore"
          class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
        >
          <UIcon name="i-lucide-clipboard-list" class="size-12 text-muted" />
          <p class="font-medium text-highlighted">
            Nenhuma ordem de serviço encontrada
          </p>
          <p class="text-sm text-muted">
            Crie uma OS ou ajuste os filtros para continuar.
          </p>
        </div>

        <!-- Skeleton inicial -->
        <div
          v-else-if="allOrders.length === 0 && isLoadingMore"
          class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2"
        >
          <USkeleton v-for="i in 6" :key="i" class="h-36 w-full rounded-xl" />
        </div>

        <!-- Lista virtualizada -->
        <div
          v-else
          v-bind="containerProps"
          class="flex-1 min-h-0 overflow-y-auto"
        >
          <div v-bind="wrapperProps">
            <div
              v-for="{ data: order, index } in virtualList"
              :key="order.id"
              :style="{ height: `${ITEM_HEIGHT}px` }"
              class="grid grid-cols-1 gap-0 px-4 py-2 xl:grid-cols-2 xl:gap-4"
            >
              <!-- Card da OS -->
              <ServiceOrdersOrderCard
                :order="order"
                :can-cancel="canCancel"
                :can-delete="canDelete"
                @view="openDetail"
                @cancel="requestCancel"
                @delete="requestDelete"
              />

              <!-- Coluna direita vazia no xl (grid 2 colunas) — preenchida pelo próximo item -->
              <div v-if="index % 2 !== 0" class="hidden xl:block" />
            </div>
          </div>

          <!-- Sentinel — dispara loadMore quando entra na viewport -->
          <div ref="sentinelRef" class="h-px" />

          <!-- Skeleton de carregamento incremental -->
          <div v-if="isLoadingMore" class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
            <USkeleton v-for="i in 4" :key="i" class="h-36 w-full rounded-xl" />
          </div>

          <!-- Fim da lista -->
          <div
            v-else-if="!hasMore && allOrders.length > 0"
            class="py-8 text-center text-sm text-muted"
          >
            <UIcon name="i-lucide-check-circle" class="mx-auto mb-2 size-5" />
            Todas as {{ totalFiltered }} ordens foram carregadas.
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

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
        showCancelModal = v;
        if (!v && !isCancelling) orderPendingCancel = null;
      }
    "
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja cancelar a
        <strong class="text-highlighted">
          OS #{{ orderPendingCancel?.number ?? "" }}
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
        showDeleteModal = v;
        if (!v && !isDeleting) orderPendingDeletion = null;
      }
    "
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir a
        <strong class="text-highlighted">
          OS #{{ orderPendingDeletion?.number ?? "" }}
        </strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>

  <!-- ── Detail Slideover ─────────────────────────────────────────────────────── -->
  <ServiceOrdersDetailSlideover
    v-model:open="showDetail"
    :order="selectedOrder"
    :can-cancel="canCancel"
    :is-cancelling="isCancelling"
    @cancel="requestCancel"
  />
</template>
