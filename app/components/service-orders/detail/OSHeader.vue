<script setup lang="ts">
import type { ServiceOrderRaw, ServiceOrderDetailFull, ServiceOrderEmployee } from '~/types/service-orders'
import {
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_ICON,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_ICON,
  ADVANCE_STATUS_MAP,
  getNextStatus
} from '~/utils/service-orders'

const props = defineProps<{
  order: ServiceOrderRaw
  client?: ServiceOrderDetailFull['client']
  responsibleNames?: ServiceOrderDetailFull['responsibleNames']
  employees?: ServiceOrderEmployee[]
  canUpdate?: boolean
  canCancel?: boolean
  canDelete?: boolean
  canCreate?: boolean
  isAdvancing?: boolean
  isCancellingPayment?: boolean
}>()

const emit = defineEmits<{
  'close': []
  'pay': []
  'cancel-payment': []
  'advance-status': []
  'cancel': []
  'delete': []
  'duplicate': []
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

// ─── Avatar helpers ────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

interface ResponsibleWithPhoto {
  employee_id: string
  name: string | null
  photo_url: string | null
}

const resolvedResponsibles = computed<ResponsibleWithPhoto[]>(() => {
  return (props.responsibleNames ?? []).map((r) => {
    const emp = (props.employees ?? []).find(e => e.id === r.employee_id)
    return {
      employee_id: r.employee_id,
      name: r.name,
      photo_url: emp?.photo_url ?? null
    }
  })
})

const hasContextInfo = computed(() => !!props.client || resolvedResponsibles.value.length > 0)
</script>

<template>
  <div class="flex items-center gap-3 border-b border-default px-5 py-4 min-w-0">
    <!-- Close -->
    <UButton
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      size="sm"
      aria-label="Fechar"
      class="shrink-0"
      @click="emit('close')"
    />

    <!-- Identity: title + badges + context avatars -->
    <div class="flex min-w-0 flex-1 flex-col gap-1.5">
      <h1 class="text-xl font-bold text-highlighted leading-tight">
        OS #{{ order.number ?? '—' }}
      </h1>

      <div class="flex flex-wrap items-center gap-2">
        <!-- OS status badge with icon -->
        <UBadge
          :color="STATUS_COLOR[order.status] ?? 'neutral'"
          :label="STATUS_LABEL[order.status] ?? order.status"
          :leading-icon="STATUS_ICON[order.status]"
          variant="subtle"
          size="sm"
        />

        <!-- Payment status badge with icon -->
        <UBadge
          v-if="order.payment_status"
          :color="PAYMENT_STATUS_COLOR[order.payment_status] ?? 'neutral'"
          :label="PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status"
          :leading-icon="PAYMENT_STATUS_ICON[order.payment_status]"
          variant="soft"
          size="sm"
        />

        <!-- Installments badge -->
        <UBadge
          v-if="order.is_installment && order.installment_count"
          color="info"
          :label="`${order.installment_count}x`"
          leading-icon="i-lucide-layers"
          variant="outline"
          size="sm"
        />

        <!-- Separator -->
        <template v-if="hasContextInfo">
          <UDivider orientation="vertical" class="h-4 mx-1" />

          <!-- Client avatar -->
          <UTooltip v-if="client" :text="client.name">
            <div class="flex items-center gap-1.5 cursor-default">
              <UAvatar
                :text="initials(client.name)"
                size="xs"
                :ui="{ root: 'ring-2 ring-primary/30' }"
              />
              <span class="text-xs text-muted hidden lg:block max-w-32 truncate">{{ client.name }}</span>
            </div>
          </UTooltip>

          <!-- Responsibles avatar stack -->
          <div v-if="resolvedResponsibles.length" class="flex items-center gap-1.5">
            <div class="flex -space-x-1.5">
              <UTooltip
                v-for="r in resolvedResponsibles"
                :key="r.employee_id"
                :text="r.name ?? 'Funcionário'"
              >
                <UAvatar
                  :src="r.photo_url ?? undefined"
                  :text="initials(r.name)"
                  size="xs"
                  :ui="{ root: 'ring-2 ring-default' }"
                />
              </UTooltip>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex shrink-0 items-center gap-2">
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

      <UDivider
        v-if="canCreate || (canCancel && !isCancelled) || canDelete"
        orientation="vertical"
        class="h-5"
      />

      <!-- Duplicar -->
      <UTooltip v-if="canCreate" text="Duplicar OS">
        <UButton
          icon="i-lucide-copy"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="emit('duplicate')"
        />
      </UTooltip>

      <!-- Cancelar OS -->
      <UTooltip v-if="canCancel && !isCancelled" text="Cancelar OS">
        <UButton
          icon="i-lucide-ban"
          color="warning"
          variant="ghost"
          size="sm"
          @click="emit('cancel')"
        />
      </UTooltip>

      <!-- Excluir OS -->
      <UTooltip v-if="canDelete" text="Excluir OS">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          @click="emit('delete')"
        />
      </UTooltip>
    </div>
  </div>
</template>
