<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Perfil' })

const toast = useToast()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

type ProfileData = {
  id: string
  display_name: string | null
  profile_picture_url: string | null
  user_id: string
  organization_id: string
}

const schema = z.object({
  display_name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  profile_picture_url: z.string().optional().nullable(),
})

type Schema = z.output<typeof schema>

const { data: profileData, status } = await useAsyncData(
  'workshop-profile',
  () => requestFetch<ProfileData>('/api/profile', { headers: requestHeaders })
)

const form = reactive<Partial<Schema>>({
  display_name: '',
  profile_picture_url: '',
})

watch(profileData, (data) => {
  if (!data) return
  form.display_name = data.display_name ?? ''
  form.profile_picture_url = data.profile_picture_url ?? ''
}, { immediate: true })

const isSaving = ref(false)

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  if (isSaving.value) return
  isSaving.value = true
  try {
    await $fetch('/api/profile', {
      method: 'PUT',
      body: {
        display_name: form.display_name,
        profile_picture_url: form.profile_picture_url || null,
      }
    })
    toast.add({ title: 'Perfil atualizado', description: 'Seus dados foram salvos.', color: 'success' })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UForm
    id="profile-form"
    :schema="schema"
    :state="form"
    @submit="onSubmit"
  >
    <UPageCard
      title="Perfil da oficina"
      description="Nome de exibição e foto de perfil usados no sistema."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="profile-form"
        label="Salvar alterações"
        color="neutral"
        type="submit"
        :loading="isSaving"
        :disabled="isSaving"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <div v-if="status === 'pending'" class="space-y-4">
      <USkeleton class="h-14 w-full" />
      <USkeleton class="h-14 w-full" />
    </div>

    <UPageCard v-else variant="subtle">
      <UFormField
        name="display_name"
        label="Nome de exibição"
        description="Como você aparece para outros usuários da oficina."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput v-model="form.display_name" class="w-full" autocomplete="off" />
      </UFormField>
      <USeparator />
      <UFormField
        name="profile_picture_url"
        label="URL da foto de perfil"
        description="Link público para sua foto de perfil."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <div class="flex items-center gap-3 w-full">
          <UAvatar
            :src="form.profile_picture_url || undefined"
            :alt="form.display_name || 'Perfil'"
            size="lg"
          />
          <UInput
            v-model="form.profile_picture_url"
            class="flex-1"
            placeholder="https://..."
            autocomplete="off"
          />
        </div>
      </UFormField>
    </UPageCard>
  </UForm>
</template>
