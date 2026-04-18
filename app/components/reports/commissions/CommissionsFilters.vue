<script setup lang="ts">
import type { TagFilterOption } from '~/components/ui/TagFilter.vue'

export interface CommissionsFiltersProps {
  employees: Array<{ id: string; name: string }>
  orderStatusOptions: TagFilterOption[]
  paymentStatusOptions: TagFilterOption[]
  paymentMethodOptions: TagFilterOption[]
}

defineProps<CommissionsFiltersProps>()

const dateFrom = defineModel<string>('dateFrom')
const dateTo = defineModel<string>('dateTo')
const selectedEmployees = defineModel<string[]>('selectedEmployees', { default: () => [] })
const commissionStatus = defineModel<string[]>('commissionStatus', { default: () => [] })
const recordType = defineModel<string[]>('recordType', { default: () => [] })
const orderStatusFilters = defineModel<string[]>('orderStatusFilters', { default: () => [] })
const paymentStatusFilters = defineModel<string[]>('paymentStatusFilters', { default: () => [] })
const paymentMethods = defineModel<string[]>('paymentMethods', { default: () => [] })

const commissionStatusOptions: TagFilterOption[] = [
  { value: 'paid', label: 'Pagas', color: 'success', icon: 'i-lucide-circle-check' },
  { value: 'pending', label: 'Pendentes', color: 'warning', icon: 'i-lucide-clock' },
]

const recordTypeOptions: TagFilterOption[] = [
  { value: 'commission', label: 'Comissões', color: 'primary', icon: 'i-lucide-badge-percent' },
  { value: 'bonus', label: 'Bônus', color: 'info', icon: 'i-lucide-gift' },
]
</script>

<template>
  <UCard :ui="{ body: 'p-3' }">
    <div class="space-y-3">
      <div class="flex items-center gap-2 text-muted">
        <UIcon name="i-lucide-filter" class="size-4" />
        <span class="text-sm font-medium">Filtros</span>
      </div>

      <!-- Row 1: date range -->
      <div>
        <p class="mb-1 text-xs font-medium text-muted">Período</p>
        <UiDateRangePicker
          v-model:from="dateFrom"
          v-model:to="dateTo"
          class="w-full"
        />
      </div>

      <!-- Row 2: employee + commission status + record type -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p class="mb-1 text-xs font-medium text-muted">Funcionários</p>
          <UiTagFilter
            v-model="selectedEmployees"
            :options="employees.map(e => ({ value: e.id, label: e.name, color: 'neutral' as const, icon: 'i-lucide-user' }))"
            placeholder="Selecionar"
            class="w-full"
          />
        </div>
        <div>
          <p class="mb-1 text-xs font-medium text-muted">Status comissão</p>
          <UiTagFilter
            v-model="commissionStatus"
            :options="commissionStatusOptions"
            placeholder="Todos"
            class="w-full"
          />
        </div>
        <div>
          <p class="mb-1 text-xs font-medium text-muted">Tipo</p>
          <UiTagFilter
            v-model="recordType"
            :options="recordTypeOptions"
            placeholder="Todos"
            class="w-full"
          />
        </div>
      </div>

      <!-- Row 3: OS status + payment status + payment method -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p class="mb-1 text-xs font-medium text-muted">Status da OS</p>
          <UiTagFilter
            v-model="orderStatusFilters"
            :options="orderStatusOptions"
            placeholder="Todos"
            class="w-full"
          />
        </div>
        <div>
          <p class="mb-1 text-xs font-medium text-muted">Pagamento da OS</p>
          <UiTagFilter
            v-model="paymentStatusFilters"
            :options="paymentStatusOptions"
            placeholder="Todos"
            class="w-full"
          />
        </div>
        <div>
          <p class="mb-1 text-xs font-medium text-muted">Forma de pagamento</p>
          <UiTagFilter
            v-model="paymentMethods"
            :options="paymentMethodOptions"
            placeholder="Todas"
            class="w-full"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
