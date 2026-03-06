<script setup lang="ts">
import type { CalendarDay } from '~/types/habits'

const props = defineProps<{
  habitId: string
}>()

const { fetchCalendar } = useHabits()

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth() + 1)

const calendar = ref<CalendarDay[]>([])
const loading = ref(false)

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const dayHeaders = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const displayTitle = computed(() => `${monthNames[currentMonth.value - 1]} ${currentYear.value}`)

// Calculate padding for first day of month
const firstDayOffset = computed(() => {
  const first = new Date(currentYear.value, currentMonth.value - 1, 1)
  return first.getDay()
})

const today = computed(() => new Date().toISOString().split('T')[0]!)

function isFutureDay(dateStr: string): boolean {
  return dateStr > today.value
}

function getDayTooltip(day: { date: string; completed: boolean; note: string | null }): string {
  if (isFutureDay(day.date)) return ''
  if (day.note) return day.note
  return day.completed ? 'Concluído' : 'Não feito'
}

function getDayClass(day: { date: string; completed: boolean }): string {
  if (isFutureDay(day.date)) return 'text-dimmed opacity-40'
  return day.completed ? 'bg-primary/20 text-primary' : 'text-muted hover:bg-elevated'
}

async function loadCalendar() {
  loading.value = true
  try {
    calendar.value = await fetchCalendar(props.habitId, currentYear.value, currentMonth.value)
  } finally {
    loading.value = false
  }
}

function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

watch([currentYear, currentMonth], () => loadCalendar())

onMounted(() => loadCalendar())
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="prevMonth"
        />
        <span class="font-medium text-highlighted">{{ displayTitle }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="nextMonth"
        />
      </div>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-7 gap-1">
      <div v-for="h in dayHeaders" :key="h" class="text-center text-xs font-medium text-muted py-1">
        {{ h }}
      </div>
      <USkeleton v-for="i in 35" :key="i" class="aspect-square rounded" />
    </div>

    <!-- Calendar grid -->
    <div v-else class="grid grid-cols-7 gap-1">
      <!-- Day headers -->
      <div v-for="h in dayHeaders" :key="h" class="text-center text-xs font-medium text-muted py-1">
        {{ h }}
      </div>

      <!-- Empty cells for offset -->
      <div v-for="i in firstDayOffset" :key="`empty-${i}`" />

      <!-- Day cells -->
      <UTooltip
        v-for="day in calendar"
        :key="day.date"
        :text="getDayTooltip(day)"
        :disabled="isFutureDay(day.date)"
      >
        <div
          class="aspect-square flex items-center justify-center rounded text-xs font-medium transition-colors"
          :class="getDayClass(day)"
        >
          {{ new Date(day.date + 'T12:00:00Z').getUTCDate() }}
        </div>
      </UTooltip>
    </div>
  </UCard>
</template>
