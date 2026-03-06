<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': []
}>()

const { createIdentity, archiveIdentity, identities, identitiesStatus } = useHabits()

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().max(500).optional()
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  name: '',
  description: ''
})

const loading = ref(false)
const archivingId = ref<string | null>(null)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (loading.value) return
  loading.value = true
  try {
    const result = await createIdentity(event.data)
    if (result) {
      state.name = ''
      state.description = ''
      emit('created')
    }
  } finally {
    loading.value = false
  }
}

async function onArchive(identityId: string, identityName: string) {
  archivingId.value = identityId
  try {
    await archiveIdentity(identityId, identityName)
  } finally {
    archivingId.value = null
  }
}
</script>

<template>
  <UModal
    :open="props.open"
    title="Nova identidade"
    description="Quem você quer se tornar?"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-6">
        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField label="Nome" name="name">
            <UInput
              v-model="state.name"
              placeholder="Ex: Eu sou uma pessoa disciplinada"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Descrição (opcional)" name="description">
            <UTextarea
              v-model="state.description"
              placeholder="Descreva quem você quer se tornar..."
              class="w-full"
              :rows="2"
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton
              icon="i-lucide-x"
              label="Fechar"
              color="neutral"
              variant="subtle"
              @click="emit('update:open', false)"
            />
            <UButton
              icon="i-lucide-check"
              label="Salvar"
              type="submit"
              :loading="loading"
              :disabled="loading"
            />
          </div>
        </UForm>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-medium text-highlighted">
              Identidades
            </p>
          </div>

          <template v-if="identitiesStatus === 'pending'">
            <UCard v-for="i in 3" :key="i">
              <div class="space-y-2">
                <USkeleton class="h-4 w-1/2" />
                <USkeleton class="h-3 w-2/3" />
              </div>
            </UCard>
          </template>

          <template v-else-if="(identities ?? []).length > 0">
            <UCard v-for="identity in identities" :key="identity.id">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-medium text-highlighted truncate">
                    {{ identity.name }}
                  </p>
                  <p v-if="identity.description" class="text-sm text-muted mt-0.5">
                    {{ identity.description }}
                  </p>
                </div>

                <UButton
                  icon="i-lucide-archive"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  :loading="archivingId === identity.id"
                  :disabled="archivingId === identity.id"
                  aria-label="Arquivar identidade"
                  @click="onArchive(identity.id, identity.name)"
                />
              </div>
            </UCard>
          </template>

          <div v-else class="text-sm text-muted">
            Nenhuma identidade criada ainda.
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
