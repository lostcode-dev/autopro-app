<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  disabled?: boolean
}>(), {
  modelValue: undefined,
  placeholder: 'HH:mm',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

const popoverOpen = ref(false)

const selectedHour = computed(() => {
  if (!props.modelValue) return null
  return props.modelValue.split(':')[0] ?? null
})

const selectedMinute = computed(() => {
  if (!props.modelValue) return null
  return props.modelValue.split(':')[1] ?? null
})

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

function selectHour(hour: string) {
  const min = selectedMinute.value ?? '00'
  emit('update:modelValue', `${hour}:${min}`)
}

function selectMinute(minute: string) {
  const hr = selectedHour.value ?? '00'
  emit('update:modelValue', `${hr}:${minute}`)
}

function clear() {
  emit('update:modelValue', undefined)
  popoverOpen.value = false
}

function selectTime(value: string) {
  emit('update:modelValue', value)
  popoverOpen.value = false
}

const displayValue = computed(() => {
  if (!props.modelValue) return ''
  return props.modelValue
})

const hourListRef = ref<HTMLElement | null>(null)
const minuteListRef = ref<HTMLElement | null>(null)

watch(popoverOpen, async (open) => {
  if (!open) return
  await nextTick()
  scrollToSelected()
})

function scrollToSelected() {
  if (selectedHour.value && hourListRef.value) {
    const el = hourListRef.value.querySelector(`[data-hour="${selectedHour.value}"]`)
    el?.scrollIntoView({ block: 'center' })
  }
  if (selectedMinute.value && minuteListRef.value) {
    const el = minuteListRef.value.querySelector(`[data-minute="${selectedMinute.value}"]`)
    el?.scrollIntoView({ block: 'center' })
  }
}
</script>

<template>
  <UPopover
    v-model:open="popoverOpen"
    :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
    :ui="{
      content: 'z-[260] w-[min(92vw,26rem)] rounded-3xl border border-default bg-default p-0 shadow-2xl'
    }"
    :modal="true"
  >
    <UButton
      ref="triggerRef"
      color="neutral"
      variant="outline"
      block
      class="min-h-14 justify-between rounded-2xl border-default px-4 py-3 text-left"
      :disabled="disabled"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated ring ring-default">
          <UIcon name="i-lucide-clock-3" class="size-4.5 text-primary" />
        </div>

        <div class="min-w-0">
          <p class="text-xs uppercase tracking-[0.12em] text-muted">
            Horário
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
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-highlighted">
                Selecionar horário
              </p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 divide-x divide-default">
          <div class="min-w-0">
            <p class="border-b border-default px-3 py-2 text-center text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Hora
            </p>
            <div ref="hourListRef" class="h-56 overflow-y-auto p-2">
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="hour in hours"
                  :key="hour"
                  :data-hour="hour"
                  type="button"
                  class="rounded-xl px-3 py-2 text-sm transition-colors"
                  :class="selectedHour === hour ? 'bg-primary text-inverted font-semibold' : 'bg-elevated text-highlighted hover:bg-accented'"
                  @click="selectHour(hour)"
                >
                  {{ hour }}
                </button>
              </div>
            </div>
          </div>

          <div class="min-w-0">
            <p class="border-b border-default px-3 py-2 text-center text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Minuto
            </p>
            <div ref="minuteListRef" class="h-56 overflow-y-auto p-2">
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="minute in minutes"
                  :key="minute"
                  :data-minute="minute"
                  type="button"
                  class="rounded-xl px-3 py-2 text-sm transition-colors"
                  :class="selectedMinute === minute ? 'bg-primary text-inverted font-semibold' : 'bg-elevated text-highlighted hover:bg-accented'"
                  @click="selectMinute(minute)"
                >
                  {{ minute }}
                </button>
              </div>
            </div>
          </div>
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
