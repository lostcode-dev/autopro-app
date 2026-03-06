<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { LifeArea } from '~/types/life-os'
import { DefaultLifeArea } from '~/types/life-os'

const props = defineProps<{
  areas: LifeArea[]
  loading: boolean
}>()

const emit = defineEmits<{
  create: [name: string]
  update: [id: string, name: string]
  remove: [id: string]
}>()

const showForm = ref(false)
const editingId = ref<string | null>(null)

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100)
})

type Schema = z.infer<typeof schema>

const state = reactive<Schema>({
  name: ''
})

const saving = ref(false)

function startEdit(area: LifeArea) {
  editingId.value = area.id
  state.name = area.name
  showForm.value = true
}

function startCreate() {
  editingId.value = null
  state.name = ''
  showForm.value = true
}

function cancel() {
  showForm.value = false
  editingId.value = null
  state.name = ''
}

async function onSubmit(evt: FormSubmitEvent<Schema>) {
  if (saving.value) return
  saving.value = true
  try {
    if (editingId.value) {
      emit('update', editingId.value, evt.data.name)
    } else {
      emit('create', evt.data.name)
    }
    cancel()
  } finally {
    saving.value = false
  }
}

const defaultAreas = Object.values(DefaultLifeArea)

async function seedDefaults() {
  for (const name of defaultAreas) {
    const exists = props.areas.some(a => a.name.toLowerCase() === name.toLowerCase())
    if (!exists) {
      emit('create', name)
    }
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-layout-grid" class="size-5 text-primary" />
          <h3 class="text-sm font-semibold">
            Áreas de vida
          </h3>
        </div>
        <UButton
          size="xs"
          color="primary"
          variant="soft"
          icon="i-lucide-plus"
          @click="startCreate"
        >
          Nova
        </UButton>
      </div>
    </template>

    <div v-if="loading" class="space-y-2">
      <USkeleton v-for="i in 4" :key="i" class="h-8 w-full" />
    </div>

    <div v-else-if="areas.length === 0" class="flex flex-col items-center gap-3 py-4 text-center">
      <UIcon name="i-lucide-layout-grid" class="size-8 text-dimmed" />
      <div>
        <p class="text-sm font-medium text-highlighted">
          Nenhuma área de vida cadastrada
        </p>
        <p class="text-xs text-muted">
          Organize seus objetivos por áreas de vida
        </p>
      </div>
      <UButton
        size="sm"
        color="primary"
        variant="soft"
        @click="seedDefaults"
      >
        Adicionar padrões
      </UButton>
    </div>

    <div v-else>
      <div class="flex flex-wrap gap-2">
        <UBadge
          v-for="area in areas"
          :key="area.id"
          color="primary"
          variant="subtle"
          size="md"
          class="cursor-pointer"
          @click="startEdit(area)"
        >
          {{ area.name }}
        </UBadge>
      </div>
    </div>

    <!-- Create/Edit form -->
    <div v-if="showForm" class="mt-4 border-t border-default pt-4">
      <UForm :schema="schema" :state="state" @submit="onSubmit">
        <UFormField name="name" :label="editingId ? 'Renomear área' : 'Nova área'">
          <div class="flex gap-2">
            <UInput
              v-model="state.name"
              placeholder="Nome da área"
              class="flex-1"
            />
            <UButton type="submit" size="sm" :loading="saving" :disabled="saving">
              {{ editingId ? 'Salvar' : 'Criar' }}
            </UButton>
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              @click="cancel"
            >
              Cancelar
            </UButton>
          </div>
        </UFormField>
      </UForm>

      <div v-if="editingId" class="mt-2 flex justify-end">
        <UButton
          size="xs"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          @click="emit('remove', editingId)"
        >
          Excluir área
        </UButton>
      </div>
    </div>
  </UCard>
</template>
