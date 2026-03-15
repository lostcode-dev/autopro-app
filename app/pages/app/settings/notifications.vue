<script setup lang="ts">
definePageMeta({
  layout: 'app'
})

useSeoMeta({
  title: 'Notificações'
})

const toast = useToast()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

type NotificationPreferences = {
  channel_email: boolean
  channel_desktop: boolean
  digest_weekly: boolean
  product_updates: boolean
  important_updates: boolean
}

const { data, status } = await useAsyncData(
  'notification-preferences',
  () => requestFetch<NotificationPreferences>('/api/settings/notifications', { headers: requestHeaders })
)

const state = reactive<NotificationPreferences>({
  channel_email: true,
  channel_desktop: false,
  digest_weekly: false,
  product_updates: true,
  important_updates: true
})

watch(data, (newData) => {
  if (newData) {
    state.channel_email = newData.channel_email
    state.channel_desktop = newData.channel_desktop
    state.digest_weekly = newData.digest_weekly
    state.product_updates = newData.product_updates
    state.important_updates = newData.important_updates
  }
}, { immediate: true })

type SectionField = {
  name: keyof NotificationPreferences
  label: string
  description: string
}

type Section = {
  title: string
  description: string
  fields: SectionField[]
}

const sections: Section[] = [{
  title: 'Canais de notificação',
  description: 'Onde podemos notificar você?',
  fields: [{
    name: 'channel_email',
    label: 'Email',
    description: 'Receba um resumo diário por email.'
  }, {
    name: 'channel_desktop',
    label: 'Desktop',
    description: 'Receba notificações no desktop.'
  }]
}, {
  title: 'Atualizações da conta',
  description: 'Receba novidades sobre o Kortex.',
  fields: [{
    name: 'digest_weekly',
    label: 'Resumo semanal',
    description: 'Receba um resumo semanal de novidades.'
  }, {
    name: 'product_updates',
    label: 'Atualizações do produto',
    description: 'Receba um email mensal com novos recursos e melhorias.'
  }, {
    name: 'important_updates',
    label: 'Atualizações importantes',
    description: 'Receba emails sobre correções de segurança, manutenção, etc.'
  }]
}]

const isSaving = ref(false)

async function onChange() {
  if (isSaving.value) return
  isSaving.value = true

  try {
    await $fetch('/api/settings/notifications', {
      method: 'PUT',
      body: {
        channel_email: state.channel_email,
        channel_desktop: state.channel_desktop,
        digest_weekly: state.digest_weekly,
        product_updates: state.product_updates,
        important_updates: state.important_updates
      }
    })

    toast.add({
      title: 'Preferências salvas',
      description: 'Suas preferências de notificação foram atualizadas.',
      color: 'success'
    })
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    const message = err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar as preferências'
    toast.add({ title: 'Erro', description: message, color: 'error' })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="status === 'pending'" class="space-y-4">
    <USkeleton class="h-20 w-full" />
    <USkeleton class="h-32 w-full" />
    <USkeleton class="h-20 w-full" />
    <USkeleton class="h-48 w-full" />
  </div>

  <template v-else>
    <div
      v-for="(section, index) in sections"
      :key="index"
    >
      <UPageCard
        :title="section.title"
        :description="section.description"
        variant="naked"
        class="mb-4"
      />

      <UPageCard
        variant="subtle"
        :ui="{ container: 'divide-y divide-default' }"
      >
        <UFormField
          v-for="field in section.fields"
          :key="field.name"
          :name="field.name"
          :label="field.label"
          :description="field.description"
          class="flex items-center justify-between not-last:pb-4 gap-2"
        >
          <USwitch
            v-model="state[field.name]"
            :disabled="isSaving"
            @update:model-value="onChange"
          />
        </UFormField>
      </UPageCard>
    </div>
  </template>
</template>
