<script setup lang="ts">
import type { TagFilterOption } from '~/components/ui/TagFilter.vue'

defineProps<{
  orderStatusOptions: TagFilterOption[]
  paymentStatusOptions: TagFilterOption[]
}>()

const dateFrom = defineModel<string>('dateFrom')
const dateTo = defineModel<string>('dateTo')
const orderStatusFilters = defineModel<string[]>('orderStatusFilters', { default: () => [] })
const paymentStatusFilters = defineModel<string[]>('paymentStatusFilters', { default: () => [] })
</script>

<template>
  <UCard :ui="{ body: 'p-3' }">
    <div class="space-y-3">
      <div class="flex items-center gap-2 text-muted">
        <UIcon name="i-lucide-filter" class="size-4" />
        <span class="text-sm font-medium">Filtros</span>
      </div>
      <div>
        <p class="mb-1 text-xs font-medium text-muted">Período</p>
        <UiDateRangePicker
          v-model:from="dateFrom"
          v-model:to="dateTo"
          class="w-full"
        />
      </div>
      <div class="grid grid-cols-2 gap-2">
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
          <p class="mb-1 text-xs font-medium text-muted">Pagamento</p>
          <UiTagFilter
            v-model="paymentStatusFilters"
            :options="paymentStatusOptions"
            placeholder="Todos"
            class="w-full"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
