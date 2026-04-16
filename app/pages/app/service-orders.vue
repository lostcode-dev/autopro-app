<script setup lang="ts">
import { watchDebounced, useVirtualList, useIntersectionObserver } from "@vueuse/core";
import { ActionCode } from "~/constants/action-codes";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ServiceOrder = {
  id: string;
  number: string | null;
  status: string;
  payment_status: string | null;
  is_installment: boolean;
  client_id: string | null;
  client_name: string | null;
  vehicle_id: string | null;
  vehicle_label: string | null;
  entry_date: string | null;
  reported_defect: string | null;
  total_amount: number | null;
  responsible_name: string | null;
  has_commissions: boolean;
  installments_progress: { paid: number; total: number } | null;
};

type ServiceOrdersApiResponse = {
  data: {
    items: ServiceOrder[];
    nextCursor: number | null;
    totalFiltered: number;
    totalAll: number;
  };
};

// ─── Page meta ─────────────────────────────────────────────────────────────────

definePageMeta({ layout: "app" });
useSeoMeta({ title: "Ordens de Serviço" });

// ─── Permissions ───────────────────────────────────────────────────────────────

const toast = useToast();
const workshop = useWorkshopPermissions();
const route = useRoute();
const router = useRouter();

const canRead = computed(() => workshop.can(ActionCode.ORDERS_READ));
const canCreate = computed(() => workshop.can(ActionCode.ORDERS_CREATE));
const canUpdate = computed(() => workshop.can(ActionCode.ORDERS_UPDATE));
const canDelete = computed(() => workshop.can(ActionCode.ORDERS_DELETE));
const canCancel = computed(() => workshop.can(ActionCode.ORDERS_CANCEL));

// ─── Filters (URL-synced) ──────────────────────────────────────────────────────

const MANAGED_QUERY_KEYS = ["search", "status"] as const;

const search = ref(
  typeof route.query.search === "string" ? route.query.search : "",
);
const debouncedSearch = ref(search.value);
const statusFilter = ref(
  typeof route.query.status === "string" ? route.query.status : "all",
);

async function syncQuery() {
  const next: Record<string, string | undefined> = {
    ...Object.fromEntries(
      Object.entries(route.query).filter(
        ([k]) =>
          !MANAGED_QUERY_KEYS.includes(k as (typeof MANAGED_QUERY_KEYS)[number]),
      ),
    ),
    search: search.value || undefined,
    status: statusFilter.value !== "all" ? statusFilter.value : undefined,
  };
  const cur = JSON.stringify(route.query);
  if (cur !== JSON.stringify(next)) await router.replace({ query: next });
}

// ─── Infinite scroll state ─────────────────────────────────────────────────────

const allOrders = ref<ServiceOrder[]>([]);
const nextCursor = ref<number | null>(0);
const isLoadingMore = ref(false);
const totalFiltered = ref(0);
const hasMore = computed(() => nextCursor.value !== null);

const LIMIT = 20;

async function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return;
  isLoadingMore.value = true;
  try {
    const res = await $fetch<ServiceOrdersApiResponse>("/api/service-orders", {
      query: {
        searchTerm: debouncedSearch.value || undefined,
        status: statusFilter.value !== "all" ? statusFilter.value : undefined,
        cursor: nextCursor.value,
        limit: LIMIT,
      },
    });
    allOrders.value.push(...res.data.items);
    nextCursor.value = res.data.nextCursor;
    totalFiltered.value = res.data.totalFiltered;
  } catch {
    toast.add({ title: "Erro ao carregar ordens", color: "error" });
  } finally {
    isLoadingMore.value = false;
  }
}

function resetAndLoad() {
  allOrders.value = [];
  nextCursor.value = 0;
  totalFiltered.value = 0;
  loadMore();
}

// ─── Virtual list ──────────────────────────────────────────────────────────────

// Altura fixa por item = card (144px) + padding vertical (16px) = 160px
const ITEM_HEIGHT = 160;

const { list: virtualList, containerProps, wrapperProps } = useVirtualList(
  allOrders,
  { itemHeight: ITEM_HEIGHT, overscan: 6 },
);

