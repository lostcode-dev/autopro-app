<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Configurações' })

const toast = useToast()
const { fetchUser } = useAuth()
const { state: userPreferencesState } = useUserPreferences()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

// ─── Auth profile ─────────────────────────────────────────
type AuthProfileResponse = {
  id: string
  email: string | null
  name: string
  avatar_url: string
}

const accountSchema = z.object({
  name: z.string().min(2, 'Deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  avatar_url: z.string().optional()
})

type AccountSchema = z.output<typeof accountSchema>

const { data: authProfileData, status: authProfileStatus } = await useAsyncData(
  'user-profile',
  () => requestFetch<AuthProfileResponse>('/api/auth/profile', { headers: requestHeaders })
)

const account = reactive<Partial<AccountSchema>>({
  name: authProfileData.value?.name || '',
  email: authProfileData.value?.email || '',
  avatar_url: authProfileData.value?.avatar_url || undefined
})

watch(authProfileData, (data) => {
  if (!data) return
  account.name = data.name
  account.email = data.email || ''
  account.avatar_url = data.avatar_url || undefined
})

const isSavingAccount = ref(false)

async function onSubmitAccount(_event: FormSubmitEvent<AccountSchema>) {
  if (isSavingAccount.value) return
  isSavingAccount.value = true
  try {
    await $fetch('/api/auth/profile', {
      method: 'PUT',
      body: { name: account.name, avatar_url: account.avatar_url || '' }
    })
    await fetchUser()
    toast.add({ title: 'Conta atualizada', description: 'Suas informações foram salvas.', color: 'success' })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSavingAccount.value = false
  }
}

const fileRef = ref<HTMLInputElement>()

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  account.avatar_url = URL.createObjectURL(input.files[0]!)
}

// ─── Workshop profile ──────────────────────────────────────
type WorkshopProfileData = {
  id: string
  display_name: string | null
  profile_picture_url: string | null
  user_id: string
  organization_id: string
}

const workshopSchema = z.object({
  display_name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  profile_picture_url: z.string().optional().nullable()
})

type WorkshopSchema = z.output<typeof workshopSchema>

const { data: workshopProfileData, status: workshopProfileStatus } = await useAsyncData(
  'workshop-profile',
  () => requestFetch<WorkshopProfileData>('/api/profile', { headers: requestHeaders })
)

const workshop = reactive<Partial<WorkshopSchema>>({
  display_name: '',
  profile_picture_url: ''
})

watch(workshopProfileData, (data) => {
  if (!data) return
  workshop.display_name = data.display_name ?? ''
  workshop.profile_picture_url = data.profile_picture_url ?? ''
}, { immediate: true })

const isSavingWorkshop = ref(false)

async function onSubmitWorkshop(_event: FormSubmitEvent<WorkshopSchema>) {
  if (isSavingWorkshop.value) return
  isSavingWorkshop.value = true
  try {
    await $fetch('/api/profile', {
      method: 'PUT',
      body: { display_name: workshop.display_name, profile_picture_url: workshop.profile_picture_url || null }
    })
    toast.add({ title: 'Perfil atualizado', description: 'Seus dados foram salvos.', color: 'success' })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSavingWorkshop.value = false
  }
}

// ─── Preferences / timezone ────────────────────────────────
type PreferencesResponse = {
  primary_color: string
  neutral_color: string
  color_mode: 'light' | 'dark'
  timezone: string
}

const { data: preferencesData, status: preferencesStatus } = await useAsyncData(
  'user-settings-preferences',
  () => requestFetch<PreferencesResponse>('/api/settings/preferences', { headers: requestHeaders })
)

const browserTimezone = computed(() =>
  import.meta.client ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC'
)
const selectedTimezone = ref(preferencesData.value?.timezone || browserTimezone.value)

watch(preferencesData, (data) => {
  if (!data) return
  selectedTimezone.value = data.timezone
}, { immediate: true })

