<script setup lang="ts">
const props = defineProps<{
  entryDates: string[]
  loading: boolean
}>()

const emit = defineEmits<{
  selectDate: [date: string]
  monthChange: [from: string, to: string]
}>()

// Current viewed month
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth()) // 0-based

const today = new Date().toISOString().split('T')[0] ?? ''

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const dayHeaders = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const entryDateSet = computed(() => new Set(props.entryDates))

interface CalendarDay {
  date: string
  day: number
  isCurrentMonth: boolean
  hasEntry: boolean
  isToday: boolean
}

const calendarDays = computed<CalendarDay[]>(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startWeekday = firstDay.getDay()

  const days: CalendarDay[] = []

  // Fill previous month days
  const prevLastDay = new Date(year, month, 0).getDate()
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevLastDay - i
    const date = formatDateStr(year, month - 1, d)
    days.push({
      date,
      day: d,
      isCurrentMonth: false,
      hasEntry: entryDateSet.value.has(date),
      isToday: date === today
    })
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = formatDateStr(year, month, d)
    days.push({
      date,
      day: d,
      isCurrentMonth: true,
      hasEntry: entryDateSet.value.has(date),
      isToday: date === today
    })
  }

  // Fill next month days to complete 6 rows
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const date = formatDateStr(year, month + 1, d)
    days.push({
      date,
      day: d,
      isCurrentMonth: false,
      hasEntry: entryDateSet.value.has(date),
      isToday: date === today
    })
  }

  return days
})

function formatDateStr(year: number, month: number, day: number): string {
  const d = new Date(year, month, day)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
  emitMonthChange()
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
  emitMonthChange()
}

function goToToday() {
  const now = new Date()
  currentYear.value = now.getFullYear()
  currentMonth.value = now.getMonth()
  emitMonthChange()
}

function emitMonthChange() {
  const firstDay = formatDateStr(currentYear.value, currentMonth.value, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)
  const lastDayStr = formatDateStr(currentYear.value, currentMonth.value, lastDay.getDate())
  emit('monthChange', firstDay, lastDayStr)
}

// Emit initial month range
onMounted(() => {
  emitMonthChange()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="prevMonth"
        />
        <h4 class="text-sm font-semibold text-highlighted min-w-36 text-center">
          {{ monthNames[currentMonth] }} {{ currentYear }}
        </h4>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="nextMonth"
        />
      </div>
      <UButton
        label="Hoje"
        size="xs"
        variant="outline"
        @click="goToToday"
      />
    </div>

    <!-- Loading -->
    <div
      v-if="props.loading"
      class="grid grid-cols-7 gap-1"
    >
      <USkeleton
        v-for="i in 42"
        :key="i"
        class="h-10 w-full"
      />
    </div>

    <!-- Calendar grid -->
    <div
      v-else
      class="grid grid-cols-7 gap-1"
    >
      <!-- Day headers -->
      <div
        v-for="header in dayHeaders"
        :key="header"
        class="text-center text-xs font-medium text-muted py-1"
      >
        {{ header }}
      </div>

      <!-- Days -->
      <button
        v-for="(day, idx) in calendarDays"
        :key="idx"
        :class="[
          'relative flex items-center justify-center h-10 rounded-lg text-sm transition-colors',
          day.isCurrentMonth ? 'text-highlighted' : 'text-dimmed',
          day.isToday ? 'ring-1 ring-primary font-bold' : '',
          day.hasEntry ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-elevated'
        ]"
        @click="emit('selectDate', day.date)"
      >
        {{ day.day }}
        <span
          v-if="day.hasEntry"
          class="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary"
        />
      </button>
    </div>
  </div>
</template>