// Sentinel no fim do scroll
const sentinelRef = ref<HTMLElement | null>(null);
useIntersectionObserver(
  sentinelRef,
  ([entry]) => {
    if (entry.isIntersecting && hasMore.value && !isLoadingMore.value)
      loadMore();
  },
  { root: containerProps.ref, rootMargin: "300px" },
);

// ─── Watchers ──────────────────────────────────────────────────────────────────

watchDebounced(
  search,
  async (val) => {
    debouncedSearch.value = val;
    await syncQuery();
    resetAndLoad();
  },
  { debounce: 300, maxWait: 800 },
);

watch(statusFilter, async () => {
  await syncQuery();
  resetAndLoad();
});

watch(
  () => route.query,
  (q) => {
    const s = typeof q.search === "string" ? q.search : "";
    const st = typeof q.status === "string" ? q.status : "all";
    if (search.value !== s) { search.value = s; debouncedSearch.value = s; }
    if (statusFilter.value !== st) statusFilter.value = st;
  },
);

// Initial load
if (canRead.value) await loadMore();

// ─── Detail Slideover ──────────────────────────────────────────────────────────

const showDetail = ref(false);
const isLoadingDetail = ref(false);
const orderDetail = ref<any | null>(null);
const selectedOrderId = ref<string | null>(null);

async function openDetail(order: ServiceOrder) {
  selectedOrderId.value = order.id;
  orderDetail.value = null;
  showDetail.value = true;
  isLoadingDetail.value = true;
  try {
    const result = await $fetch<any>(`/api/service-orders/${order.id}`);
    orderDetail.value = result.data;
  } catch {
    toast.add({ title: "Erro ao carregar detalhes", color: "error" });
    showDetail.value = false;
  } finally {
    isLoadingDetail.value = false;
  }
}

function closeDetail() {
  showDetail.value = false;
  orderDetail.value = null;
  selectedOrderId.value = null;
}

// ─── Cancel ────────────────────────────────────────────────────────────────────

const isCancelling = ref(false);
const showCancelModal = ref(false);
const orderPendingCancel = ref<ServiceOrder | null>(null);

function requestCancel(order: ServiceOrder) {
  if (isCancelling.value) return;
  orderPendingCancel.value = order;
  showCancelModal.value = true;
}

