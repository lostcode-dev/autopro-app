<script setup lang="ts">
import type { CalendarView } from '~/utils/calendar'

defineProps<{
  view: CalendarView
  title: string
  statusFilter: string
  statusOptions: { label: string, value: string }[]
}>()

const emit = defineEmits<{
  'update:view': [v: CalendarView]
  'update:statusFilter': [v: string]
  'prev': []
  'next': []
  'today': []
}>()

const viewOptions: { label: string, value: CalendarView }[] = [
  { label: 'Mês', value: 'month' },
  { label: 'Semana', value: 'week' },
  { label: 'Dia', value: 'day' }
]
</script>

<template>
  <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
    <!-- Temporal navigation -->
    <div class="flex items-center gap-1">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="emit('prev')"
      />
      <UButton
        label="Hoje"
        color="neutral"
        variant="outline"
        size="sm"
        @click="emit('today')"
      />
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="emit('next')"
      />
      <h2 class="ml-3 text-sm font-semibold capitalize text-highlighted">
        {{ title }}
      </h2>
    </div>

    <!-- Filters + view toggle -->
    <div class="flex items-center gap-2">
      <USelectMenu
        :model-value="statusFilter"
        :items="statusOptions"
        value-key="value"
        class="w-40"
        :search-input="false"
        @update:model-value="emit('update:statusFilter', $event)"
      />
      <UButtonGroup>
        <UButton
          v-for="opt in viewOptions"
          :key="opt.value"
          :label="opt.label"
          :color="view === opt.value ? 'primary' : 'neutral'"
          :variant="view === opt.value ? 'solid' : 'outline'"
          size="sm"
          @click="emit('update:view', opt.value)"
        />
      </UButtonGroup>
    </div>
  </div>
</template>
