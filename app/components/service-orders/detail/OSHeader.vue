<script setup lang="ts">
import type { ServiceOrderRaw } from '~/types/service-orders'
import {
  STATUS_COLOR,
  STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  ADVANCE_STATUS_MAP,
  getNextStatus
} from '~/utils/service-orders'

const props = defineProps<{
  order: ServiceOrderRaw
  canUpdate?: boolean
  canCancel?: boolean
  canDelete?: boolean
  canCreate?: boolean
  isAdvancing?: boolean
  isCancellingPayment?: boolean
}>()

const emit = defineEmits<{
  close: []
  pay: []
  'cancel-payment': []
  'advance-status': []
  cancel: []
  delete: []
  duplicate: []
}>()

const nextStatus = computed(() => getNextStatus(props.order.status))
const advanceInfo = computed(() => nextStatus.value ? ADVANCE_STATUS_MAP[props.order.status] : null)

const isCancelled = computed(() => props.order.status === 'cancelled')
const isEstimate = computed(() => props.order.status === 'estimate')

const canPay = computed(() =>
  props.canUpdate
  && props.order.payment_status === 'pending'
  && !isEstimate.value
  && !isCancelled.value
)

const canCancelPayment = computed(() =>
  props.canUpdate
  && (props.order.payment_status === 'paid' || props.order.payment_status === 'partial')
  && !isCancelled.value
)

const canAdvance = computed(() =>
  props.canUpdate && !!advanceInfo.value && !isCancelled.value
)
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-4 p-4 border-b border-default">
    <!-- Left: close + identity -->
    <div class="flex items-center gap-3 min-w-0">
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Fechar"
        @click="emit('close')"
      />
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-highlighted truncate">
          OS #{{ order.number ?? '—' }}
        </h1>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <UBadge
            :color="STATUS_COLOR[order.status] ?? 'neutral'"
            :label="STATUS_LABEL[order.status] ?? order.status"
            variant="subtle"
          />
          <UBadge
            v-if="order.payment_status"
            :color="PAYMENT_STATUS_COLOR[order.payment_status] ?? 'neutral'"
            :label="PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status"
            variant="soft"
          />
          <UBadge
            v-if="order.is_installment && order.installment_count"
            color="info"
            :label="`${order.installment_count}x`"
            variant="outline"
          />
        </div>
      </div>
    </div>

    <!-- Right: actions -->
    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <!-- Receber pagamento -->
      <UButton
        v-if="canPay"
        label="Receber"
        icon="i-lucide-credit-card"
        color="success"
        size="sm"
        @click="emit('pay')"
      />

      <!-- Cancelar pagamento -->
      <UButton
        v-if="canCancelPayment"
        label="Cancelar pagamento"
        icon="i-lucide-credit-card"
        color="error"
        variant="outline"
        size="sm"
        :loading="isCancellingPayment"
        @click="emit('cancel-payment')"
      />

      <!-- Avançar status -->
      <UButton
        v-if="canAdvance && advanceInfo"
        :label="advanceInfo.label"
        :icon="advanceInfo.icon"
        :color="advanceInfo.color"
        variant="outline"
        size="sm"
        :loading="isAdvancing"
        @click="emit('advance-status')"
      />

      <!-- Duplicar -->
      <UTooltip v-if="canCreate" text="Duplicar OS">
        <UButton
          icon="i-lucide-copy"
          color="neutral"
          variant="outline"
          size="sm"
          @click="emit('duplicate')"
        />
      </UTooltip>

      <!-- Cancelar OS -->
      <UTooltip v-if="canCancel && !isCancelled" text="Cancelar OS">
        <UButton
          icon="i-lucide-ban"
          color="warning"
          variant="outline"
          size="sm"
          @click="emit('cancel')"
        />
      </UTooltip>

      <!-- Excluir OS -->
      <UTooltip v-if="canDelete" text="Excluir OS">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="outline"
          size="sm"
          @click="emit('delete')"
        />
      </UTooltip>
    </div>
  </div>
</template>
