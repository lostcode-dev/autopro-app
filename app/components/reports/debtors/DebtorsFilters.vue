<script setup lang="ts">
import type { TagFilterOption } from '~/components/ui/TagFilter.vue'
import {
  debtorStatusIcon,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
  paymentMethodColor,
  paymentMethodIcon
} from '~/utils/report-debtors'

const props = defineProps<{
  clients: Array<{ value: string, label: string }>
}>()

const dateFrom = defineModel<string>('dateFrom')
const dateTo = defineModel<string>('dateTo')
const clientIds = defineModel<string[]>('clientIds', { default: () => [] })
const statusFilters = defineModel<string[]>('statusFilters', { default: () => [] })
const paymentMethodFilters = defineModel<string[]>('paymentMethodFilters', { default: () => [] })
const orderStatusFilters = defineModel<string[]>('orderStatusFilters', { default: () => [] })

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.charAt(0) ?? '?').toUpperCase()
  return ((parts[0]?.charAt(0) ?? '') + (parts[parts.length - 1]?.charAt(0) ?? '')).toUpperCase()
}

const statusOptions: TagFilterOption[] = [
  { value: 'overdue', label: 'Em atraso', color: 'error', icon: debtorStatusIcon('overdue') },
  { value: 'current', label: 'Em dia', color: 'success', icon: debtorStatusIcon('current') }
]

const paymentMethodOptions: TagFilterOption[] = [
  'pix',
  'cash',
  'credit_card',
  'debit_card',
  'bank_transfer',
  'check',
  'boleto',
  'no_payment'
].map(method => ({
  value: method,
  label: formatPaymentMethodLabel(method),
  color: paymentMethodColor(method),
  icon: paymentMethodIcon(method)
}))

const orderStatusOptions: TagFilterOption[] = [
  'open',
  'in_progress',
  'waiting_for_part',
  'completed',
  'delivered',
  'estimate'
].map(status => ({
  value: status,
  label: formatOrderStatusLabel(status),
  color: status === 'completed' || status === 'delivered' ? 'success' : status === 'estimate' ? 'neutral' : status === 'open' ? 'info' : 'warning',
  icon: status === 'open'
    ? 'i-lucide-circle-dot'
    : status === 'in_progress'
      ? 'i-lucide-wrench'
      : status === 'waiting_for_part'
        ? 'i-lucide-package-search'
        : status === 'estimate'
          ? 'i-lucide-file-text'
          : status === 'delivered'
            ? 'i-lucide-truck'
            : 'i-lucide-check-circle-2'
}))

const clientOptions = computed<TagFilterOption[]>(() =>
  [...props.clients]
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
    .map(client => ({
      value: client.value,
      label: client.label,
      color: 'neutral' as const,
      initials: getInitials(client.label)
    }))
)
</script>

<template>
  <UCard :ui="{ body: 'p-3' }">
    <div class="space-y-3 grid grid-cols-2 gap-3">
      <div class="col-span-2 flex items-center gap-2 text-muted">
        <UIcon name="i-lucide-filter" class="size-4" />
        <span class="text-sm font-medium">Filtros</span>
      </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          Período
        </p>
        <UiDateRangePicker
          v-model:from="dateFrom"
          v-model:to="dateTo"
          class="w-full"
        />
      </div>

      <div />

      <div class="col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p class="mb-1 text-xs font-medium text-muted">
            Clientes
          </p>
          <UiTagFilter
            v-model="clientIds"
            :options="clientOptions"
            placeholder="Todos"
            class="w-full"
          />
        </div>

        <div>
          <p class="mb-1 text-xs font-medium text-muted">
            Status da pendência
          </p>
          <UiTagFilter
            v-model="statusFilters"
            :options="statusOptions"
            placeholder="Todos"
            class="w-full"
          />
        </div>
      </div>

      <div class="col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p class="mb-1 text-xs font-medium text-muted">
            Forma de pagamento
          </p>
          <UiTagFilter
            v-model="paymentMethodFilters"
            :options="paymentMethodOptions"
            placeholder="Todas"
            class="w-full"
          />
        </div>

        <div>
          <p class="mb-1 text-xs font-medium text-muted">
            Status da OS
          </p>
          <UiTagFilter
            v-model="orderStatusFilters"
            :options="orderStatusOptions"
            placeholder="Todos"
            class="w-full"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
