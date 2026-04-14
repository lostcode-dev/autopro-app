<script setup lang="ts">
import { useWorkshopBootstrap } from '~/composables/useWorkshopBootstrap'

definePageMeta({
  layout: 'subscription'
})

useSeoMeta({
  title: 'Pagamento confirmado — beenk',
  description: 'Sua assinatura foi ativada com sucesso'
})

const router = useRouter()
const bootstrap = useWorkshopBootstrap()

// Polling state
const POLL_INTERVAL_MS = 2500
const MAX_ATTEMPTS = 14 // ~35s total
const attempts = ref(0)
const timedOut = ref(false)
const redirecting = ref(false)

async function tryRedirect() {
  if (redirecting.value) return

  // Force fresh bootstrap — webhook may have just created the org
  await bootstrap.fetchBootstrap(true)

  if (bootstrap.organizationId.value) {
    redirecting.value = true
    await router.replace('/app')
    return
  }

  attempts.value++

  if (attempts.value >= MAX_ATTEMPTS) {
    timedOut.value = true
    return
  }

  setTimeout(tryRedirect, POLL_INTERVAL_MS)
}

onMounted(() => {
  tryRedirect()
})

async function goToApp() {
  redirecting.value = true
  await bootstrap.fetchBootstrap(true)
  await router.replace('/app')
}
</script>

<template>
  <div class="flex flex-col items-center text-center gap-8 py-8 animate-fade-in">

    <!-- Ícone de status -->
    <div class="relative flex items-center justify-center">
      <!-- Anel pulsante -->
      <div class="absolute size-28 rounded-full bg-primary/10 animate-ping-slow" />
      <div class="relative flex items-center justify-center size-20 rounded-full bg-primary/10">
        <UIcon name="i-lucide-check-circle-2" class="size-10 text-primary" />
      </div>
    </div>

    <!-- Mensagem principal -->
    <div class="space-y-2 max-w-sm">
      <h1 class="text-2xl font-bold text-highlighted">
        Pagamento confirmado!
      </h1>
      <p class="text-muted leading-relaxed text-sm">
        Sua assinatura foi ativada. Estamos configurando sua oficina — isso leva apenas alguns instantes.
      </p>
    </div>

    <!-- Estado: aguardando webhook -->
    <div v-if="!timedOut && !redirecting" class="flex flex-col items-center gap-3">
      <div class="flex items-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-loader-2" class="size-4 animate-spin text-primary" />
        Configurando seu espaço de trabalho…
      </div>
      <div class="h-1.5 w-48 rounded-full bg-default overflow-hidden">
        <div
          class="h-full bg-primary rounded-full transition-all duration-500"
          :style="{ width: `${Math.min((attempts / MAX_ATTEMPTS) * 100, 95)}%` }"
        />
      </div>
    </div>

    <!-- Estado: redirecionando -->
    <div v-else-if="redirecting" class="flex items-center gap-2 text-sm text-muted">
      <UIcon name="i-lucide-loader-2" class="size-4 animate-spin text-primary" />
      Redirecionando para o sistema…
    </div>

    <!-- Estado: timeout — botão manual -->
    <div v-else class="flex flex-col items-center gap-3">
      <p class="text-sm text-muted max-w-xs">
        A configuração está demorando um pouco mais. Clique abaixo para acessar o sistema.
      </p>
      <UButton
        color="primary"
        size="lg"
        icon="i-lucide-arrow-right"
        trailing
        :loading="redirecting"
        @click="goToApp"
      >
        Acessar o sistema
      </UButton>
    </div>

    <!-- Garantias -->
    <div class="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-muted pt-2">
      <span class="flex items-center gap-1.5">
        <UIcon name="i-lucide-shield-check" class="size-3.5 text-primary/60" />
        Pagamento processado com segurança
      </span>
      <span class="flex items-center gap-1.5">
        <UIcon name="i-lucide-receipt" class="size-3.5 text-primary/60" />
        Recibo enviado por email
      </span>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes ping-slow {
  0%   { transform: scale(1); opacity: 0.4; }
  70%  { transform: scale(1.6); opacity: 0; }
  100% { transform: scale(1.6); opacity: 0; }
}

.animate-fade-in {
  animation: fade-in 0.5s ease both;
}

.animate-ping-slow {
  animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}
</style>
