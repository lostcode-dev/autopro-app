<script setup lang="ts">
import type { Appointment } from '~/types/appointments'
import {
  toISO,
  isToday,
  buildTimeSlots,
  minuteFromStart,
  getCurrentMinuteFromStart,
  isCurrentTimeVisible as checkCurrentTimeVisible,
  formatDayShort,
  scrollToCurrentTime,
  HOUR_START,
  HOUR_END,
  GRID_HEIGHT,
} from '~/utils/calendar'

const props = defineProps<{
  currentDate: Date
  appointments: Appointment[]
}>()

const emit = defineEmits<{
  'cell-click': [payload: { date: Date; time: string }]
  'event-click': [appt: Appointment]
}>()

const timeSlots = buildTimeSlots()

const currentMinute = ref(getCurrentMinuteFromStart())
const currentTimeVisible = ref(checkCurrentTimeVisible())

const scrollContainerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (scrollContainerRef.value) scrollToCurrentTime(scrollContainerRef.value)

  const interval = setInterval(() => {
    currentMinute.value = getCurrentMinuteFromStart()
    currentTimeVisible.value = checkCurrentTimeVisible()
  }, 60_000)
  onUnmounted(() => clearInterval(interval))
})

watch(() => props.currentDate, () => {
  nextTick(() => {
    if (scrollContainerRef.value) scrollToCurrentTime(scrollContainerRef.value)
  })
})

const dayAppointments = computed(() =>
  props.appointments
    .filter(a => a.appointment_date === toISO(props.currentDate))
    .sort((a, b) => a.time.localeCompare(b.time)),
)

function onGridClick(event: MouseEvent) {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const relY = event.clientY - rect.top
  const totalMinutes = (HOUR_END - HOUR_START) * 60
  const clickedMinute = Math.round((relY / GRID_HEIGHT) * totalMinutes / 30) * 30
  const bounded = Math.max(0, Math.min(clickedMinute, totalMinutes - 30))
  const h = Math.floor(bounded / 60) + HOUR_START
  const m = bounded % 60
  emit('cell-click', {
    date: props.currentDate,
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  })
}

function getEventStyle(appt: Appointment): Record<string, string> {
  return {
    position: 'absolute',
    top: `${minuteFromStart(appt.time)}px`,
    height: '70px',
    left: '4px',
    right: '4px',
  }
}
</script>

<template>
  <div ref="scrollContainerRef" class="min-h-0 flex-1 overflow-auto">
    <div class="flex min-w-max">
      <!-- Time gutter: sticky left -->
      <div class="sticky left-0 z-20 w-14 shrink-0 border-r border-default bg-default">
        <!-- Spacer for day header -->
        <div class="sticky top-0 z-20 h-16 border-b border-default bg-default" />
        <!-- Time labels -->
        <div class="relative" :style="{ height: `${GRID_HEIGHT}px` }">
          <div
            v-for="slot in timeSlots"
            :key="slot"
            class="absolute w-full"
            :style="{ top: `${minuteFromStart(slot)}px` }"
          >
            <span
              v-if="slot.endsWith(':00')"
              class="block pr-1 text-right text-[10px] leading-none text-muted"
            >
              {{ slot }}
            </span>
          </div>
        </div>
      </div>

      <!-- Single day column -->
      <div class="flex w-full min-w-72 flex-col">
        <!-- Day header: sticky top -->
        <div
          class="sticky top-0 z-10 flex h-16 shrink-0 flex-col items-center justify-center gap-0.5 border-b border-default bg-default"
          :class="{ 'text-primary': isToday(currentDate) }"
        >
          <span class="text-xs uppercase text-muted">{{ formatDayShort(currentDate) }}</span>
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full text-2xl font-bold"
            :class="isToday(currentDate) ? 'bg-primary text-white' : 'text-highlighted'"
          >
            {{ currentDate.getDate() }}
          </span>
          <span class="text-xs capitalize text-muted">
            {{ currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) }}
          </span>
        </div>

        <!-- Events area -->
        <div
          class="relative cursor-pointer"
          :style="{ height: `${GRID_HEIGHT}px` }"
          @click="onGridClick"
        >
          <!-- Slot dividers -->
          <div
            v-for="slot in timeSlots"
            :key="slot"
            class="pointer-events-none absolute w-full"
            :class="slot.endsWith(':00') ? 'border-t border-default/60' : 'border-t border-default/20'"
            :style="{ top: `${minuteFromStart(slot)}px` }"
          />

          <!-- Now indicator -->
          <template v-if="isToday(currentDate) && currentTimeVisible">
            <div
              class="pointer-events-none absolute z-10 w-full border-t-2 border-primary"
              :style="{ top: `${currentMinute}px` }"
            >
              <div class="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-primary" />
            </div>
          </template>

          <!-- Events -->
          <AppointmentsCalendarEventPill
            v-for="appt in dayAppointments"
            :key="appt.id"
            :appointment="appt"
            :style="getEventStyle(appt)"
            view="day"
            @click.stop="emit('event-click', appt)"
          />

          <!-- Empty state -->
          <div
            v-if="dayAppointments.length === 0"
            class="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <p class="text-sm text-muted">
              Nenhum agendamento para este dia
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
