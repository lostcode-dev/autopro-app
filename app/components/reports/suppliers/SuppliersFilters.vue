<script setup lang="ts">
import type { TagFilterOption } from '~/components/ui/TagFilter.vue'

const props = defineProps<{
  suppliers: Array<{ value: string, label: string }>
}>()

const dateFrom = defineModel<string>('dateFrom')
const dateTo = defineModel<string>('dateTo')
const supplierIds = defineModel<string[]>('supplierIds', { default: () => [] })

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.charAt(0) ?? '?').toUpperCase()
  return ((parts[0]?.charAt(0) ?? '') + (parts[parts.length - 1]?.charAt(0) ?? '')).toUpperCase()
}

const supplierOptions = computed<TagFilterOption[]>(() =>
  [...props.suppliers]
    .sort((supplierA, supplierB) => supplierA.label.localeCompare(supplierB.label, 'pt-BR', { sensitivity: 'base' }))
    .map(supplier => ({
      value: supplier.value,
      label: supplier.label,
      color: 'neutral' as const,
      initials: getInitials(supplier.label)
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

      <div class="col-span-2">
        <p class="mb-1 text-xs font-medium text-muted">
          Fornecedores
        </p>
        <UiTagFilter
          v-model="supplierIds"
          :options="supplierOptions"
          placeholder="Todos"
          class="w-full"
        />
      </div>
    </div>
  </UCard>
</template>
