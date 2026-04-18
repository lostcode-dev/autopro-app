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
const search = defineModel<string>('search', { default: '' })
const selectedEmployees = defineModel<string[]>('selectedEmployees', { default: () => [] })
const commissionStatus = defineModel<string>('commissionStatus', { default: 'all' })
const recordType = defineModel<string>('recordType', { default: 'all' })
const orderStatusFilters = defineModel<string[]>('orderStatusFilters', { default: () => [] })
const paymentStatusFilters = defineModel<string[]>('paymentStatusFilters', { default: () => [] })
const paymentMethods = defineModel<string[]>('paymentMethods', { default: () => [] })

const commissionStatusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Pagas' },
  { value: 'pending', label: 'Pendentes' },
]

const recordTypeOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'commission', label: 'Comissões' },
  { value: 'bonus', label: 'Bônus' },
]
</script>

<template>
  <UCard :ui="{ body: 'p-3' }">
    <div class="space-y-3">
      <div class="flex items-center gap-2 text-muted">
        <UIcon name="i-lucide-filter" class="size-4" />
        <span class="text-sm font-medium">Filtros</span>
      </div>

      <!-- Row 1: date + search -->
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <UiDateRangePicker
          v-model:from="dateFrom"
          v-model:to="dateTo"
          class="w-full"
        />
        <UInput
          v-model="search"
          placeholder="Buscar funcionário..."
          icon="i-lucide-search"
          class="w-full"
        />
      </div>

      <!-- Row 2: employee + commission status + record type -->
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <UiTagFilter
          v-model="selectedEmployees"
          :options="employees.map(e => ({ value: e.id, label: e.name, color: 'neutral' as const, icon: 'i-lucide-user' }))"
          placeholder="Funcionários"
          class="w-full"
        />
        <USelect
          v-model="commissionStatus"
          :items="commissionStatusOptions"
          value-key="value"
          label-key="label"
          placeholder="Status comissão"
          class="w-full"
        />
        <USelect
          v-model="recordType"
          :items="recordTypeOptions"
          value-key="value"
          label-key="label"
          placeholder="Tipo"
          class="w-full"
        />
      </div>

      <!-- Row 3: OS status + payment status + payment method -->
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <UiTagFilter
          v-model="orderStatusFilters"
          :options="orderStatusOptions"
          placeholder="Status da OS"
          class="w-full"
        />
        <UiTagFilter
          v-model="paymentStatusFilters"
          :options="paymentStatusOptions"
          placeholder="Pagamento da OS"
          class="w-full"
        />
        <UiTagFilter
          v-model="paymentMethods"
          :options="paymentMethodOptions"
          placeholder="Forma de pagamento"
          class="w-full"
        />
      </div>
    </div>
  </UCard>
</template>
