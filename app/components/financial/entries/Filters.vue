<script setup lang="ts">
import type { TagFilterOption } from '~/components/ui/TagFilter.vue'

const dateFrom = defineModel<string>('dateFrom')
const dateTo = defineModel<string>('dateTo')
const typeFilters = defineModel<string[]>('typeFilters', { default: () => [] })
const statusFilters = defineModel<string[]>('statusFilters', { default: () => [] })

const typeOptions: TagFilterOption[] = [
  { value: 'income', label: 'Receitas', color: 'success', icon: 'i-lucide-trending-up' },
  { value: 'expense', label: 'Despesas', color: 'error', icon: 'i-lucide-trending-down' }
]

const statusOptions: TagFilterOption[] = [
  { value: 'pending', label: 'Pendentes', color: 'warning', icon: 'i-lucide-clock' },
  { value: 'paid', label: 'Pagos', color: 'success', icon: 'i-lucide-circle-check' }
]

const activeFiltersCount = computed(() => {
  let count = 0
  if (typeFilters.value.length > 0) count++
  if (statusFilters.value.length > 0) count++
  return count
})
</script>

<template>
  <UPopover :content="{ align: 'start' }">
    <UButton
      icon="i-lucide-sliders-horizontal"
      :label="activeFiltersCount > 0 ? `Filtros (${activeFiltersCount})` : 'Filtros'"
      color="neutral"
      variant="outline"
      size="sm"
    />

    <template #content>
      <div class="w-72 space-y-4 p-4">
        <UFormField label="Período">
          <UiDateRangePicker
            v-model:from="dateFrom"
            v-model:to="dateTo"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Tipo">
          <UiTagFilter
            v-model="typeFilters"
            :options="typeOptions"
            placeholder="Todos"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Status">
          <UiTagFilter
            v-model="statusFilters"
            :options="statusOptions"
            placeholder="Todos"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
  </UPopover>
</template>
