<script setup lang="ts">
import type { Task } from '~/types/tasks'

const props = defineProps<{
  open: boolean
  task: Task | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'archived': []
}>()

const { archiveTask } = useTasks()

const loading = ref(false)

async function onConfirm() {
  if (!props.task) return
  loading.value = true
  try {
    const ok = await archiveTask(props.task.id, props.task.title)
    if (ok) {
      emit('archived')
      emit('update:open', false)
    }
  } finally {
    loading.value = false
  }
}

function onClose() {
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="props.open"
    title="Arquivar tarefa"
    @update:open="onClose"
  >
    <template #body>
      <p class="text-sm text-muted">
        Tem certeza que deseja arquivar a tarefa
        <span class="font-medium text-highlighted">"{{ task?.title }}"</span>?
        Você poderá encontrá-la no filtro de arquivadas.
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="subtle"
          @click="onClose"
        />
        <UButton
          label="Arquivar"
          color="error"
          :loading="loading"
          @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
