<script setup lang="ts">
import type { ServiceOrder } from '~/types/service-orders'
import { canEditServiceOrder } from '~/utils/service-orders'

const props = defineProps<{
  order: ServiceOrder
  canCancel?: boolean
  canDelete?: boolean
  canCreate?: boolean
  canUpdate?: boolean
  isAdvancing?: boolean
  isEditing?: boolean
  isDuplicating?: boolean
}>()

const emit = defineEmits<{
  'view': [order: ServiceOrder]
  'cancel': [order: ServiceOrder]
  'delete': [order: ServiceOrder]
  'advance-status': [order: ServiceOrder]
  'edit': [order: ServiceOrder]
  'quote': [order: ServiceOrder]
  'duplicate': [order: ServiceOrder]
  'pay': [order: ServiceOrder]
}>()

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
const statusIconMap: Record<string, string> = {
  estimate: 'i-lucide-file-text',
  open: 'i-lucide-circle-dot',
  in_progress: 'i-lucide-wrench',
  waiting_for_part: 'i-lucide-clock-3',
  completed: 'i-lucide-circle-check',
  delivered: 'i-lucide-truck',
  cancelled: 'i-lucide-x-circle'
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
const paymentStatusIconMap: Record<string, string> = {
  pending: 'i-lucide-clock-3',
  paid: 'i-lucide-badge-check',
  partial: 'i-lucide-circle-dollar-sign'
}

type AdvanceInfo = { label: string, icon: string, color: 'info' | 'warning' | 'success' }

const nextStatusAdvanceMap: Record<string, AdvanceInfo> = {
  estimate: { label: 'Abrir OS', icon: 'i-lucide-circle-dot', color: 'info' },
  open: { label: 'Iniciar', icon: 'i-lucide-wrench', color: 'warning' },
  in_progress: { label: 'Concluir', icon: 'i-lucide-circle-check', color: 'success' }
}

const nextAdvanceInfo = computed(() => nextStatusAdvanceMap[props.order.status] ?? null)
const canAdvance = computed(() => props.canUpdate && nextAdvanceInfo.value !== null)
const isEstimate = computed(() => props.order.status === 'estimate')
const canEdit = computed(() =>
  props.canUpdate && canEditServiceOrder(props.order.status, props.order.payment_status)
)
const canPay = computed(() =>
  props.canUpdate
  && props.order.payment_status === 'pending'
  && props.order.status === 'completed'
)

function formatCurrency(value: number | string | null | undefined) {
  return parseFloat(String(value || 0)).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

function initials(value: string | null | undefined) {
  if (!value) return '—'

  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
}
</script>

<template>
  <UCard
    class="cursor-pointer border border-default/80 shadow-sm transition-colors hover:bg-elevated"
    @click="emit('view', order)"
  >
    <div class="flex items-start gap-4">
      <!-- Icon -->
      <div
        class="flex size-10 shrink-0 items-center justify-center rounded-xl"
        :class="order.status === 'cancelled' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'"
      >
        <UIcon name="i-lucide-clipboard-list" class="size-5" />
      </div>

      <div class="min-w-0 flex-1 space-y-2">
        <!-- Row 1: number + client + actions -->
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 space-y-1.5">
            <div class="flex min-w-0 items-center gap-2">
              <p class="truncate font-semibold text-highlighted">
                OS #{{ order.number }}
              </p>

              <div v-if="order.client_name" class="flex items-center gap-1.5">
                <UAvatar
                  :text="initials(order.client_name)"
                  size="xs"
                  class="shrink-0"
                  :ui="{ root: 'ring-2 ring-primary/20 bg-primary/10 text-primary' }"
                />
                <span class="truncate text-sm text-muted">{{ order.client_name }}</span>
              </div>
            </div>
            <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <div class="flex min-w-0 items-center gap-1.5">
                <UIcon name="i-lucide-car-front" class="size-3.5 shrink-0 text-primary" />
                <p class="truncate">
                  {{ order.vehicle_label ?? '-' }}
                </p>
              </div>

              <div class="flex shrink-0 items-center gap-1.5">
                <UIcon name="i-lucide-calendar-days" class="size-3.5 text-muted" />
                <span>{{ formatDate(order.entry_date) }}</span>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 flex-wrap items-center justify-end gap-1" @click.stop>
            <!-- Receber pagamento -->
            <UTooltip v-if="canPay" text="Receber pagamento">
              <UButton
                icon="i-lucide-credit-card"
                color="success"
                variant="ghost"
                size="sm"
                @click="emit('pay', order)"
              />
            </UTooltip>

            <!-- Avançar status -->
            <UTooltip v-if="canAdvance" :text="nextAdvanceInfo!.label">
              <UButton
                :icon="nextAdvanceInfo!.icon"
                :color="nextAdvanceInfo!.color"
                variant="ghost"
                size="sm"
                :loading="isAdvancing"
                @click="emit('advance-status', order)"
              />
            </UTooltip>

            <UTooltip v-if="isEstimate" text="Orçamento">
              <UButton
                icon="i-lucide-file-text"
                color="info"
                variant="ghost"
                size="sm"
                @click="emit('quote', order)"
              />
            </UTooltip>

            <UTooltip v-if="canEdit" text="Editar OS">
              <UButton
                icon="i-lucide-pencil"
                color="info"
                variant="ghost"
                size="sm"
                :loading="isEditing"
                @click="emit('edit', order)"
              />
            </UTooltip>

            <!-- Ver detalhes -->
            <UTooltip text="Ver detalhes">
              <UButton
                icon="i-lucide-eye"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="emit('view', order)"
              />
            </UTooltip>

            <!-- Duplicar -->
            <UTooltip v-if="canCreate" text="Duplicar OS">
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="ghost"
                size="sm"
                :loading="isDuplicating"
                @click="emit('duplicate', order)"
              />
            </UTooltip>

            <!-- Cancelar -->
            <UTooltip
              v-if="canCancel && !['cancelled', 'delivered'].includes(order.status)"
              text="Cancelar OS"
            >
              <UButton
                icon="i-lucide-ban"
                color="warning"
                variant="ghost"
                size="sm"
                @click="emit('cancel', order)"
              />
            </UTooltip>

            <!-- Excluir -->
            <UTooltip v-if="canDelete" text="Excluir OS">
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                @click="emit('delete', order)"
              />
            </UTooltip>
          </div>
        </div>

        <!-- Row 2: badges + responsible + value + date -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge
              :color="statusColorMap[order.status] ?? 'neutral'"
              :label="statusLabelMap[order.status] ?? order.status"
              :leading-icon="statusIconMap[order.status] ?? 'i-lucide-circle-dot'"
              variant="subtle"
              size="sm"
              class="px-2.5 py-1"
            />
            <UBadge
              v-if="order.payment_status"
              :color="paymentStatusColorMap[order.payment_status] ?? 'neutral'"
              :label="paymentStatusLabelMap[order.payment_status] ?? order.payment_status"
              :leading-icon="paymentStatusIconMap[order.payment_status] ?? 'i-lucide-credit-card'"
              variant="soft"
              size="sm"
              class="px-2.5 py-1"
            />

            <div v-if="order.responsible_names?.length" class="flex items-center gap-2 rounded-full bg-info/5 px-2 py-1">
              <UIcon name="i-lucide-user-round-cog" class="size-3.5 shrink-0 text-info" />
              <div class="flex -space-x-1.5">
                <UAvatar
                  v-for="name in order.responsible_names"
                  :key="name"
                  :text="initials(name)"
                  size="xs"
                  :ui="{ root: 'ring-2 ring-info/30 bg-info/10 text-info' }"
                />
              </div>
              <div class="flex flex-wrap gap-1">
                <UBadge
                  v-for="name in order.responsible_names"
                  :key="name"
                  :label="name"
                  color="info"
                  variant="soft"
                  size="xs"
                />
              </div>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <p class="flex items-center justify-end gap-1.5 text-sm font-semibold text-highlighted">
              {{ formatCurrency(order.total_amount) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
