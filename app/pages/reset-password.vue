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

const code = computed(() => route.query.code as string | undefined)

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

  if (!code.value) {
    toast.add({
      title: 'Link inválido',
      description: 'Este link de recuperação é inválido. Solicite um novo link.',
      color: 'error'
    })
    return
  }

  submitting.value = true

  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: {
        code: code.value,
        new_password: payload.data.password
      },
      credentials: 'include'
    })

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
  <div v-if="!code" class="text-center space-y-4">
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
