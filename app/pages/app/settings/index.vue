<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'app'
})

useSeoMeta({
  title: 'Configurações'
})

const toast = useToast()
const { fetchUser } = useAuth()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

type ProfileResponse = {
  id: string
  email: string | null
  name: string
  avatar_url: string
}

const profileSchema = z.object({
  name: z.string().min(2, 'Deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  avatar_url: z.string().optional()
})

type ProfileSchema = z.output<typeof profileSchema>

const { data: profileData, status } = await useAsyncData(
  'user-profile',
  () => requestFetch<ProfileResponse>('/api/auth/profile', { headers: requestHeaders })
)

const profile = reactive<Partial<ProfileSchema>>({
  name: profileData.value?.name || '',
  email: profileData.value?.email || '',
  avatar_url: profileData.value?.avatar_url || undefined
})

watch(profileData, (newData) => {
  if (newData) {
    profile.name = newData.name
    profile.email = newData.email || ''
    profile.avatar_url = newData.avatar_url || undefined
  }
})

const isSaving = ref(false)

async function onSubmit(_event: FormSubmitEvent<ProfileSchema>) {
  if (isSaving.value) return
  isSaving.value = true

  try {
    await $fetch('/api/auth/profile', {
      method: 'PUT',
      body: {
        name: profile.name,
        avatar_url: profile.avatar_url || ''
      }
    })

    await fetchUser()

    toast.add({
      title: 'Perfil atualizado',
      description: 'Suas informações foram salvas com sucesso.',
      color: 'success'
    })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    const message = err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar o perfil'
    toast.add({ title: 'Erro', description: message, color: 'error' })
  } finally {
    isSaving.value = false
  }
}

const fileRef = ref<HTMLInputElement>()

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  profile.avatar_url = URL.createObjectURL(input.files[0]!)
}

function onFileClick() {
  fileRef.value?.click()
}
</script>

<template>
  <UForm
    id="settings"
    :schema="profileSchema"
    :state="profile"
    @submit="onSubmit"
  >
    <UPageCard
      title="Perfil"
      description="Essas informações podem aparecer para outras pessoas."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="settings"
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
      <USkeleton class="h-14 w-full" />
      <USkeleton class="h-14 w-full" />
    </div>

    <UPageCard
      v-else
      variant="subtle"
    >
      <UFormField
        name="name"
        label="Nome"
        description="Usado em comunicações e no seu perfil."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.name"
          autocomplete="off"
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="email"
        label="Email"
        description="Usado para entrar e receber atualizações."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput
          v-model="profile.email"
          type="email"
          autocomplete="off"
          disabled
        />
      </UFormField>
      <USeparator />
      <UFormField
        name="avatar_url"
        label="Avatar"
        description="JPG, GIF ou PNG. Máx. 1MB."
        class="flex max-sm:flex-col justify-between sm:items-center gap-4"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar
            :src="profile.avatar_url"
            :alt="profile.name"
            size="lg"
          />
          <UButton
            label="Escolher"
            color="neutral"
            @click="onFileClick"
          />
          <input
            ref="fileRef"
            type="file"
            class="hidden"
            accept=".jpg, .jpeg, .png, .gif"
            @change="onFileChange"
          >
        </div>
      </UFormField>
    </UPageCard>
  </UForm>
</template>
