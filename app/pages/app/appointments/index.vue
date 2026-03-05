<script setup lang="ts">
import type { CalendarEvent } from '~/types/appointments'

definePageMeta({
  layout: 'app'
})

const {
  calendars,
  calendarsStatus,
  eventsData,
  eventsStatus,
  searchQuery,
  setViewRange,
  refreshEvents
} = useAppointments()

// ─── Active tab ───────────────────────────────────────────────────────────
const activeTab = ref('month')

const tabItems = [
  { label: 'Mês', value: 'month', icon: 'i-lucide-calendar' },
  { label: 'Semana', value: 'week', icon: 'i-lucide-calendar-days' },
  { label: 'Agenda', value: 'agenda', icon: 'i-lucide-list' }
]

// On tab change, set appropriate date range
watch(activeTab, () => {
  refreshEvents()
})

// ─── Modals / Slideover ───────────────────────────────────────────────────
const calendarCreateOpen = ref(false)
const eventCreateOpen = ref(false)
const eventDetailOpen = ref(false)
const selectedEvent = ref<CalendarEvent | null>(null)

function onSelectEvent(evt: CalendarEvent) {
  selectedEvent.value = evt
  eventDetailOpen.value = true
}

function onMonthChange(from: string, to: string) {
  setViewRange(from, to)
}

function onWeekChange(from: string, to: string) {
  setViewRange(from, to)
}

function onSelectDate(_date: string) {
  // Could open a day view or create event — for now just switch to agenda
  activeTab.value = 'agenda'
}

const currentDate = new Date()

const eventsList = computed(() => eventsData.value?.data ?? [])
</script>

<template>
  <UDashboardPanel id="appointments">
    <template #header>
      <UDashboardNavbar title="Agendamentos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <NotificationsButton />
          <UInput
            v-model="searchQuery"
            placeholder="Buscar eventos..."
            icon="i-lucide-search"
            class="w-48"
          />
          <UButton
            label="Novo evento"
            icon="i-lucide-plus"
            @click="eventCreateOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-full gap-6 p-6">
        <!-- Sidebar: Calendar list -->
        <div class="hidden w-56 shrink-0 lg:block">
          <AppointmentsCalendarList
            :calendars="calendars"
            :loading="calendarsStatus === 'pending'"
            @create="calendarCreateOpen = true"
            @archive="() => {}"
            @edit="() => {}"
          />
        </div>

        <!-- Main content -->
        <div class="min-w-0 flex-1">
          <UTabs
            v-model="activeTab"
            :items="tabItems"
            class="mb-4"
          />

          <!-- Month view -->
          <AppointmentsMonthView
            v-if="activeTab === 'month'"
            :events="eventsList"
            :loading="eventsStatus === 'pending'"
            :current-date="currentDate"
            @select-event="onSelectEvent"
            @select-date="onSelectDate"
            @month-change="onMonthChange"
            @create-on-date="() => { eventCreateOpen = true }"
          />

          <!-- Week view -->
          <AppointmentsWeekView
            v-if="activeTab === 'week'"
            :events="eventsList"
            :loading="eventsStatus === 'pending'"
            :current-date="currentDate"
            @select-event="onSelectEvent"
            @week-change="onWeekChange"
          />

          <!-- Agenda view -->
          <AppointmentsAgendaView
            v-if="activeTab === 'agenda'"
            :events="eventsList"
            :loading="eventsStatus === 'pending'"
            @select-event="onSelectEvent"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modals -->
  <AppointmentsCalendarCreateModal
    :open="calendarCreateOpen"
    :calendars="calendars"
    @update:open="calendarCreateOpen = $event"
    @created="() => {}"
  />

  <AppointmentsEventCreateModal
    :open="eventCreateOpen"
    :calendars="calendars"
    @update:open="eventCreateOpen = $event"
    @created="refreshEvents"
  />

  <AppointmentsEventDetailSlideover
    :open="eventDetailOpen"
    :event="selectedEvent"
    :calendars="calendars"
    @update:open="eventDetailOpen = $event"
    @updated="refreshEvents"
    @archived="refreshEvents"
  />
</template>
