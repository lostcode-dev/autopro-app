<script setup lang="ts">
import type { CalendarEvent, Calendar } from '~/types/appointments'

const props = defineProps<{
  open: boolean
  event: CalendarEvent | null
  calendars: Calendar[] | null | undefined
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'updated': []
  'archived': []
}>()

const { updateEvent, archiveEvent, cancelOccurrence, getRecurrenceLabel } = useAppointments()

const editing = ref(false)
const loading = ref(false)
const archiving = ref(false)

const editTitle = ref('')
const editDescription = ref('')
const editLocation = ref('')

watch(() => props.event, (evt) => {
  if (evt) {
    editTitle.value = evt.title
    editDescription.value = evt.description ?? ''
    editLocation.value = evt.location ?? ''
    editing.value = false
  }
})

function startEdit() {
  editing.value = true
}

async function saveEdit() {
  if (!props.event) return
  if (loading.value) return
  loading.value = true
  try {
    const success = await updateEvent(props.event.id, {
      title: editTitle.value,
      description: editDescription.value || null,
      location: editLocation.value || null
    })
    if (success) {
      editing.value = false
      emit('updated')
    }
  } finally {
    loading.value = false
  }
}

async function onArchive() {
  if (!props.event) return
  if (archiving.value) return
  archiving.value = true
  try {
    const success = await archiveEvent(props.event.id)
    if (success) {
      emit('update:open', false)
      emit('archived')
    }
  } finally {
    archiving.value = false
  }
}

async function onCancelOccurrence(recurrenceId: string) {
  if (!props.event) return
  const success = await cancelOccurrence(props.event.id, { recurrenceId })
  if (success) {
    emit('update:open', false)
    emit('updated')
  }
}

function formatDateTime(dateStr: string, allDay: boolean): string {
  const date = new Date(dateStr)
  const dateFormatted = date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
  if (allDay) return dateFormatted
  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${dateFormatted} às ${time}`
}

// Cast for recurring event detection in template
const eventObj = computed(() => props.event as Record<string, unknown> | null)
</script>

<template>
  <USlideover
    :open="open"
    title="Detalhes do evento"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div
        v-if="!event"
        class="flex flex-col items-center justify-center gap-3 py-12"
      >
        <UIcon
          name="i-lucide-calendar-x"
          class="size-12 text-dimmed"
        />
        <p class="text-sm text-muted">
          Nenhum evento selecionado
        </p>
      </div>

      <div
        v-else
        class="space-y-6"
      >
        <!-- Header -->
        <div class="space-y-3">
          <div
            v-if="!editing"
            class="space-y-2"
          >
            <h3 class="text-lg font-semibold text-highlighted">
              {{ event.title }}
            </h3>
            <div class="flex items-center gap-2 text-sm text-muted">
              <UIcon
                name="i-lucide-clock"
                class="size-4"
              />
              <span>{{ formatDateTime(event.startAt, event.allDay) }}</span>
              <span>—</span>
              <span>{{ formatDateTime(event.endAt, event.allDay) }}</span>
            </div>
          </div>

          <div
            v-else
            class="space-y-3"
          >
            <UInput
              v-model="editTitle"
              placeholder="Título"
              class="w-full"
            />
          </div>
        </div>

        <!-- Location -->
        <div
          v-if="!editing && event.location"
          class="flex items-center gap-2 text-sm"
        >
          <UIcon
            name="i-lucide-map-pin"
            class="size-4 text-muted"
          />
          <span>{{ event.location }}</span>
        </div>

        <div v-if="editing">
          <UInput
            v-model="editLocation"
            placeholder="Local"
            icon="i-lucide-map-pin"
            class="w-full"
          />
        </div>

        <!-- Recurrence -->
        <div
          v-if="event.rrule"
          class="flex items-center gap-2 text-sm"
        >
          <UIcon
            name="i-lucide-repeat"
            class="size-4 text-muted"
          />
          <span>{{ getRecurrenceLabel(event.rrule) }}</span>
        </div>

        <!-- Description -->
        <div v-if="!editing && event.description">
          <h4 class="mb-1 text-sm font-medium text-highlighted">
            Descrição
          </h4>
          <p class="whitespace-pre-wrap text-sm text-muted">
            {{ event.description }}
          </p>
        </div>

        <div v-if="editing">
          <UTextarea
            v-model="editDescription"
            placeholder="Descrição"
            :rows="4"
            class="w-full"
          />
        </div>

        <!-- Reminders -->
        <div v-if="event.reminders && event.reminders.length > 0">
          <h4 class="mb-1 text-sm font-medium text-highlighted">
            Lembretes
          </h4>
          <div class="space-y-1">
            <div
              v-for="reminder in event.reminders"
              :key="reminder.id"
              class="flex items-center gap-2 text-sm text-muted"
            >
              <UIcon
                name="i-lucide-bell"
                class="size-3.5"
              />
              <span>{{ reminder.minutesBefore }} min antes</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2 border-t border-default pt-4">
          <template v-if="!editing">
            <UButton
              label="Editar"
              icon="i-lucide-pencil"
              variant="outline"
              size="sm"
              @click="startEdit"
            />
            <UButton
              v-if="eventObj && eventObj.recurrence_id"
              label="Cancelar ocorrência"
              icon="i-lucide-x"
              variant="outline"
              size="sm"
              color="error"
              @click="onCancelOccurrence(eventObj.recurrence_id as string)"
            />
            <UButton
              label="Arquivar"
              icon="i-lucide-archive"
              variant="outline"
              size="sm"
              color="error"
              :loading="archiving"
              :disabled="archiving"
              @click="onArchive"
            />
          </template>

          <template v-else>
            <UButton
              label="Salvar"
              icon="i-lucide-check"
              size="sm"
              :loading="loading"
              :disabled="loading"
              @click="saveEdit"
            />
            <UButton
              label="Cancelar"
              variant="outline"
              size="sm"
              @click="editing = false"
            />
          </template>
        </div>
      </div>
    </template>
  </USlideover>
</template>
