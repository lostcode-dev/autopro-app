<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Recuperar senha',
  description: 'Enviaremos um link para redefinir sua senha'
})

const toast = useToast()
const submitting = ref(false)
const sent = ref(false)

const fields = [{
  name: 'email',
  type: 'text' as const,
  label: 'Email',
  placeholder: 'Digite seu email',
  required: true
}]

const schema = z.object({
  email: z.email('Email inválido')
})

type Schema = z.input<typeof schema>

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  if (submitting.value) return
  submitting.value = true

  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: payload.data.email }
    })

    sent.value = true
  } catch {
    toast.add({
      title: 'Erro',
      description: 'Não foi possível enviar o email de recuperação. Tente novamente.',
      color: 'error'
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="sent" class="text-center space-y-4">
    <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
      <UIcon name="i-lucide-mail-check" class="size-7 text-primary" />
    </div>
    <h2 class="text-xl font-semibold text-highlighted">
      Verifique seu email
    </h2>
    <p class="text-sm text-muted">
      Enviamos um link de recuperação para o seu email. Clique no link para redefinir sua senha.
    </p>
    <UButton
      to="/login"
      variant="soft"
      class="mt-2"
    >
      Voltar ao login
    </UButton>
  </div>

  <UAuthForm
    v-else
    :fields="fields"
    :schema="schema"
    :loading="submitting"
    :disabled="submitting"
    title="Recuperar senha"
    icon="i-lucide-lock-open"
    :submit="{ label: 'Enviar link de recuperação' }"
    @submit="onSubmit"
  >
    <template #description>
      Digite seu email e enviaremos um link para redefinir sua senha.
    </template>

    <template #footer>
      Lembrou a senha?
      <ULink
        to="/login"
        class="text-primary font-medium"
      >
        Voltar ao login
      </ULink>
    </template>
  </UAuthForm>
</template>
