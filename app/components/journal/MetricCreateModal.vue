<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { MetricType } from '~/types/journal'

const props = defineProps<{
  open: boolean
  metricTypeOptions: Array<{ label: string, value: MetricType }>
  onCreateMetricDefinition: (payload: {
    key: string
    name: string
    description: string | null
    type: MetricType
    unit: string | null
    minValue: number | null
    maxValue: number | null
    step: number | null
    options: string[] | null
  }) => Promise<unknown>
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const schema = z.object({
  key: z.string().min(1, 'Informe a chave').max(50).regex(/^[a-z0-9_]+$/, 'Apenas letras minúsculas, números e _'),
  name: z.string().min(1, 'Informe o nome').max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(MetricType),
  unit: z.string().max(50).optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  step: z.coerce.number().optional(),
  options: z.string().optional()
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
  key: '',
  name: '',
  description: '',
  type: MetricType.Number,
  unit: '',
  minValue: undefined,
  maxValue: undefined,
  step: undefined,
  options: ''
})

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (loading.value) return
  loading.value = true
  try {
    const optionsList = event.data.options
      ? event.data.options.split(',').map(o => o.trim()).filter(Boolean)
      : null

    const result = await props.onCreateMetricDefinition({
      key: event.data.key,
      name: event.data.name,
      description: event.data.description || null,
      type: event.data.type,
      unit: event.data.unit || null,
      minValue: event.data.minValue ?? null,
      maxValue: event.data.maxValue ?? null,
      step: event.data.step ?? null,
      options: optionsList
    })

    if (result) {
      Object.assign(state, {
        key: '',
        name: '',
        description: '',
        type: MetricType.Number,
        unit: '',
        minValue: undefined,
        maxValue: undefined,
        step: undefined,
        options: ''
      })
      emit('update:open', false)
    }
  } finally {
    loading.value = false
  }
}

const showNumericFields = computed(() =>
  state.type === MetricType.Number || state.type === MetricType.Scale
)

const showOptionsField = computed(() =>
  state.type === MetricType.Select
)

const _props = props
</script>

<template>
  <UModal
    :open="_props.open"
    title="Nova métrica"
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
          label="Chave"
          name="key"
        >
          <UInput
            v-model="state.key"
            placeholder="ex: mood, sleep_hours"
          />
        </UFormField>

        <UFormField
          label="Nome"
          name="name"
        >
          <UInput
            v-model="state.name"
            placeholder="ex: Humor, Horas de sono"
          />
        </UFormField>

        <UFormField
          label="Descrição"
          name="description"
        >
          <UInput
            v-model="state.description"
            placeholder="Opcional"
          />
        </UFormField>

        <UFormField
          label="Tipo"
          name="type"
        >
          <USelect
            v-model="state.type"
            :items="_props.metricTypeOptions"
            value-key="value"
          />
        </UFormField>

        <UFormField
          v-if="showNumericFields"
          label="Unidade"
          name="unit"
        >
          <UInput
            v-model="state.unit"
            placeholder="ex: horas, pontos"
          />
        </UFormField>

        <div
          v-if="showNumericFields"
          class="grid grid-cols-3 gap-3"
        >
          <UFormField
            label="Mínimo"
            name="minValue"
          >
            <UInput
              v-model="state.minValue"
              type="number"
            />
          </UFormField>
          <UFormField
            label="Máximo"
            name="maxValue"
          >
            <UInput
              v-model="state.maxValue"
              type="number"
            />
          </UFormField>
          <UFormField
            label="Passo"
            name="step"
          >
            <UInput
              v-model="state.step"
              type="number"
            />
          </UFormField>
        </div>

        <UFormField
          v-if="showOptionsField"
          label="Opções (separadas por vírgula)"
          name="options"
        >
          <UInput
            v-model="state.options"
            placeholder="baixo, médio, alto"
          />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="emit('update:open', false)"
          />
          <UButton
            label="Criar"
            type="submit"
            :loading="loading"
            :disabled="loading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
