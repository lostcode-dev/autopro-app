<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Redefinir senha',
  description: 'Crie uma nova senha para sua conta'
})

const toast = useToast()
const router = useRouter()
const route = useRoute()
const { fetchUser } = useAuth()
const submitting = ref(false)

// PKCE flow: Supabase returns ?code= in query params
const code = computed(() => route.query.code as string | undefined)

// Implicit recovery flow: plugin sets ?mode=recovery after storing tokens in sessionStorage
const isRecoveryMode = computed(() => route.query.mode === 'recovery')
const recoveryTokens = ref<{ access_token: string, refresh_token: string } | null>(null)

type PageState = 'loading' | 'valid' | 'invalid'
const state = ref<PageState>('loading')

function loadRecoveryTokensFromStorage() {
  const accessToken = sessionStorage.getItem('sb-recovery-access-token')
  const refreshToken = sessionStorage.getItem('sb-recovery-refresh-token')
  if (accessToken && refreshToken) {
    recoveryTokens.value = { access_token: accessToken, refresh_token: refreshToken }
    sessionStorage.removeItem('sb-recovery-access-token')
    sessionStorage.removeItem('sb-recovery-refresh-token')
    state.value = 'valid'
  } else {
    state.value = 'invalid'
  }
}

onMounted(() => {
  if (code.value) {
    state.value = 'valid'
    return
  }

  if (isRecoveryMode.value) {
    loadRecoveryTokensFromStorage()
    return
  }

  // The plugin may have stored tokens in sessionStorage and is about to navigate
  // to ?mode=recovery via the app:mounted hook (which fires after onMounted).
  // Stay in loading state if tokens are present; otherwise, the link is invalid.
  const pending = sessionStorage.getItem('sb-recovery-access-token')
  if (!pending) {
    state.value = 'invalid'
  }
  // If pending tokens exist, stay in 'loading' — the watch below will fire when
  // the route updates to ?mode=recovery.
})

// Fires when the plugin navigates to /reset-password?mode=recovery
watch(isRecoveryMode, (val) => {
  if (val) loadRecoveryTokensFromStorage()
})

const fields = [{
  name: 'password',
  label: 'Nova senha',
  type: 'password' as const,
  placeholder: 'Digite sua nova senha'
}, {
  name: 'confirm_password',
  label: 'Confirmar senha',
  type: 'password' as const,
  placeholder: 'Confirme sua nova senha'
}]

const schema = z.object({
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
  confirm_password: z.string()
}).refine(data => data.password === data.confirm_password, {
  message: 'As senhas não coincidem',
  path: ['confirm_password']
})

type Schema = z.output<typeof schema>

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  if (submitting.value) return

  if (state.value !== 'valid') {
    toast.add({
      title: 'Link inválido',
      description: 'Este link de recuperação é inválido. Solicite um novo link.',
      color: 'error'
    })
    return
  }

  submitting.value = true

  try {
    if (isRecoveryMode.value && recoveryTokens.value) {
      // Implicit flow: exchange tokens + update password in a single server call
      await $fetch('/api/auth/reset-password-with-tokens', {
        method: 'POST',
        body: {
          access_token: recoveryTokens.value.access_token,
          refresh_token: recoveryTokens.value.refresh_token,
          new_password: payload.data.password
        },
        credentials: 'include'
      })
    } else {
      // PKCE flow: exchange code for session + update password
      await $fetch('/api/auth/reset-password', {
        method: 'POST',
        body: {
          code: code.value,
          new_password: payload.data.password
        },
        credentials: 'include'
      })
    }

    await fetchUser()

    toast.add({
      title: 'Senha redefinida',
      description: 'Sua senha foi alterada com sucesso.',
      color: 'success'
    })

    await router.push('/app')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    const message = err?.data?.statusMessage || err?.statusMessage || 'Não foi possível redefinir a senha'
    toast.add({
      title: 'Erro',
      description: message,
      color: 'error'
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="state === 'loading'" class="flex justify-center py-8">
    <UIcon name="i-lucide-loader-circle" class="size-7 text-muted animate-spin" />
  </div>

  <div v-else-if="state === 'invalid'" class="text-center space-y-4">
    <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-error/10">
      <UIcon name="i-lucide-alert-circle" class="size-7 text-error" />
    </div>
    <h2 class="text-xl font-semibold text-highlighted">
      Link inválido
    </h2>
    <p class="text-sm text-muted">
      Este link de recuperação é inválido ou expirou. Solicite um novo link.
    </p>
    <UButton
      to="/forgot-password"
      variant="soft"
    >
      Solicitar novo link
    </UButton>
  </div>

  <UAuthForm
    v-else
    :fields="fields"
    :schema="schema"
    :loading="submitting"
    :disabled="submitting"
    title="Redefinir senha"
    icon="i-lucide-lock-keyhole"
    :submit="{ label: 'Redefinir senha' }"
    @submit="onSubmit"
  >
    <template #description>
      Crie uma nova senha para sua conta.
    </template>

    <template #footer>
      <ULink
        to="/login"
        class="text-primary font-medium"
      >
        Voltar ao login
      </ULink>
    </template>
  </UAuthForm>
</template>
