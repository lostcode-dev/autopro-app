<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Task } from '~/types/tasks'
import { TaskPriority } from '~/types/tasks'

const props = defineProps<{
  open: boolean
  task: Task | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { updateTask, priorityOptions, taskLists } = useTasks()

const schema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  description: z.string().max(2000).optional(),
  priority: z.nativeEnum(TaskPriority),
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

watch(() => props.task, (task) => {
  if (task) {
    state.title = task.title
    state.description = task.description ?? ''
    state.priority = task.priority as TaskPriority
    state.listId = task.listId ?? undefined
    state.dueDate = task.dueDate ?? undefined
  }
}, { immediate: true })

const NONE_LIST_VALUE = '__none__'

const listIdModel = computed({
  get: () => state.listId || NONE_LIST_VALUE,
  set: (value: string) => {
    state.listId = value === NONE_LIST_VALUE ? undefined : value
  }
})

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (loading.value) return
  if (!props.task) return
  loading.value = true
  try {
    const result = await updateTask(props.task.id, event.data)
    if (result) {
      emit('update:open', false)
    }
  } finally {
    loading.value = false
  }
}

function onClose() {
  emit('update:open', false)
}

const listItems = computed(() => [
  { label: 'Nenhuma', value: NONE_LIST_VALUE },
  ...(taskLists.value ?? []).map(l => ({ label: l.name, value: l.id }))
])
</script>

<template>
  <UModal
    :open="props.open"
    title="Editar tarefa"
    description="Ajuste os detalhes da tarefa."
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
            v-model="listIdModel"
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
            label="Salvar"
            type="submit"
            :loading="loading"
            :disabled="loading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
