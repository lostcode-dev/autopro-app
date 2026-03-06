<script setup lang="ts">
import * as z from 'zod'
import type { FormError, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'app'
})

useSeoMeta({
  title: 'Segurança'
})

const toast = useToast()

const passwordSchema = z.object({
  current: z.string().min(8, 'Deve ter pelo menos 8 caracteres'),
  new: z.string().min(8, 'Deve ter pelo menos 8 caracteres')
})

type PasswordSchema = z.output<typeof passwordSchema>

const password = reactive<Partial<PasswordSchema>>({
  current: '',
  new: ''
})

const isChangingPassword = ref(false)

const validate = (state: Partial<PasswordSchema>): FormError[] => {
  const errors: FormError[] = []
  if (state.current && state.new && state.current === state.new) {
    errors.push({ name: 'new', message: 'As senhas devem ser diferentes' })
  }
  return errors
}

async function onSubmitPassword(_event: FormSubmitEvent<PasswordSchema>) {
  if (isChangingPassword.value) return
  isChangingPassword.value = true

  try {
    await $fetch('/api/auth/password', {
      method: 'PUT',
      body: {
        current_password: password.current,
        new_password: password.new
      }
    })

    toast.add({
      title: 'Senha alterada',
      description: 'Sua senha foi atualizada com sucesso.',
      color: 'success'
    })

    password.current = ''
    password.new = ''
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    const message = err?.data?.statusMessage || err?.statusMessage || 'Não foi possível alterar a senha'
    toast.add({ title: 'Erro', description: message, color: 'error' })
  } finally {
    isChangingPassword.value = false
  }
}

const isDeletingAccount = ref(false)

async function deleteAccount() {
  if (isDeletingAccount.value) return
  isDeletingAccount.value = true

  try {
    await $fetch('/api/auth/account', { method: 'DELETE' })

    toast.add({
      title: 'Conta excluída',
      description: 'Sua conta foi removida permanentemente.',
      color: 'success'
    })

    await navigateTo('/login')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    const message = err?.data?.statusMessage || err?.statusMessage || 'Não foi possível excluir a conta'
    toast.add({ title: 'Erro', description: message, color: 'error' })
  } finally {
    isDeletingAccount.value = false
  }
}
</script>

<template>
  <UPageCard
    title="Senha"
    description="Confirme sua senha atual antes de definir uma nova."
    variant="subtle"
  >
    <UForm
      :schema="passwordSchema"
      :state="password"
      :validate="validate"
      class="flex flex-col gap-4 max-w-xs"
      @submit="onSubmitPassword"
    >
      <UFormField
        name="current"
        label="Senha atual"
      >
        <UInput
          v-model="password.current"
          type="password"
          placeholder="Senha atual"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="new"
        label="Nova senha"
      >
        <UInput
          v-model="password.new"
          type="password"
          placeholder="Nova senha"
          class="w-full"
        />
      </UFormField>

      <UButton
        label="Alterar senha"
        class="w-fit"
        type="submit"
        :loading="isChangingPassword"
        :disabled="isChangingPassword"
      />
    </UForm>
  </UPageCard>

  <UPageCard
    title="Conta"
    description="Deseja encerrar sua conta? Essa ação é irreversível. Todos os dados associados serão excluídos permanentemente."
    class="bg-gradient-to-tl from-error/10 from-5% to-default"
  >
    <template #footer>
      <UButton
        label="Excluir conta"
        color="error"
        :loading="isDeletingAccount"
        :disabled="isDeletingAccount"
        @click="deleteAccount"
      />
    </template>
  </UPageCard>
</template>
