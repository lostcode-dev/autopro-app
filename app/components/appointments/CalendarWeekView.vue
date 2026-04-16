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
  HOUR_START,
  HOUR_END,
  GRID_HEIGHT,
} from '~/utils/calendar'

const props = defineProps<{
  currentDate: Date
  weekDays: Date[]
  appointments: Appointment[]
}>()

const emit = defineEmits<{
  'cell-click': [payload: { date: Date; time: string }]
  'event-click': [appt: Appointment]
  'day-click': [date: Date]
}>()

const timeSlots = buildTimeSlots()

// Current time indicator — updates every minute
const currentMinute = ref(getCurrentMinuteFromStart())
const currentTimeVisible = ref(checkCurrentTimeVisible())

onMounted(() => {
  const interval = setInterval(() => {
    currentMinute.value = getCurrentMinuteFromStart()
    currentTimeVisible.value = checkCurrentTimeVisible()
  }, 60_000)
  onUnmounted(() => clearInterval(interval))
})

function getEventsForDay(day: Date): Appointment[] {
  const iso = toISO(day)
  return props.appointments
    .filter(a => a.appointment_date === iso)
    .sort((a, b) => a.time.localeCompare(b.time))
}

function onGridClick(day: Date, event: MouseEvent) {
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const relY = event.clientY - rect.top
  const totalMinutes = (HOUR_END - HOUR_START) * 60
  const clickedMinute = Math.round((relY / GRID_HEIGHT) * totalMinutes / 30) * 30
  const bounded = Math.max(0, Math.min(clickedMinute, totalMinutes - 30))
  const h = Math.floor(bounded / 60) + HOUR_START
  const m = bounded % 60
  emit('cell-click', {
    date: day,
    time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
  })
}

function getEventStyle(appt: Appointment): Record<string, string> {
  return {
    position: 'absolute',
    top: `${minuteFromStart(appt.time)}px`,
    height: '58px',
    left: '2px',
    right: '2px',
  }
}
</script>

<template>
  <!-- Outer: fills remaining height, scrolls as a unit -->
  <div class="min-h-0 flex-1 overflow-auto">
    <div class="flex min-w-max">
      <!-- Time gutter: sticky left so it stays visible on horizontal scroll -->
      <div class="sticky left-0 z-20 w-14 shrink-0 border-r border-default bg-default">
        <!-- Spacer for day header row -->
        <div class="sticky top-0 z-20 h-10 border-b border-default bg-default" />
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

      <!-- Day columns -->
      <div class="flex">
        <div
          v-for="day in weekDays"
          :key="toISO(day)"
          class="flex w-36 flex-none flex-col border-r border-default last:border-r-0"
        >
          <!-- Day header: sticky top -->
          <div
            class="sticky top-0 z-10 flex h-10 shrink-0 cursor-pointer flex-col items-center justify-center border-b border-default bg-default transition-colors hover:bg-elevated"
            :class="{ 'text-primary': isToday(day) }"
            @click="emit('day-click', day)"
          >
            <span class="text-[11px] uppercase text-muted">{{ formatDayShort(day) }}</span>
            <span
              class="flex h-5 w-5 items-center justify-center rounded-full text-sm font-semibold"
              :class="isToday(day) ? 'bg-primary text-white' : ''"
            >
              {{ day.getDate() }}
            </span>
          </div>

          <!-- Events area -->
          <div
            class="relative cursor-pointer"
            :style="{ height: `${GRID_HEIGHT}px` }"
            @click="onGridClick(day, $event)"
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
            <template v-if="isToday(day) && currentTimeVisible">
              <div
                class="pointer-events-none absolute z-10 w-full border-t-2 border-primary"
                :style="{ top: `${currentMinute}px` }"
              >
                <div class="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-primary" />
              </div>
            </template>

            <!-- Events -->
            <AppointmentsCalendarEventPill
              v-for="appt in getEventsForDay(day)"
              :key="appt.id"
              :appointment="appt"
              :style="getEventStyle(appt)"
              view="week"
              @click.stop="emit('event-click', appt)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