const timezoneOptions = computed(() => {
  const builtIn = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['UTC', 'America/Fortaleza', 'America/Sao_Paulo', 'America/New_York', 'Europe/London']
  return Array.from(new Set([...builtIn, browserTimezone.value, userPreferencesState.value.timezone]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map(tz => ({ label: tz, value: tz }))
})

const isSavingTimezone = ref(false)

async function saveTimezone() {
  if (isSavingTimezone.value) return
  isSavingTimezone.value = true
  try {
    await $fetch('/api/settings/preferences', {
      method: 'PUT',
      body: {
        primary_color: preferencesData.value?.primary_color || userPreferencesState.value.primary_color,
        neutral_color: preferencesData.value?.neutral_color || userPreferencesState.value.neutral_color,
        color_mode: preferencesData.value?.color_mode || userPreferencesState.value.color_mode,
        timezone: selectedTimezone.value
      }
    })
    if (preferencesData.value) {
      preferencesData.value = { ...preferencesData.value, timezone: selectedTimezone.value }
    }
    toast.add({ title: 'Fuso horário atualizado', description: 'O fuso horário da sua conta foi salvo.', color: 'success' })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSavingTimezone.value = false
  }
}

function useBrowserTimezone() {
  selectedTimezone.value = browserTimezone.value
  void saveTimezone()
}
</script>

<template>
  <!-- Conta (auth) -->
  <UForm
    id="account-form"
    :schema="accountSchema"
    :state="account"
    @submit="onSubmitAccount"
  >
    <UPageCard
      title="Conta"
      description="Informações de acesso à sua conta."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="account-form"
        label="Salvar alterações"
        color="neutral"
        type="submit"
        :loading="isSavingAccount"
        :disabled="isSavingAccount"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <div v-if="authProfileStatus === 'pending'" class="space-y-4">
      <USkeleton class="h-14 w-full" />
      <USkeleton class="h-14 w-full" />
      <USkeleton class="h-14 w-full" />
    </div>

    <UPageCard v-else variant="subtle">
      <UFormField
        name="name"
        label="Nome"
        description="Usado em comunicações e no seu perfil."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput v-model="account.name" autocomplete="off" />
      </UFormField>

      <USeparator />

      <UFormField
        name="email"
        label="Email"
        description="Usado para entrar e receber atualizações."
        required
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <UInput v-model="account.email" type="email" autocomplete="off" disabled />
      </UFormField>

      <USeparator />

      <UFormField
        name="avatar_url"
        label="Avatar"
        description="JPG, GIF ou PNG. Máx. 1MB."
        class="flex max-sm:flex-col justify-between sm:items-center gap-4"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar :src="account.avatar_url" :alt="account.name" size="lg" />
          <UButton label="Escolher" color="neutral" @click="fileRef?.click()" />
          <input
            ref="fileRef"
            type="file"
            class="hidden"
            accept=".jpg,.jpeg,.png,.gif"
            @change="onFileChange"
          >
        </div>
      </UFormField>
    </UPageCard>
  </UForm>

  <!-- Perfil da oficina -->
  <UForm
    id="profile-form"
    :schema="workshopSchema"
    :state="workshop"
    class="mt-6"
    @submit="onSubmitWorkshop"
  >
    <UPageCard
      title="Perfil na oficina"
      description="Nome de exibição e foto usados internamente no sistema."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="profile-form"
        label="Salvar alterações"
        color="neutral"
        type="submit"
        :loading="isSavingWorkshop"
        :disabled="isSavingWorkshop"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <div v-if="workshopProfileStatus === 'pending'" class="space-y-4">
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
        <UInput v-model="workshop.display_name" class="w-full" autocomplete="off" />
      </UFormField>

      <USeparator />

      <UFormField
        name="profile_picture_url"
        label="Foto de perfil"
        description="URL pública para sua foto de perfil na oficina."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <div class="flex items-center gap-3 w-full">
          <UAvatar
            :src="workshop.profile_picture_url || undefined"
            :alt="workshop.display_name || 'Perfil'"
            size="lg"
          />
          <UInput
            v-model="workshop.profile_picture_url"
            class="flex-1"
            placeholder="https://..."
            autocomplete="off"
          />
        </div>
      </UFormField>
    </UPageCard>
  </UForm>

  <!-- Regional -->
  <UPageCard
    title="Regional"
    description="Defina o fuso horário usado para agenda, ordens de serviço e notificações."
    variant="subtle"
    class="mt-6"
  >
    <div v-if="preferencesStatus === 'pending'" class="space-y-3">
      <USkeleton class="h-11 w-full" />
      <USkeleton class="h-9 w-40" />
    </div>

    <template v-else>
      <UFormField
        name="timezone"
        label="Fuso horário"
        description="Usado para agenda, lembretes operacionais e automações."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <div class="w-full space-y-3">
          <USelectMenu
            v-model="selectedTimezone"
            :items="timezoneOptions"
            value-key="value"
            class="w-full"
          />
          <div class="flex flex-wrap gap-2">
            <UButton
              label="Salvar fuso horário"
              color="neutral"
              :loading="isSavingTimezone"
              :disabled="isSavingTimezone"
              @click="saveTimezone"
            />
            <UButton
              label="Usar fuso do dispositivo"
              variant="outline"
              color="neutral"
              :disabled="isSavingTimezone || selectedTimezone === browserTimezone"
              @click="useBrowserTimezone"
            />
          </div>
        </div>
      </UFormField>
    </template>
  </UPageCard>
</template>
