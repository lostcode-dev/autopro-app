import { useDebounceFn } from '@vueuse/core'
import type {
  Calendar,
  CalendarEvent,
  CreateCalendarPayload,
  CreateEventPayload,
  UpdateCalendarPayload,
  UpdateEventPayload,
  CancelOccurrencePayload,
  ReminderInput
} from '~/types/appointments'

interface EventsResponse {
  data: CalendarEvent[]
  total: number
  page: number
  pageSize: number
}

export function useAppointments() {
  const toast = useToast()

  // ─── Calendars ────────────────────────────────────────────────────────────
  const {
    data: calendars,
    status: calendarsStatus,
    refresh: refreshCalendars
  } = useFetch<Calendar[]>('/api/appointments/calendars', {
    lazy: true,
    key: 'appointments-calendars'
  })

  // ─── Date range state ─────────────────────────────────────────────────────
  const viewFrom = ref('')
  const viewTo = ref('')
  const activeCalendarIds = ref<string[]>([])
  const searchQuery = ref('')

  // ─── Events (paginated, filtered by date range) ───────────────────────────
  const eventsPage = ref(1)
  const eventsPageSize = ref(100)

  const {
    data: eventsData,
    status: eventsStatus,
    refresh: refreshEvents
  } = useFetch<EventsResponse>('/api/appointments/events', {
    query: computed(() => ({
      from: viewFrom.value || undefined,
      to: viewTo.value || undefined,
      q: searchQuery.value || undefined,
      page: eventsPage.value,
      pageSize: eventsPageSize.value
    })),
    lazy: true,
    key: 'appointments-events',
    watch: [viewFrom, viewTo, eventsPage]
  })

  const debouncedRefreshEvents = useDebounceFn(() => {
    refreshEvents()
  }, 300)

  watch(searchQuery, () => {
    eventsPage.value = 1
    debouncedRefreshEvents()
  })

  // ─── Calendar actions ─────────────────────────────────────────────────────
  async function createCalendar(payload: CreateCalendarPayload): Promise<Calendar | null> {
    try {
      const data = await $fetch<Calendar>('/api/appointments/calendars', {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Calendário criado', color: 'success' })
      await refreshCalendars()
      return data
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível criar o calendário', color: 'error' })
      return null
    }
  }

  async function updateCalendar(id: string, payload: UpdateCalendarPayload): Promise<boolean> {
    try {
      await $fetch(`/api/appointments/calendars/${id}`, {
        method: 'PATCH',
        body: payload
      })
      toast.add({ title: 'Calendário atualizado', color: 'success' })
      await refreshCalendars()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível atualizar o calendário', color: 'error' })
      return false
    }
  }

  async function archiveCalendar(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/appointments/calendars/${id}/archive`, {
        method: 'POST'
      })
      toast.add({ title: 'Calendário arquivado', color: 'success' })
      await refreshCalendars()
      await refreshEvents()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível arquivar o calendário', color: 'error' })
      return false
    }
  }

  // ─── Event actions ────────────────────────────────────────────────────────
  async function createEvent(payload: CreateEventPayload): Promise<CalendarEvent | null> {
    try {
      const data = await $fetch<CalendarEvent>('/api/appointments/events', {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Evento criado', color: 'success' })
      await refreshEvents()
      return data
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível criar o evento', color: 'error' })
      return null
    }
  }

  async function updateEvent(id: string, payload: UpdateEventPayload): Promise<boolean> {
    try {
      await $fetch(`/api/appointments/events/${id}`, {
        method: 'PATCH',
        body: payload
      })
      toast.add({ title: 'Evento atualizado', color: 'success' })
      await refreshEvents()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível atualizar o evento', color: 'error' })
      return false
    }
  }

  async function archiveEvent(id: string): Promise<boolean> {
    try {
      await $fetch(`/api/appointments/events/${id}/archive`, {
        method: 'POST'
      })
      toast.add({ title: 'Evento arquivado', color: 'success' })
      await refreshEvents()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível arquivar o evento', color: 'error' })
      return false
    }
  }

  async function fetchEventDetail(id: string): Promise<CalendarEvent | null> {
    try {
      return await $fetch<CalendarEvent>(`/api/appointments/events/${id}`)
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível carregar o evento', color: 'error' })
      return null
    }
  }

  async function cancelOccurrence(eventId: string, payload: CancelOccurrencePayload): Promise<boolean> {
    try {
      await $fetch(`/api/appointments/events/${eventId}/cancel-occurrence`, {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Ocorrência cancelada', color: 'success' })
      await refreshEvents()
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível cancelar a ocorrência', color: 'error' })
      return false
    }
  }

  async function upsertReminders(eventId: string, reminders: ReminderInput[]): Promise<boolean> {
    try {
      await $fetch(`/api/appointments/events/${eventId}/reminders`, {
        method: 'POST',
        body: { reminders }
      })
      toast.add({ title: 'Lembretes atualizados', color: 'success' })
      return true
    }
    catch {
      toast.add({ title: 'Erro', description: 'Não foi possível atualizar os lembretes', color: 'error' })
      return false
    }
  }

  // ─── View helpers ─────────────────────────────────────────────────────────
  function setViewRange(from: string, to: string) {
    viewFrom.value = from
    viewTo.value = to
  }

  // ─── Calendar color map ───────────────────────────────────────────────────
  const defaultColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  function getCalendarColor(calendar: Calendar, index: number): string {
    return calendar.color ?? defaultColors[index % defaultColors.length] ?? '#10b981'
  }

  // ─── Recurrence display ───────────────────────────────────────────────────
  function getRecurrenceLabel(rrule: string | null): string {
    if (!rrule) return 'Não se repete'
    if (rrule.includes('FREQ=DAILY')) return 'Diariamente'
    if (rrule.includes('FREQ=WEEKLY') && rrule.includes('BYDAY')) {
      const match = rrule.match(/BYDAY=([A-Z,]+)/)
      if (match) {
        const dayMap: Record<string, string> = {
          MO: 'Seg',
          TU: 'Ter',
          WE: 'Qua',
          TH: 'Qui',
          FR: 'Sex',
          SA: 'Sáb',
          SU: 'Dom'
        }
        const days = match[1]?.split(',').map(d => dayMap[d] ?? d).join(', ')
        return `Semanalmente (${days})`
      }
      return 'Semanalmente'
    }
    if (rrule.includes('FREQ=WEEKLY')) return 'Semanalmente'
    if (rrule.includes('FREQ=MONTHLY')) return 'Mensalmente'
    return 'Recorrente'
  }

  const NONE_RECURRENCE_VALUE = '__none__'

  const recurrenceOptions = [
    { label: 'Não se repete', value: NONE_RECURRENCE_VALUE },
    { label: 'Diariamente', value: 'FREQ=DAILY' },
    { label: 'Semanalmente', value: 'FREQ=WEEKLY' },
    { label: 'Seg a Sex', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
    { label: 'Mensalmente', value: 'FREQ=MONTHLY' }
  ]

  return {
    // Calendars
    calendars,
    calendarsStatus,
    refreshCalendars,
    createCalendar,
    updateCalendar,
    archiveCalendar,
    getCalendarColor,

    // Events
    eventsData,
    eventsStatus,
    eventsPage,
    eventsPageSize,
    refreshEvents,
    createEvent,
    updateEvent,
    archiveEvent,
    fetchEventDetail,
    cancelOccurrence,
    upsertReminders,

    // View
    viewFrom,
    viewTo,
    searchQuery,
    activeCalendarIds,
    setViewRange,

    // Recurrence
    getRecurrenceLabel,
    recurrenceOptions,
    NONE_RECURRENCE_VALUE
  }
}
