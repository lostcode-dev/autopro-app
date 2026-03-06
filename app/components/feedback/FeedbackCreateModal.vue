<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { FeedbackType, feedbackTypeLabels, feedbackTypeIcons } from '~/types/feedback'
import type { CreateFeedbackPayload, TechContext } from '~/types/feedback'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'submit': [payload: CreateFeedbackPayload]
}>()

const schema = z.object({
  type: z.nativeEnum(FeedbackType, { message: 'Selecione o tipo' }),
  title: z.string().min(1, 'Título é obrigatório').max(200),
  description: z.string().min(1, 'Descrição é obrigatória').max(5000),
  includeTechContext: z.boolean().default(false)
})

type Schema = z.infer<typeof schema>

const state = reactive<Schema>({
  type: FeedbackType.Suggestion,
  title: '',
  description: '',
  includeTechContext: false
})

const selectedType = ref(FeedbackType.Suggestion)

watch(selectedType, (val) => {
  state.type = val
})

const saving = ref(false)

const typeOptions = Object.values(FeedbackType).map(t => ({
  label: feedbackTypeLabels[t],
  value: t,
  icon: feedbackTypeIcons[t]
}))

function getTechContext(): TechContext {
  const route = useRoute()
  return {
    route: route.fullPath,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
    appVersion: '1.0.0',
    screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'SSR',
    timestamp: new Date().toISOString()
  }
}

function resetForm() {
  state.type = FeedbackType.Suggestion
  selectedType.value = FeedbackType.Suggestion
  state.title = ''
  state.description = ''
  state.includeTechContext = false
}

async function onSubmit(evt: FormSubmitEvent<Schema>) {
  if (saving.value) return
  saving.value = true
  try {
    const payload: CreateFeedbackPayload = {
      type: evt.data.type,
      title: evt.data.title,
      description: evt.data.description,
      techContext: evt.data.includeTechContext ? getTechContext() : null
    }
    emit('submit', payload)
    resetForm()
    emit('update:open', false)
  } finally {
    saving.value = false
  }
}

function onClose() {
  emit('update:open', false)
}
</script>

<template>
  <UModal :open="props.open" title="Enviar feedback" @update:open="onClose">
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField name="type" label="Tipo">
          <USelect
            v-model="selectedType"
            :items="typeOptions"
            value-key="value"
            placeholder="Selecione o tipo"
            class="w-full"
          />
        </UFormField>

        <UFormField name="title" label="Título">
          <UInput v-model="state.title" placeholder="Resumo do feedback" class="w-full" />
        </UFormField>

        <UFormField name="description" label="Descrição">
          <UTextarea
            v-model="state.description"
            placeholder="Descreva em detalhes..."
            :rows="5"
            class="w-full"
          />
        </UFormField>

        <UCheckbox
          v-model="state.includeTechContext"
          label="Incluir contexto técnico automaticamente"
          description="Envia rota atual, resolução e user agent para ajudar na análise."
        />

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancelar"
            @click="onClose"
          />
          <UButton type="submit" label="Enviar" :loading="saving" :disabled="saving" />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
