<script setup lang="ts">
const props = defineProps<{
  open: boolean
  habitName: string
  habitId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'archived': []
}>()

const { archiveHabit } = useHabits()

const loading = ref(false)

async function onConfirm() {
  if (loading.value) return
  loading.value = true
  try {
    const success = await archiveHabit(props.habitId, props.habitName)
    if (success) {
      emit('archived')
      emit('update:open', false)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    :open="props.open"
    title="Arquivar hábito"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <p class="text-sm text-muted">
        Tem certeza que deseja arquivar <span class="font-medium text-highlighted">"{{ habitName }}"</span>?
        O histórico de registros será mantido.
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="emit('update:open', false)"
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
