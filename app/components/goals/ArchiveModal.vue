<script setup lang="ts">
import type { Goal } from '~/types/goals'

const props = defineProps<{
  open: boolean
  goal: Goal | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'archived': []
}>()

const { archiveGoal } = useGoals()

const loading = ref(false)

async function onConfirm() {
  if (!props.goal) return
  if (loading.value) return
  loading.value = true
  try {
    const ok = await archiveGoal(props.goal.id, props.goal.title)
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
    title="Arquivar meta"
    @update:open="onClose"
  >
    <template #body>
      <p class="text-sm text-muted">
        Tem certeza que deseja arquivar a meta
        <span class="font-medium text-highlighted">"{{ goal?.title }}"</span>?
        Você poderá restaurá-la depois.
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
          :disabled="loading"
          @click="onConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
