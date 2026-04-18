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
    <div class="grid grid-cols-2 gap-2 sm:gap-3">
      <div class="flex items-center gap-2 shrink-0 text-muted col-span-2">
        <UIcon name="i-lucide-filter" class="size-4" />
        <span class="text-sm font-medium">Filtros</span>
      </div>
      <UiDateRangePicker
        v-model:from="dateFrom"
        v-model:to="dateTo"
        class="w-full col-span-2"
      />
      <UiTagFilter
        v-model="orderStatusFilters"
        :options="orderStatusOptions"
        placeholder="Status da OS"
        class="w-full"
      />
      <UiTagFilter
        v-model="paymentStatusFilters"
        :options="paymentStatusOptions"
        placeholder="Status do pagamento"
        class="w-full"
      />
    </div>
  </UCard>
</template>
