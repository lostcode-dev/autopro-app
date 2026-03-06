<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { HabitReflection } from '~/types/habits'

const props = defineProps<{
  weekKey: string
  existingReflection?: HabitReflection | null
  editable?: boolean
  onSave?: (payload: { weekKey: string, wins?: string, improvements?: string }) => Promise<boolean>
}>()

const canEdit = computed(() => props.editable !== false)

const schema = z.object({
  wins: z.string().max(2000).optional(),
  improvements: z.string().max(2000).optional()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  wins: '',
  improvements: ''
})

const isEditing = ref(canEdit.value && !props.existingReflection)

watch(canEdit, (editable) => {
  if (!editable) {
    isEditing.value = false
    return
  }
  if (!props.existingReflection) {
    isEditing.value = true
  }
})

watch(() => props.existingReflection, (reflection) => {
  if (reflection) {
    state.wins = reflection.wins ?? ''
    state.improvements = reflection.improvements ?? ''
    isEditing.value = false
  }
  else {
    state.wins = ''
    state.improvements = ''
    isEditing.value = canEdit.value
  }
}, { immediate: true })

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (loading.value) return
  if (!props.onSave) return
  loading.value = true
  try {
    const ok = await props.onSave({
      weekKey: props.weekKey,
      wins: event.data.wins,
      improvements: event.data.improvements
    })
    if (ok) {
      isEditing.value = false
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-semibold text-highlighted">
          Revisão Semanal
        </h3>
        <p class="text-sm text-muted">
          Semana {{ props.weekKey }}
        </p>
      </div>
      <UButton
        v-if="canEdit && !isEditing && existingReflection"
        label="Editar"
        icon="i-lucide-pencil"
        color="neutral"
        variant="subtle"
        size="sm"
        @click="isEditing = true"
      />
    </div>

    <!-- Read-only view -->
    <template v-if="!isEditing && existingReflection">
      <UCard>
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-highlighted">
              O que deu certo?
            </p>
            <p class="text-sm text-muted mt-1">
              {{ existingReflection.wins || '—' }}
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-highlighted">
              O que posso melhorar?
            </p>
            <p class="text-sm text-muted mt-1">
              {{ existingReflection.improvements || '—' }}
            </p>
          </div>
        </div>
      </UCard>
    </template>

    <!-- Form -->
    <template v-else-if="canEdit">
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="O que deu certo esta semana?" name="wins">
          <UTextarea
            v-model="state.wins"
            placeholder="Completei todos os hábitos na segunda e terça..."
            class="w-full"
            :rows="3"
          />
        </UFormField>

        <UFormField label="O que posso melhorar?" name="improvements">
          <UTextarea
            v-model="state.improvements"
            placeholder="Na quarta perdi o ritmo porque..."
            class="w-full"
            :rows="3"
          />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton
            v-if="existingReflection"
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="isEditing = false"
          />
          <UButton
            label="Salvar reflexão"
            type="submit"
            :loading="loading"
            :disabled="loading"
          />
        </div>
      </UForm>
    </template>

    <template v-else>
      <UCard>
        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-highlighted">
              O que deu certo?
            </p>
            <p class="text-sm text-muted mt-1">
              {{ existingReflection?.wins || '—' }}
            </p>
          </div>
          <div>
            <p class="text-sm font-medium text-highlighted">
              O que posso melhorar?
            </p>
            <p class="text-sm text-muted mt-1">
              {{ existingReflection?.improvements || '—' }}
            </p>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