async function confirmCancel() {
  if (!orderPendingCancel.value || isCancelling.value) return;
  const order = orderPendingCancel.value;
  isCancelling.value = true;
  try {
    await $fetch(`/api/service-orders/${order.id}/cancel`, { method: "POST" });
    toast.add({ title: "OS cancelada", color: "success" });
    showCancelModal.value = false;
    orderPendingCancel.value = null;
    if (showDetail.value && selectedOrderId.value === order.id) closeDetail();
    resetAndLoad();
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string };
    toast.add({
      title: "Erro",
      description: err?.data?.statusMessage || "Não foi possível cancelar.",
      color: "error",
    });
  } finally {
    isCancelling.value = false;
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────────

const isDeleting = ref(false);
const showDeleteModal = ref(false);
const orderPendingDeletion = ref<ServiceOrder | null>(null);

function requestDelete(order: ServiceOrder) {
  if (isDeleting.value) return;
  orderPendingDeletion.value = order;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!orderPendingDeletion.value || isDeleting.value) return;
  const order = orderPendingDeletion.value;
  isDeleting.value = true;
  try {
    await $fetch(`/api/service-orders/${order.id}`, { method: "DELETE" });
    toast.add({ title: "OS removida", color: "success" });
    showDeleteModal.value = false;
    orderPendingDeletion.value = null;
    if (showDetail.value && selectedOrderId.value === order.id) closeDetail();
    resetAndLoad();
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string };
    toast.add({
      title: "Erro",
      description: err?.data?.statusMessage || "Não foi possível remover.",
      color: "error",
    });
  } finally {
    isDeleting.value = false;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number | string | null | undefined) {
  return parseFloat(String(value || 0)).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

const statusFilterOptions = [
  { label: "Todas", value: "all" },
  { label: "Orçamento", value: "estimate" },
  { label: "Aberta", value: "open" },
  { label: "Em andamento", value: "in_progress" },
  { label: "Aguard. peça", value: "waiting_for_part" },
  { label: "Concluída", value: "completed" },
  { label: "Entregue", value: "delivered" },
  { label: "Cancelada", value: "cancelled" },
];

const statusColorMap: Record<string, string> = {
  estimate: "neutral",
  open: "info",
  in_progress: "warning",
  waiting_for_part: "warning",
  completed: "success",
  delivered: "success",
  cancelled: "error",
};
const statusLabelMap: Record<string, string> = {
  estimate: "Orçamento",
  open: "Aberta",
  in_progress: "Em andamento",
  waiting_for_part: "Aguard. peça",
  completed: "Concluída",
  delivered: "Entregue",
  cancelled: "Cancelada",
};
const paymentStatusColorMap: Record<string, string> = {
  pending: "warning",
  paid: "success",
  partial: "info",
};
const paymentStatusLabelMap: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  partial: "Parcial",
};
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
              <UCard
                class="h-full cursor-pointer border border-default/80 shadow-sm transition-colors hover:bg-elevated"
                @click="openDetail(order)"
              >
                <div class="flex h-full items-start gap-4">
                  <!-- Ícone -->
                  <div
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary"
                  >
                    <UIcon name="i-lucide-wrench" class="size-6" />
                  </div>

                  <div class="min-w-0 flex-1 space-y-2">
                    <!-- Linha 1: número + cliente + ações -->
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <p class="truncate font-semibold text-highlighted">
                          OS #{{ order.number }}
                          <span class="font-normal text-muted">—</span>
                          {{ order.client_name ?? "—" }}
                        </p>
                        <p class="truncate text-xs text-muted">
                          {{ order.vehicle_label ?? "Veículo não informado" }}
                        </p>
                      </div>

                      <!-- Ações -->
                      <div
                        class="flex shrink-0 items-center gap-1"
                        @click.stop
                      >
                        <UTooltip text="Ver detalhes">
                          <UButton
                            icon="i-lucide-eye"
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            @click="openDetail(order)"
                          />
                        </UTooltip>
                        <UTooltip
                          v-if="
                            canCancel &&
                            !['cancelled', 'delivered'].includes(order.status)
                          "
                          text="Cancelar OS"
                        >
                          <UButton
                            icon="i-lucide-ban"
                            color="warning"
                            variant="ghost"
                            size="xs"
                            @click="requestCancel(order)"
                          />
                        </UTooltip>
                        <UTooltip v-if="canDelete" text="Excluir OS">
                          <UButton
                            icon="i-lucide-trash-2"
                            color="error"
                            variant="ghost"
                            size="xs"
                            @click="requestDelete(order)"
                          />
                        </UTooltip>
                      </div>
                    </div>

                    <!-- Linha 2: defeito relatado -->
                    <p class="truncate text-sm text-muted">
                      {{
                        order.reported_defect || "Sem defeito relatado"
                      }}
                    </p>

                    <!-- Linha 3: badges + valor + data -->
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <UBadge
                          :color="statusColorMap[order.status] ?? 'neutral'"
                          :label="statusLabelMap[order.status] ?? order.status"
                          variant="subtle"
                          size="xs"
                        />
                        <UBadge
                          v-if="order.payment_status"
                          :color="
                            paymentStatusColorMap[order.payment_status] ??
                            'neutral'
                          "
                          :label="
                            paymentStatusLabelMap[order.payment_status] ??
                            order.payment_status
                          "
                          variant="soft"
                          size="xs"
                        />
                      </div>
                      <div class="shrink-0 text-right">
                        <p class="text-sm font-semibold text-highlighted">
                          {{ formatCurrency(order.total_amount) }}
                        </p>
                        <p class="text-xs text-muted">
                          {{ formatDate(order.entry_date) }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </UCard>

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
  <USlideover
    v-model:open="showDetail"
    side="right"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #header>
      <div v-if="orderDetail">
        <h2 class="text-lg font-bold text-highlighted">
          OS #{{ orderDetail.order.number }}
        </h2>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <UBadge
            :color="statusColorMap[orderDetail.order.status] ?? 'neutral'"
            :label="statusLabelMap[orderDetail.order.status] ?? orderDetail.order.status"
            variant="subtle"
          />
          <UBadge
            v-if="orderDetail.order.payment_status"
            :color="paymentStatusColorMap[orderDetail.order.payment_status] ?? 'neutral'"
            :label="paymentStatusLabelMap[orderDetail.order.payment_status] ?? orderDetail.order.payment_status"
            variant="soft"
          />
        </div>
      </div>
      <div v-else-if="isLoadingDetail">
        <USkeleton class="h-6 w-32" />
        <USkeleton class="mt-1 h-4 w-24" />
      </div>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="isLoadingDetail" class="space-y-4 p-6">
        <USkeleton class="h-8 w-48" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-3/4" />
        <USkeleton class="h-32 w-full" />
      </div>

      <div v-else-if="orderDetail" class="space-y-5 p-4">
        <!-- Entrada -->
        <p class="text-sm text-muted">
          Entrada: {{ formatDate(orderDetail.order.entry_date) }}
        </p>

        <!-- Cliente e Veículo -->
        <UPageCard title="Cliente e Veículo" variant="subtle">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt class="text-muted">Cliente</dt>
              <dd class="font-medium text-highlighted">
                {{ orderDetail.client?.name ?? "—" }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">Telefone</dt>
              <dd>{{ orderDetail.client?.phone ?? "—" }}</dd>
            </div>
            <div>
              <dt class="text-muted">Veículo</dt>
              <dd class="font-medium text-highlighted">
                {{
                  orderDetail.vehicle
                    ? [
                        orderDetail.vehicle.brand,
                        orderDetail.vehicle.model,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "—"
                }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">Placa</dt>
              <dd>{{ orderDetail.vehicle?.license_plate ?? "—" }}</dd>
            </div>
          </dl>
        </UPageCard>

        <!-- Financeiro -->
        <UPageCard title="Financeiro" variant="subtle">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt class="text-muted">Total</dt>
              <dd class="text-base font-bold text-highlighted">
                {{ formatCurrency(orderDetail.order.total_amount) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">Desconto</dt>
              <dd>{{ formatCurrency(orderDetail.order.discount) }}</dd>
            </div>
            <div>
              <dt class="text-muted">Forma de pagamento</dt>
              <dd>{{ orderDetail.order.payment_method ?? "—" }}</dd>
            </div>
            <div>
              <dt class="text-muted">Parcelas</dt>
              <dd>{{ orderDetail.installments?.length ?? 0 }}</dd>
            </div>
          </dl>
        </UPageCard>

        <!-- Diagnóstico -->
        <UPageCard
          v-if="
            orderDetail.order.reported_defect || orderDetail.order.diagnosis
          "
          title="Diagnóstico"
          variant="subtle"
        >
          <div class="space-y-2 text-sm">
            <div v-if="orderDetail.order.reported_defect">
              <p class="text-xs text-muted">Defeito relatado</p>
              <p>{{ orderDetail.order.reported_defect }}</p>
            </div>
            <div v-if="orderDetail.order.diagnosis">
              <p class="text-xs text-muted">Diagnóstico técnico</p>
              <p>{{ orderDetail.order.diagnosis }}</p>
            </div>
          </div>
        </UPageCard>

        <!-- Itens -->
        <UPageCard
          v-if="orderDetail.order.items?.length"
          title="Itens"
          variant="subtle"
        >
          <div class="space-y-2">
            <div
              v-for="(item, i) in orderDetail.order.items"
              :key="i"
              class="flex items-center justify-between border-b border-default pb-1 text-sm last:border-0 last:pb-0"
            >
              <div>
                <span class="font-medium">{{
                  item.name ?? item.description
                }}</span>
                <span class="ml-1 text-muted">× {{ item.quantity }}</span>
              </div>
              <span>{{
                formatCurrency(
                  (item.unit_price ?? 0) * (item.quantity ?? 1),
                )
              }}</span>
            </div>
          </div>
        </UPageCard>

        <!-- Observações -->
        <UPageCard
          v-if="orderDetail.order.notes"
          title="Observações"
          variant="subtle"
        >
          <p class="text-sm">{{ orderDetail.order.notes }}</p>
        </UPageCard>

        <!-- Ações -->
        <div
          v-if="
            canCancel &&
            !['cancelled', 'delivered'].includes(orderDetail.order.status)
          "
          class="flex flex-wrap gap-2 pt-2"
        >
          <UButton
            label="Cancelar OS"
            icon="i-lucide-ban"
            color="warning"
            variant="outline"
            :loading="isCancelling"
            @click="requestCancel(orderDetail.order)"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
