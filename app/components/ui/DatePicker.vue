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

const df = new DateFormatter('pt-BR', { dateStyle: 'long' })
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

const headingValue = computed(() => {
  const d = isoToCalendarDate(props.modelValue)
  if (!d) return 'Selecione uma data'
  try {
    return df.format(d.toDate(getLocalTimeZone()))
  }
  catch {
    return 'Selecione uma data'
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
      content: 'z-[260] w-[min(92vw,22rem)] rounded-3xl border border-default bg-default p-0 shadow-2xl'
    }"
    :modal="true"
  >
    <UButton
      color="neutral"
      variant="outline"
      block
      class="min-h-14 justify-between rounded-2xl border-default px-4 py-3 text-left"
      :disabled="disabled"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated ring ring-default">
          <UIcon name="i-lucide-calendar" class="size-4.5 text-primary" />
        </div>

        <div class="min-w-0">
          <p class="text-xs uppercase tracking-[0.12em] text-muted">
            Data
          </p>
          <p class="truncate text-sm font-medium" :class="displayValue ? 'text-highlighted' : 'text-muted'">
            {{ displayValue || placeholder }}
          </p>
        </div>
      </div>

      <template #trailing>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 shrink-0 text-muted transition-transform duration-200"
          :class="{ 'rotate-180': popoverOpen }"
        />
      </template>
    </UButton>

    <template #content>
      <div class="overflow-hidden rounded-3xl">
        <div class="border-b border-default px-4 py-4">
          <p class="text-sm font-semibold text-highlighted">
            {{ headingValue }}
          </p>
        </div>

        <div class="p-3">
          <UCalendar
            v-model="calendarValue"
            locale="pt-BR"
            :week-starts-on="0"
            color="primary"
            class="w-full"
          />
        </div>

        <div class="flex items-center justify-between border-t border-default px-3 py-3">
          <div class="flex items-center gap-2">
            <UButton
              label="Fechar"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="popoverOpen = false"
            />
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-highlighted"
              @click="clear"
            >
              <UIcon name="i-lucide-x" class="size-4" />
              Limpar
            </button>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
