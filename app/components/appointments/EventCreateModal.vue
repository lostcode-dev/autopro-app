<script setup lang="ts">
import { z } from 'zod'
import type { Calendar } from '~/types/appointments'
import { ReminderType } from '~/types/appointments'

const props = defineProps<{
  open: boolean
  calendars: Calendar[] | null | undefined
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': []
}>()

const { createEvent, recurrenceOptions } = useAppointments()

const schema = z.object({
  calendarId: z.string().uuid('Selecione um calendário'),
  title: z.string().min(1, 'Título é obrigatório').max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  startDate: z.string().min(1, 'Data de início é obrigatória'),
  startTime: z.string().min(1, 'Hora de início é obrigatória'),
  endDate: z.string().min(1, 'Data de término é obrigatória'),
  endTime: z.string().min(1, 'Hora de término é obrigatória'),
  allDay: z.boolean().default(false),
  rrule: z.string().optional(),
  reminderMinutes: z.coerce.number().int().min(0).max(10080).default(10)
})

type FormState = z.infer<typeof schema>

const now = new Date()
const todayStr = now.toISOString().split('T')[0] ?? ''
const hourNow = String(now.getHours()).padStart(2, '0')
const minuteNow = String(Math.ceil(now.getMinutes() / 15) * 15).padStart(2, '0')
const startTimeDefault = `${hourNow}:${minuteNow === '60' ? '00' : minuteNow}`

const state = reactive<FormState>({
  calendarId: '',
  title: '',
  description: '',
  location: '',
  startDate: todayStr,
  startTime: startTimeDefault,
  endDate: todayStr,
  endTime: `${String(Number(hourNow) + 1).padStart(2, '0')}:${minuteNow === '60' ? '00' : minuteNow}`,
  allDay: false,
  rrule: '',
  reminderMinutes: 10
})

const loading = ref(false)

const calendarOptions = computed(() =>
  (props.calendars ?? []).map(c => ({ label: c.name, value: c.id }))
)

// When calendars load, auto-select first
watch(() => props.calendars, (cals) => {
  if (cals && cals.length > 0 && !state.calendarId) {
    state.calendarId = cals[0]?.id ?? ''
  }
}, { immediate: true })

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

async function onSubmit() {
  if (loading.value) return
  const startAt = `${state.startDate}T${state.allDay ? '00:00:00' : state.startTime + ':00'}`
  const endAt = `${state.endDate}T${state.allDay ? '23:59:59' : state.endTime + ':00'}`

  if (new Date(endAt) <= new Date(startAt)) {
    return
  }

  loading.value = true
  try {
    const result = await createEvent({
      calendarId: state.calendarId,
      title: state.title,
      description: state.description || undefined,
      location: state.location || undefined,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      eventTimezone: timezone,
      allDay: state.allDay,
      rrule: state.rrule || undefined,
      reminders: state.reminderMinutes >= 0
        ? [{ type: ReminderType.Popup, minutesBefore: state.reminderMinutes }]
        : undefined
    })

    if (result) {
      // Reset form
      state.title = ''
      state.description = ''
      state.location = ''
      state.rrule = ''
      state.allDay = false
      state.reminderMinutes = 10
      emit('update:open', false)
      emit('created')
    }
  } finally {
    loading.value = false
  }
}

const reminderOptions = [
  { label: 'Sem lembrete', value: -1 },
  { label: '5 minutos antes', value: 5 },
  { label: '10 minutos antes', value: 10 },
  { label: '15 minutos antes', value: 15 },
  { label: '30 minutos antes', value: 30 },
  { label: '1 hora antes', value: 60 },
  { label: '1 dia antes', value: 1440 }
]
</script>

<template>
  <UModal
    :open="open"
    title="Novo evento"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Calendário"
          name="calendarId"
        >
          <USelect
            v-model="state.calendarId"
            :items="calendarOptions"
            placeholder="Selecione..."
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Título"
          name="title"
        >
          <UInput
            v-model="state.title"
            placeholder="Ex.: Reunião, Consulta..."
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Local"
          name="location"
        >
          <UInput
            v-model="state.location"
            placeholder="Ex.: Sala 3, Google Meet..."
            icon="i-lucide-map-pin"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center gap-2">
          <UCheckbox
            :model-value="state.allDay"
            label="Dia inteiro"
            @update:model-value="state.allDay = Boolean($event)"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="Data início"
            name="startDate"
          >
            <UInput
              v-model="state.startDate"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="!state.allDay"
            label="Hora início"
            name="startTime"
          >
            <UInput
              v-model="state.startTime"
              type="time"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="Data término"
            name="endDate"
          >
            <UInput
              v-model="state.endDate"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="!state.allDay"
            label="Hora término"
            name="endTime"
          >
            <UInput
              v-model="state.endTime"
              type="time"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          label="Recorrência"
          name="rrule"
        >
          <USelect
            v-model="state.rrule"
            :items="recurrenceOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Lembrete"
          name="reminderMinutes"
        >
          <USelect
            v-model="state.reminderMinutes"
            :items="reminderOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Descrição"
          name="description"
        >
          <UTextarea
            v-model="state.description"
            placeholder="Detalhes do evento..."
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Cancelar"
            variant="outline"
            @click="emit('update:open', false)"
          />
          <UButton
            type="submit"
            label="Criar evento"
            :loading="loading"
            :disabled="loading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
