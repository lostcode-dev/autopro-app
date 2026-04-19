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

// ─── Profile ──────────────────────────────────────────────
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

const isSaving = ref(false)

async function onSubmitAccount(_event: FormSubmitEvent<AccountSchema>) {
  if (isSaving.value) return
  isSaving.value = true
  try {
    await Promise.all([
      $fetch('/api/auth/profile', {
        method: 'PUT',
        body: { name: account.name, avatar_url: account.avatar_url || '' }
      }),
      $fetch('/api/profile', {
        method: 'PUT',
        body: { display_name: account.name, profile_picture_url: account.avatar_url || null }
      }),
      $fetch('/api/settings/preferences', {
        method: 'PUT',
        body: {
          primary_color: preferencesData.value?.primary_color || userPreferencesState.value.primary_color,
          neutral_color: preferencesData.value?.neutral_color || userPreferencesState.value.neutral_color,
          color_mode: preferencesData.value?.color_mode || userPreferencesState.value.color_mode,
          timezone: selectedTimezone.value
        }
      })
    ])
    if (preferencesData.value) {
      preferencesData.value = { ...preferencesData.value, timezone: selectedTimezone.value }
    }
    await fetchUser()
    toast.add({ title: 'Configurações salvas', description: 'Suas informações foram atualizadas.', color: 'success' })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

const fileRef = ref<HTMLInputElement>()

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  account.avatar_url = URL.createObjectURL(input.files[0]!)
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

function getTimezoneOffsetMinutes(tz: string): number {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(now)
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+0'
    const match = tzName.match(/GMT([+-])(\d+)(?::(\d+))?/)
    if (!match) return 0
    const sign = match[1] === '+' ? 1 : -1
    return sign * (parseInt(match[2] ?? '0') * 60 + parseInt(match[3] ?? '0'))
  } catch {
    return 0
  }
}

function formatTimezoneLabel(tz: string): string {
  try {
    const offset = getTimezoneOffsetMinutes(tz)
    const sign = offset >= 0 ? '+' : '-'
    const abs = Math.abs(offset)
    const h = String(Math.floor(abs / 60)).padStart(2, '0')
    const m = String(abs % 60).padStart(2, '0')
    const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
    return `(UTC${sign}${h}:${m}) ${city}`
  } catch {
    return tz
  }
}

const timezoneOptions = computed(() => {
  if (!import.meta.client) {
    return [{ label: formatTimezoneLabel(selectedTimezone.value), value: selectedTimezone.value }]
  }
  const builtIn = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['UTC', 'America/Fortaleza', 'America/Sao_Paulo', 'America/New_York', 'Europe/London']
  return Array.from(new Set([...builtIn, selectedTimezone.value]))
    .filter(Boolean)
    .map(tz => ({ label: formatTimezoneLabel(tz), value: tz, offset: getTimezoneOffsetMinutes(tz) }))
    .sort((a, b) => a.offset - b.offset || a.label.localeCompare(b.label))
    .map(({ label, value }) => ({ label, value }))
})

function useBrowserTimezone() {
  selectedTimezone.value = browserTimezone.value
}
</script>

<template>
  <!-- Conta -->
  <UForm
    id="account-form"
    :schema="accountSchema"
    :state="account"
    @submit="onSubmitAccount"
  >
    <UPageCard
      title="Conta"
      description="Informações do seu perfil e acesso à conta."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        form="account-form"
        label="Salvar alterações"
        color="neutral"
        type="submit"
        :loading="isSaving"
        :disabled="isSaving"
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

  <!-- Regional -->
  <UPageCard
    title="Fuso horário"
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
        description="Salvo junto com as demais configurações ao clicar em Salvar alterações."
        class="flex max-sm:flex-col justify-between items-start gap-4"
      >
        <div class="w-full space-y-2">
          <USelectMenu
            v-model="selectedTimezone"
            :items="timezoneOptions"
            value-key="value"
            search-placeholder="Buscar fuso horário..."
            class="w-full"
          />
          <UButton
            label="Usar fuso do dispositivo"
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-monitor"
            :disabled="selectedTimezone === browserTimezone"
            @click="useBrowserTimezone"
          />
        </div>
      </UFormField>
    </template>
  </UPageCard>
</template>
