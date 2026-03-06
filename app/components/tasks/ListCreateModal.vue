<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { createTaskList } = useTasks()

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  color: z.string().max(20).optional()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: '',
  color: undefined
})

const loading = ref(false)

const colorOptions = [
  { label: 'Padrão', value: '' },
  { label: 'Vermelho', value: 'red' },
  { label: 'Laranja', value: 'orange' },
  { label: 'Amarelo', value: 'yellow' },
  { label: 'Verde', value: 'green' },
  { label: 'Azul', value: 'blue' },
  { label: 'Roxo', value: 'purple' },
  { label: 'Rosa', value: 'pink' }
]

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (loading.value) return
  loading.value = true
  try {
    const result = await createTaskList(event.data)
    if (result) {
      state.name = ''
      state.color = undefined
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
    title="Nova lista"
    description="Organize suas tarefas em listas."
    @update:open="onClose"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Nome" name="name">
          <UInput
            v-model="state.name"
            placeholder="Ex: Trabalho, Pessoal"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Cor" name="color">
          <USelect
            v-model="state.color"
            :items="colorOptions"
            value-key="value"
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
            label="Criar lista"
            type="submit"
            :loading="loading"
            :disabled="loading"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
