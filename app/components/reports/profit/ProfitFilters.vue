<script setup lang="ts">
import type { TagFilterOption } from '~/components/ui/TagFilter.vue'

const props = withDefaults(
  defineProps<{
    dateLabel?: string
    statusLabel?: string
    compareLabel?: string
  }>(),
  {
    dateLabel: 'Período',
    statusLabel: 'Status do pagamento',
    compareLabel: 'Comparação'
  }
)

const dateFrom = defineModel<string>('dateFrom')
const dateTo = defineModel<string>('dateTo')
const statusFilters = defineModel<string[]>('statusFilters', { default: () => ['paid'] })
const compareMode = defineModel<string>('compareMode', { default: 'no_compare' })

const statusOptions: TagFilterOption[] = [
  { value: 'paid', label: 'Pago', color: 'success', icon: 'i-lucide-circle-check' },
  { value: 'pending', label: 'Pendente', color: 'warning', icon: 'i-lucide-clock' }
]

const compareOptions = [
  { label: 'Não comparar', value: 'no_compare' },
  { label: 'Período anterior equivalente', value: 'previous_period' },
  { label: 'Mesmo período do ano anterior', value: 'same_period_last_year' },
  { label: 'Mês anterior', value: 'previous_month' },
  { label: 'Trimestre anterior', value: 'previous_quarter' }
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
          {{ props.statusLabel }}
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
          {{ props.compareLabel }}
        </p>
        <USelect
          :model-value="compareMode"
          :items="compareOptions"
          value-key="value"
          leading-icon="i-lucide-git-compare-arrows"
          class="w-full"
          @update:model-value="compareMode = String($event || 'no_compare')"
        />
      </div>
    </div>
  </UCard>
</template>
