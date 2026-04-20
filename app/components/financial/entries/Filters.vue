<script setup lang="ts">
import type { TagFilterOption } from '~/components/ui/TagFilter.vue'

const props = withDefaults(
  defineProps<{
    dateLabel?: string
    typeLabel?: string
    statusLabel?: string
  }>(),
  {
    dateLabel: 'Período',
    typeLabel: 'Tipo',
    statusLabel: 'Status'
  }
)

const dateFrom = defineModel<string>('dateFrom')
const dateTo = defineModel<string>('dateTo')
const typeFilters = defineModel<string[]>('typeFilters', { default: () => [] })
const statusFilters = defineModel<string[]>('statusFilters', { default: () => [] })

const typeOptions: TagFilterOption[] = [
  {
    value: 'income',
    label: 'Receitas',
    color: 'success',
    icon: 'i-lucide-trending-up'
  },
  {
    value: 'expense',
    label: 'Despesas',
    color: 'error',
    icon: 'i-lucide-trending-down'
  }
]

const statusOptions: TagFilterOption[] = [
  {
    value: 'pending',
    label: 'Pendentes',
    color: 'warning',
    icon: 'i-lucide-clock'
  },
  {
    value: 'paid',
    label: 'Pagos',
    color: 'success',
    icon: 'i-lucide-circle-check'
  }
]
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
          {{ props.dateLabel }}
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
          {{ props.typeLabel }}
        </p>
        <UiTagFilter
          v-model="typeFilters"
          :options="typeOptions"
          placeholder="Todos"
          class="w-full"
        />
      </div>

      <div>
        <p class="mb-1 text-xs font-medium text-muted">
          {{ props.statusLabel }}
        </p>
        <UiTagFilter
          v-model="statusFilters"
          :options="statusOptions"
          placeholder="Todos"
          class="w-full"
        />
      </div>
    </div>
  </UCard>
</template>
