<script setup lang="ts">
import type { ServiceOrder } from '~/types/service-orders'

const props = defineProps<{
  order: ServiceOrder
  canCancel?: boolean
  canDelete?: boolean
  canCreate?: boolean
  canUpdate?: boolean
  isAdvancing?: boolean
  isDuplicating?: boolean
}>()

const emit = defineEmits<{
  view: [order: ServiceOrder]
  cancel: [order: ServiceOrder]
  delete: [order: ServiceOrder]
  'advance-status': [order: ServiceOrder]
  duplicate: [order: ServiceOrder]
  pay: [order: ServiceOrder]
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

type AdvanceInfo = { label: string; icon: string; color: 'info' | 'warning' | 'success' }

const nextStatusAdvanceMap: Record<string, AdvanceInfo> = {
  estimate: { label: 'Abrir OS', icon: 'i-lucide-circle-dot', color: 'info' },
  open: { label: 'Iniciar', icon: 'i-lucide-wrench', color: 'warning' },
  in_progress: { label: 'Concluir', icon: 'i-lucide-circle-check', color: 'success' }
}

const nextAdvanceInfo = computed(() => nextStatusAdvanceMap[props.order.status] ?? null)
const canAdvance = computed(() => props.canUpdate && nextAdvanceInfo.value !== null)
const canPay = computed(() =>
  props.canUpdate
  && props.order.payment_status === 'pending'
  && !['estimate', 'cancelled'].includes(props.order.status)
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
          <div class="min-w-0">
            <p class="truncate font-semibold text-highlighted">
              OS #{{ order.number }}
              <span class="font-normal text-muted">—</span>
              {{ order.client_name ?? '—' }}
            </p>
            <p class="truncate text-xs text-muted">
              {{ order.vehicle_label ?? 'Veículo não informado' }}
            </p>
          </div>

          <div class="flex shrink-0 flex-wrap items-center justify-end gap-1" @click.stop>
            <!-- Receber pagamento -->
            <UTooltip v-if="canPay" text="Receber pagamento">
              <UButton
                icon="i-lucide-credit-card"
                color="success"
                variant="ghost"
                size="xs"
                @click="emit('pay', order)"
              />
            </UTooltip>

            <!-- Avançar status -->
            <UTooltip v-if="canAdvance" :text="nextAdvanceInfo!.label">
              <UButton
                :icon="nextAdvanceInfo!.icon"
                :color="nextAdvanceInfo!.color"
                variant="ghost"
                size="xs"
                :loading="isAdvancing"
                @click="emit('advance-status', order)"
              />
            </UTooltip>

            <!-- Ver detalhes -->
            <UTooltip text="Ver detalhes">
              <UButton
                icon="i-lucide-eye"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="emit('view', order)"
              />
            </UTooltip>

            <!-- Duplicar -->
            <UTooltip v-if="canCreate" text="Duplicar OS">
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="ghost"
                size="xs"
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
                size="xs"
                @click="emit('cancel', order)"
              />
            </UTooltip>

            <!-- Excluir -->
            <UTooltip v-if="canDelete" text="Excluir OS">
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                @click="emit('delete', order)"
              />
            </UTooltip>
          </div>
        </div>

        <!-- Row 2: defect -->
        <p v-if="order.reported_defect" class="truncate text-sm text-muted">
          {{ order.reported_defect }}
        </p>

        <!-- Row 3: badges + responsible + value + date -->
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <UBadge
              :color="statusColorMap[order.status] ?? 'neutral'"
              :label="statusLabelMap[order.status] ?? order.status"
              variant="subtle"
              size="xs"
            />
            <UBadge
              v-if="order.payment_status"
              :color="paymentStatusColorMap[order.payment_status] ?? 'neutral'"
              :label="paymentStatusLabelMap[order.payment_status] ?? order.payment_status"
              variant="soft"
              size="xs"
            />
            <span v-if="order.responsible_name" class="text-xs text-muted">
              · {{ order.responsible_name }}
            </span>
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
</template>
