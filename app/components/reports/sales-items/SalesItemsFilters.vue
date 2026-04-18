<script setup lang="ts">
import type { TagFilterOption } from '~/components/ui/TagFilter.vue'
import {
  formatSalesPaymentMethodLabel,
  formatSalesOrderStatusLabel,
  salesPaymentMethodColor,
  salesOrderStatusColor
} from '~/utils/report-sales-items'

const props = defineProps<{
  clients: Array<{ value: string, label: string }>
  orders: Array<{ value: string, label: string }>
  responsibles: Array<{ value: string, label: string }>
  categories: Array<{ value: string, label: string }>
  statuses: Array<{ value: string, label: string }>
}>()

const dateFrom = defineModel<string>('dateFrom')
const dateTo = defineModel<string>('dateTo')
const clientIds = defineModel<string[]>('clientIds', { default: () => [] })
const orderIds = defineModel<string[]>('orderIds', { default: () => [] })
const responsibleIds = defineModel<string[]>('responsibleIds', { default: () => [] })
const statusFilters = defineModel<string[]>('statusFilters', { default: () => [] })
const paymentStatusFilters = defineModel<string[]>('paymentStatusFilters', { default: () => [] })
const paymentMethodFilters = defineModel<string[]>('paymentMethodFilters', { default: () => [] })
const categoryIds = defineModel<string[]>('categoryIds', { default: () => [] })
const costFilters = defineModel<string[]>('costFilters', { default: () => [] })
const costSources = defineModel<string[]>('costSources', { default: () => [] })

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.charAt(0) ?? '?').toUpperCase()
  return ((parts[0]?.charAt(0) ?? '') + (parts[parts.length - 1]?.charAt(0) ?? '')).toUpperCase()
}

function toTagOptions(values: Array<{ value: string, label: string }>): TagFilterOption[] {
  return values.map(value => ({
    value: value.value,
    label: value.label,
    color: 'neutral' as const,
    initials: getInitials(value.label)
  }))
}

const paymentStatusOptions: TagFilterOption[] = [
  { value: 'paid', label: 'Pago', color: 'success', icon: 'i-lucide-circle-check' },
  { value: 'pending', label: 'Pendente', color: 'warning', icon: 'i-lucide-clock' }
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
  label: formatSalesPaymentMethodLabel(method),
  color: salesPaymentMethodColor(method) as TagFilterOption['color']
}))

const costFilterOptions: TagFilterOption[] = [
  { value: 'withCost', label: 'Somente com custo', color: 'success', icon: 'i-lucide-badge-check' },
  { value: 'zeroCost', label: 'Somente sem custo', color: 'warning', icon: 'i-lucide-badge-minus' }
]

const costSourceOptions: TagFilterOption[] = [
  { value: 'item', label: 'Informado na OS', color: 'success', icon: 'i-lucide-clipboard-pen-line' },
  { value: 'product', label: 'Cadastro do produto', color: 'info', icon: 'i-lucide-package-search' },
  { value: 'none', label: 'Não informado', color: 'neutral', icon: 'i-lucide-circle-slash-2' }
]

const statusOptions = computed<TagFilterOption[]>(() =>
  props.statuses.map(status => ({
    value: status.value,
    label: formatSalesOrderStatusLabel(status.value),
    color: salesOrderStatusColor(status.value) as TagFilterOption['color']
  }))
)
</script>

<template>
  <UCard :ui="{ body: 'p-3' }">
    <div class="grid grid-cols-2 gap-3 space-y-3">
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

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          Clientes
        </p>
        <UiTagFilter
          v-model="clientIds"
          :options="toTagOptions(props.clients)"
          placeholder="Todos"
          class="w-full"
        />
      </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          OS
        </p>
        <UiTagFilter
          v-model="orderIds"
          :options="toTagOptions(props.orders)"
          placeholder="Todas"
          class="w-full"
        />
      </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          Responsáveis
        </p>
        <UiTagFilter
          v-model="responsibleIds"
          :options="toTagOptions(props.responsibles)"
          placeholder="Todos"
          class="w-full"
        />
      </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          Categorias
        </p>
        <UiTagFilter
          v-model="categoryIds"
          :options="toTagOptions(props.categories)"
          placeholder="Todas"
          class="w-full"
        />
      </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          Status da OS
        </p>
        <UiTagFilter
          v-model="statusFilters"
          :options="statusOptions"
          placeholder="Todos"
          class="w-full"
        />
      </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          Status do pagamento
        </p>
        <UiTagFilter
          v-model="paymentStatusFilters"
          :options="paymentStatusOptions"
          placeholder="Todos"
          class="w-full"
        />
      </div>

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
          Filtro de custo
        </p>
        <UiTagFilter
          v-model="costFilters"
          :options="costFilterOptions"
          placeholder="Todos"
          class="w-full"
        />
      </div>

      <div class="col-span-2">
        <p class="mb-1 text-xs font-medium text-muted">
          Origem do custo
        </p>
        <UiTagFilter
          v-model="costSources"
          :options="costSourceOptions"
          placeholder="Todas"
          class="w-full"
        />
      </div>
    </div>
  </UCard>
</template>
