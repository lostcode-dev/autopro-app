<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { TaskPriority } from '~/types/tasks'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { createTask, priorityOptions, taskLists } = useTasks()

const schema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  description: z.string().max(2000).optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.Medium),
  listId: z.string().uuid().optional(),
  dueDate: z.string().optional()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  title: '',
  description: '',
  priority: TaskPriority.Medium,
  listId: undefined,
  dueDate: undefined
})

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const result = await createTask(event.data)
    if (result) {
      resetForm()
      emit('update:open', false)
    }
  } finally {
    loading.value = false
  }
}

function resetForm() {
  state.title = ''
  state.description = ''
  state.priority = TaskPriority.Medium
  state.listId = undefined
  state.dueDate = undefined
}

function onClose() {
  emit('update:open', false)
}

const listItems = computed(() => [
  { label: 'Nenhuma', value: '' },
  ...(taskLists.value ?? []).map(l => ({ label: l.name, value: l.id }))
])
</script>

<template>
  <UModal
    :open="props.open"
    title="Nova tarefa"
    description="Adicione uma tarefa ao seu dia."
    @update:open="onClose"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Título" name="title">
          <UInput
            v-model="state.title"
            placeholder="Ex: Comprar mantimentos"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Descrição" name="description">
          <UTextarea
            v-model="state.description"
            placeholder="Detalhes da tarefa"
            class="w-full"
            :rows="2"
          />
        </UFormField>

        <UFormField label="Prioridade" name="priority">
          <USelect
            v-model="state.priority"
            :items="priorityOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Lista" name="listId">
          <USelect
            v-model="state.listId"
            :items="listItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Data de vencimento" name="dueDate">
          <UInput
            v-model="state.dueDate"
            type="date"
            class="w-full"
          />
        </UFormField>

        <div class="flex justify-end gap-2 pt-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="onClose"
          />
          <UButton
            label="Criar tarefa"
            type="submit"
            :loading="loading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
