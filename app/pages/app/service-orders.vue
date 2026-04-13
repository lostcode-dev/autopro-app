<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Ordens de Serviço' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.ORDERS_READ))
const canCreate = computed(() => workshop.can(ActionCode.ORDERS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.ORDERS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.ORDERS_DELETE))
const canCancel = computed(() => workshop.can(ActionCode.ORDERS_CANCEL))

type ServiceOrder = Record<string, any>

// ─── Filters ─────────────────────────────────────
const searchTerm = ref('')
const statusFilter = ref('all')
const cursor = ref(0)
const limit = 20

const { data, status, refresh } = await useAsyncData(
  () => `service-orders-${cursor.value}-${searchTerm.value}-${statusFilter.value}`,
  () => requestFetch<{ items: ServiceOrder[], total: number, hasMore: boolean, nextCursor: number }>(
    '/api/service-orders',
    {
      headers: requestHeaders,
      query: {
        searchTerm: searchTerm.value || undefined,
        status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
        cursor: cursor.value,
        limit
      }
    }
  ),
  { watch: [searchTerm, statusFilter, cursor] }
)

// ─── Detail view ─────────────────────────────────
const selectedOrderId = ref<string | null>(null)
const showDetail = ref(false)
const isLoadingDetail = ref(false)
const orderDetail = ref<any | null>(null)

async function openDetail(order: ServiceOrder) {
  selectedOrderId.value = order.id
  showDetail.value = true
  isLoadingDetail.value = true
  try {
    const result = await $fetch<any>(`/api/service-orders/${order.id}`)
    orderDetail.value = result.data
  } catch {
    toast.add({ title: 'Erro ao carregar detalhes', color: 'error' })
    showDetail.value = false
  } finally {
    isLoadingDetail.value = false
  }
}

function closeDetail() {
  showDetail.value = false
  orderDetail.value = null
  selectedOrderId.value = null
}

// ─── Cancel ──────────────────────────────────────
const isCancelling = ref(false)

async function cancelOrder(order: ServiceOrder) {
  if (isCancelling.value) return
  isCancelling.value = true
  try {
    await $fetch(`/api/service-orders/${order.id}/cancel`, { method: 'POST' })
    toast.add({ title: 'OS cancelada', color: 'success' })
    await refresh()
    if (showDetail.value && selectedOrderId.value === order.id) {
      closeDetail()
    }
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Não foi possível cancelar', color: 'error' })
  } finally {
    isCancelling.value = false
  }
}

// ─── Delete ───────────────────────────────────────
const isDeleting = ref(false)

