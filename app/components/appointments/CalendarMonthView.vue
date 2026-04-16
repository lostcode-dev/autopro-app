<script setup lang="ts">
import type { Appointment } from '~/types/appointments'
import { toISO, isSameMonth, isToday } from '~/utils/calendar'

const props = defineProps<{
  currentDate: Date
  monthGrid: Date[]
  appointments: Appointment[]
}>()

const emit = defineEmits<{
  'cell-click': [date: Date]
  'event-click': [appt: Appointment]
  'overflow-click': [date: Date]
}>()

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function getEventsForDay(day: Date): Appointment[] {
  const iso = toISO(day)
  return props.appointments
    .filter(a => a.appointment_date === iso)
    .sort((a, b) => a.time.localeCompare(b.time))
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-auto">
    <!-- Weekday headers -->
    <div class="grid shrink-0 grid-cols-7 border-b border-default">
      <div
        v-for="name in DAY_NAMES"
        :key="name"
        class="py-2 text-center text-xs font-medium uppercase text-muted"
      >
        {{ name }}
      </div>
    </div>

    <!-- 6-week grid -->
    <div
      class="grid flex-1 grid-cols-7"
      style="grid-template-rows: repeat(6, minmax(5.5rem, 1fr))"
    >
      <div
        v-for="cell in monthGrid"
        :key="toISO(cell)"
        class="cursor-pointer overflow-hidden border-b border-r border-default/60 p-1 transition-colors hover:bg-elevated"
        :class="{
          'bg-muted/20': !isSameMonth(cell, currentDate),
          'bg-primary/5': isToday(cell),
        }"
        @click="emit('cell-click', cell)"
      >
        <!-- Day number -->
        <div class="mb-0.5 flex justify-end">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium"
            :class="
              isToday(cell)
                ? 'bg-primary text-white'
                : isSameMonth(cell, currentDate)
                  ? 'text-highlighted'
                  : 'text-muted'
            "
          >
            {{ cell.getDate() }}
          </span>
        </div>

        <!-- Event pills (max 3, rest shows "+N mais") -->
        <div class="space-y-0.5">
          <AppointmentsCalendarEventPill
            v-for="appt in getEventsForDay(cell).slice(0, 3)"
            :key="appt.id"
            :appointment="appt"
            view="month"
            @click.stop="emit('event-click', appt)"
          />
          <div
            v-if="getEventsForDay(cell).length > 3"
            class="cursor-pointer px-1 text-xs text-muted hover:text-highlighted"
            @click.stop="emit('overflow-click', cell)"
          >
            +{{ getEventsForDay(cell).length - 3 }} mais
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
