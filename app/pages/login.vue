<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Entrar',
  description: 'Acesse sua conta para continuar'
})

const toast = useToast()
const auth = useAuth()
const router = useRouter()

const fields = [{
  name: 'email',
  type: 'text' as const,
  label: 'Email',
  placeholder: 'Digite seu email',
  required: true
}, {
  name: 'password',
  label: 'Senha',
  type: 'password' as const,
  placeholder: 'Digite sua senha'
}, {
  name: 'remember',
  label: 'Lembrar de mim',
  type: 'checkbox' as const
}]

const providers = [{
  label: 'Google',
  icon: 'i-simple-icons-google',
  onClick: () => {
    navigateTo('/api/auth/oauth/start?provider=google')
  }
}, {
  label: 'GitHub',
  icon: 'i-simple-icons-github',
  onClick: () => {
    navigateTo('/api/auth/oauth/start?provider=github')
  }
}]

const schema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres')
})

type Schema = z.output<typeof schema>

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  try {
    await auth.login({
      email: payload.data.email,
      password: payload.data.password
    })

    toast.add({
      title: 'Login realizado',
      description: 'Bem-vindo de volta!',
      color: 'success'
    })

    await router.push('/app')
  }
  catch (error: any) {
    const message = error?.data?.statusMessage || error?.statusMessage || 'Não foi possível entrar'
    toast.add({
      title: 'Erro',
      description: message,
      color: 'error'
    })
  }
}
</script>

<template>
  <UAuthForm
    :fields="fields"
    :schema="schema"
    :providers="providers"
    title="Bem-vindo de volta"
    icon="i-lucide-lock"
    @submit="onSubmit"
  >
    <template #description>
      Não tem uma conta? <ULink
        to="/signup"
        class="text-primary font-medium"
      >Crie sua conta</ULink>.
    </template>

    <template #password-hint>
      <ULink
        to="/"
        class="text-primary font-medium"
        tabindex="-1"
      >Esqueceu a senha?</ULink>
    </template>

    <template #footer>
      Ao entrar, você concorda com nossos <ULink
        to="/"
        class="text-primary font-medium"
      >Termos de Serviço</ULink>.
    </template>
  </UAuthForm>
</template>