async function deleteOrder(order: ServiceOrder) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/service-orders/${order.id}`, { method: 'DELETE' })
    toast.add({ title: 'OS removida', color: 'success' })
    await refresh()
    if (showDetail.value && selectedOrderId.value === order.id) closeDetail()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

function formatCurrency(value: number | string) {
  return parseFloat(String(value || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
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

const statusColorMap: Record<string, string> = {
  estimate: 'neutral',
  open: 'info',
  in_progress: 'warning',
  waiting_for_part: 'orange',
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
const paymentStatusColorMap: Record<string, string> = {
  pending: 'warning',
  paid: 'success',
  partial: 'info'
}
const paymentStatusLabelMap: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  partial: 'Parcial'
}

const columns = [
  { accessorKey: 'number', header: 'OS' },
  { id: 'client', header: 'Cliente' },
  { id: 'vehicle', header: 'Veículo' },
  { accessorKey: 'entry_date', header: 'Entrada' },
  { id: 'status', header: 'Status' },
  { id: 'payment_status', header: 'Pagamento' },
  { id: 'total_amount', header: 'Total' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Ordens de Serviço">
        <template #leading>
          <AppSidebarCollapse />
        </template>
        <template #right>
          <NotificationsButton />
        </template>
      </UDashboardNavbar>
    </template>

    <div v-if="!canRead" class="p-6">
      <p class="text-sm text-muted">
        Você não tem permissão para visualizar ordens de serviço.
      </p>
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="flex flex-wrap gap-3 p-4 border-b border-default">
        <UInput
          v-model="searchTerm"
          placeholder="Buscar por número ou cliente..."
          icon="i-lucide-search"
          class="w-72"
          @update:model-value="cursor = 0"
        />
        <USelectMenu
          v-model="statusFilter"
          :items="statusFilterOptions"
          value-key="value"
          class="w-44"
          @update:model-value="cursor = 0"
        />
      </div>

      <!-- Table -->
      <div v-if="status === 'pending'" class="p-4 space-y-3">
        <USkeleton v-for="i in 8" :key="i" class="h-10 w-full" />
      </div>

      <UTable
        v-else
        :columns="columns"
        :data="data?.items || []"
        class="min-h-0 flex-1"
      >
        <template #client-cell="{ row }">
          {{ row.original._clientName ?? '—' }}
        </template>
        <template #vehicle-cell="{ row }">
          {{ row.original._vehicleLabel ?? '—' }}
        </template>
        <template #entry_date-cell="{ row }">
          {{ formatDate(row.original.entry_date) }}
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :color="statusColorMap[row.original.status] ?? 'neutral'"
            variant="subtle"
            :label="statusLabelMap[row.original.status] ?? row.original.status"
            size="sm"
          />
        </template>
        <template #payment_status-cell="{ row }">
          <UBadge
            v-if="row.original.payment_status"
            :color="paymentStatusColorMap[row.original.payment_status] ?? 'neutral'"
            variant="soft"
            :label="paymentStatusLabelMap[row.original.payment_status] ?? row.original.payment_status"
            size="sm"
          />
        </template>
        <template #total_amount-cell="{ row }">
          {{ formatCurrency(row.original.total_amount) }}
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center gap-1 justify-end">
            <UButton
              icon="i-lucide-eye"
              color="neutral"
              variant="ghost"
              size="xs"
              title="Ver detalhes"
              @click="openDetail(row.original)"
            />
            <UButton
              v-if="canCancel && !['cancelled', 'delivered'].includes(row.original.status)"
              icon="i-lucide-ban"
              color="warning"
              variant="ghost"
              size="xs"
              :loading="isCancelling"
              title="Cancelar"
              @click="cancelOrder(row.original)"
            />
            <UButton
              v-if="canDelete"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :loading="isDeleting"
              @click="deleteOrder(row.original)"
            />
          </div>
        </template>
      </UTable>

      <!-- Cursor pagination -->
      <div class="flex items-center justify-between p-4 border-t border-default">
        <span class="text-sm text-muted">Total: {{ data?.total ?? 0 }}</span>
        <div class="flex gap-2">
          <UButton
            label="Anterior"
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="cursor === 0"
            @click="cursor = Math.max(0, cursor - limit)"
          />
          <UButton
            label="Próximo"
            icon="i-lucide-chevron-right"
            trailing
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="!data?.hasMore"
            @click="cursor = (data?.nextCursor ?? cursor + limit)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Detail Slideover -->
  <USlideover
    v-model:open="showDetail"
    title="Detalhes da OS"
    side="right"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div v-if="isLoadingDetail" class="p-6 space-y-4">
        <USkeleton class="h-8 w-48" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-3/4" />
        <USkeleton class="h-32 w-full" />
      </div>

      <div v-else-if="orderDetail" class="p-4 space-y-5">
        <!-- Header -->
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold">
              OS {{ orderDetail.order.number }}
            </h2>
            <p class="text-sm text-muted">
              Entrada: {{ formatDate(orderDetail.order.entry_date) }}
            </p>
          </div>
          <div class="flex gap-2">
            <UBadge
              :color="statusColorMap[orderDetail.order.status] ?? 'neutral'"
              variant="subtle"
              :label="statusLabelMap[orderDetail.order.status] ?? orderDetail.order.status"
            />
            <UBadge
              v-if="orderDetail.order.payment_status"
              :color="paymentStatusColorMap[orderDetail.order.payment_status] ?? 'neutral'"
              variant="soft"
              :label="paymentStatusLabelMap[orderDetail.order.payment_status] ?? orderDetail.order.payment_status"
            />
          </div>
        </div>

        <!-- Client & Vehicle -->
        <UPageCard title="Cliente e Veículo" variant="subtle">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt class="text-muted">
                Cliente
              </dt>
              <dd class="font-medium">
                {{ orderDetail.client?.name ?? '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Telefone
              </dt>
              <dd>{{ orderDetail.client?.phone ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted">
                Veículo
              </dt>
              <dd class="font-medium">
                {{ orderDetail.vehicle ? [orderDetail.vehicle.brand, orderDetail.vehicle.model].filter(Boolean).join(' ') : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Placa
              </dt>
              <dd>{{ orderDetail.vehicle?.license_plate ?? '—' }}</dd>
            </div>
          </dl>
        </UPageCard>

        <!-- Financial -->
        <UPageCard title="Financeiro" variant="subtle">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt class="text-muted">
                Total
              </dt>
              <dd class="font-bold text-base">
                {{ formatCurrency(orderDetail.order.total_amount) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">
                Desconto
              </dt>
              <dd>{{ formatCurrency(orderDetail.order.discount) }}</dd>
            </div>
            <div>
              <dt class="text-muted">
                Forma de pagamento
              </dt>
              <dd>{{ orderDetail.order.payment_method ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-muted">
                Parcelas
              </dt>
              <dd>{{ orderDetail.installments?.length ?? 0 }}</dd>
            </div>
          </dl>
        </UPageCard>

        <!-- Reported defect / diagnosis -->
        <UPageCard v-if="orderDetail.order.reported_defect || orderDetail.order.diagnosis" title="Diagnóstico" variant="subtle">
          <div class="space-y-2 text-sm">
            <div v-if="orderDetail.order.reported_defect">
              <p class="text-muted text-xs">
                Defeito relatado
              </p>
              <p>{{ orderDetail.order.reported_defect }}</p>
            </div>
            <div v-if="orderDetail.order.diagnosis">
              <p class="text-muted text-xs">
                Diagnóstico técnico
              </p>
              <p>{{ orderDetail.order.diagnosis }}</p>
            </div>
          </div>
        </UPageCard>

        <!-- Items -->
        <UPageCard v-if="orderDetail.order.items?.length" title="Itens" variant="subtle">
          <div class="space-y-2">
            <div
              v-for="(item, i) in orderDetail.order.items"
              :key="i"
              class="flex items-center justify-between text-sm border-b border-default last:border-0 pb-1 last:pb-0"
            >
              <div>
                <span class="font-medium">{{ item.name ?? item.description }}</span>
                <span class="text-muted ml-1">× {{ item.quantity }}</span>
              </div>
              <span>{{ formatCurrency((item.unit_price ?? 0) * (item.quantity ?? 1)) }}</span>
            </div>
          </div>
        </UPageCard>

        <!-- Notes -->
        <UPageCard v-if="orderDetail.order.notes" title="Observações" variant="subtle">
          <p class="text-sm">
            {{ orderDetail.order.notes }}
          </p>
        </UPageCard>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2 pt-2">
          <UButton
            v-if="canCancel && !['cancelled', 'delivered'].includes(orderDetail.order.status)"
            label="Cancelar OS"
            icon="i-lucide-ban"
            color="warning"
            variant="outline"
            :loading="isCancelling"
            @click="cancelOrder(orderDetail.order)"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
