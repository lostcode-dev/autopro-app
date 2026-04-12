<script setup lang="ts">
import { PostHogEvent } from '~/types/analytics'

const columns = [{
  label: 'Recursos',
  children: [{
    label: 'Ajuda'
  }, {
    label: 'Documentação'
  }, {
    label: 'Migração'
  }, {
    label: 'Novidades'
  }]
}, {
  label: 'Produto',
  children: [{
    label: 'Ordens de serviço'
  }, {
    label: 'Clientes'
  }, {
    label: 'Veículos'
  }, {
    label: 'Financeiro'
  }]
}, {
  label: 'Empresa',
  children: [{
    label: 'Sobre'
  }, {
    label: 'Planos'
  }, {
    label: 'Carreiras'
  }, {
    label: 'Blog'
  }]
}]

const toast = useToast()
const { capture } = usePostHog()

const email = ref('')
const loading = ref(false)

function onSubmit() {
  loading.value = true
  capture(PostHogEvent.PublicNewsletterSubmitted, {
    has_email: Boolean(email.value.trim()),
    location: 'footer'
  })

  toast.add({
    title: 'Inscrição confirmada!',
    description: 'Você vai receber novidades do AutoPro por email.'
  })
}
</script>

<template>
  <USeparator
    icon="i-simple-icons-nuxtdotjs"
    class="h-px"
  />

  <UFooter :ui="{ top: 'border-b border-default' }">
    <template #top>
      <UContainer>
        <UFooterColumns :columns="columns">
          <template #right>
            <form @submit.prevent="onSubmit">
              <UFormField
                name="email"
                label="Receba novidades do AutoPro"
                size="lg"
              >
                <UInput
                  v-model="email"
                  type="email"
                  class="w-full"
                  placeholder="Digite seu email"
                >
                  <template #trailing>
                    <UButton
                      type="submit"
                      size="xs"
                      color="neutral"
                      label="Inscrever"
                    />
                  </template>
                </UInput>
              </UFormField>
            </form>
          </template>
        </UFooterColumns>
      </UContainer>
    </template>

    <template #left>
      <p class="text-muted text-sm">
        AutoPro • © {{ new Date().getFullYear() }}
      </p>
    </template>

    <template #right>
      <UButton
        to="/docs/getting-started"
        icon="i-lucide-book-open"
        aria-label="Abrir documentação"
        color="neutral"
        variant="ghost"
        @click="capture(PostHogEvent.PublicFooterCtaClicked, { location: 'footer', target: '/docs/getting-started', target_label: 'Documentation' })"
      />
      <UButton
        to="/changelog"
        icon="i-lucide-history"
        aria-label="Ver novidades"
        color="neutral"
        variant="ghost"
        @click="capture(PostHogEvent.PublicFooterCtaClicked, { location: 'footer', target: '/changelog', target_label: 'Changelog' })"
      />
      <UButton
        to="/blog"
        icon="i-lucide-pencil"
        aria-label="Abrir blog"
        color="neutral"
        variant="ghost"
        @click="capture(PostHogEvent.PublicFooterCtaClicked, { location: 'footer', target: '/blog', target_label: 'Blog' })"
      />
    </template>
  </UFooter>
</template>
