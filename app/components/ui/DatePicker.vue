<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone, parseDate } from '@internationalized/date'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
}>(), {
  modelValue: undefined,
  placeholder: 'Selecione uma data',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const popoverOpen = ref(false)

const dfShort = new DateFormatter('pt-BR', { dateStyle: 'short' })

function isoToCalendarDate(iso: string | null | undefined): CalendarDate | undefined {
  if (!iso) return undefined
  try {
    const parsed = parseDate(iso)
    return new CalendarDate(parsed.year, parsed.month, parsed.day)
  }
  catch {
    return undefined
  }
}

function calendarDateToISO(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

const calendarValue = computed({
  get: () => isoToCalendarDate(props.modelValue),
  set: (val) => {
    emit('update:modelValue', val ? calendarDateToISO(val) : undefined)
    popoverOpen.value = false
  },
})

const displayValue = computed(() => {
  const d = isoToCalendarDate(props.modelValue)
  if (!d) return ''
  try {
    return dfShort.format(d.toDate(getLocalTimeZone()))
  }
  catch {
    return ''
  }
})

function clear() {
  emit('update:modelValue', undefined)
  popoverOpen.value = false
}
</script>

<template>
  <UPopover
    v-model:open="popoverOpen"
    :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
    :ui="{
      content: 'z-[260] w-[min(92vw,22rem)] rounded-xl border border-default bg-default p-0 shadow-xl'
    }"
    :modal="true"
  >
    <UButton
      color="neutral"
      variant="outline"
      block
      class="h-9 w-full justify-between gap-1.5 rounded-md border border-default bg-default px-3 py-2 text-sm shadow-xs"
      :disabled="disabled"
    >
      <span :class="displayValue ? 'text-highlighted' : 'text-dimmed'">
        {{ displayValue || placeholder }}
      </span>

      <template #trailing>
        <UIcon
          name="i-lucide-calendar"
          class="size-4 shrink-0 text-dimmed"
        />
      </template>
    </UButton>

    <template #content>
      <div class="overflow-hidden rounded-xl">
        <div class="p-2">
          <UCalendar
            v-model="calendarValue"
            locale="pt-BR"
            :week-starts-on="0"
            color="primary"
            class="w-full"
          />
        </div>

        <div class="flex items-center gap-1 border-t border-default px-2 py-2">
          <UButton
            label="Hoje"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="() => { const today = new Date().toISOString().split('T')[0]; emit('update:modelValue', today); popoverOpen = false }"
          />
          <UButton
            label="Limpar"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="clear"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
