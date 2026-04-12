<script setup lang="ts">
const { loading: authLoading } = useAuth()
</script>

<template>
  <div class="relative min-h-screen overflow-hidden px-4 py-8" style="padding-top: max(2rem, var(--safe-area-top)); padding-bottom: max(2rem, var(--safe-area-bottom));">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(18,227,154,0.16),_transparent_36%),linear-gradient(180deg,rgba(2,6,24,0),rgba(2,6,24,0.6))]" />

    <UButton
      icon="i-lucide-chevron-left"
      to="/"
      size="xl"
      color="neutral"
      variant="subtle"
      class="absolute left-4 top-4 sm:left-8 sm:top-8 rounded-full z-10"
    />

    <div class="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
      <div class="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_minmax(0,420px)]">
        <div class="hidden lg:block">
          <div class="max-w-md space-y-6">
            <AppLogo />
            <div class="space-y-3">
              <p class="text-sm font-semibold uppercase tracking-[0.28em] text-primary/75">
                Operação moderna para oficinas
              </p>
              <h1 class="text-4xl font-semibold tracking-tight text-highlighted">
                Organize a oficina, acompanhe a equipe e centralize a operação em um só lugar.
              </h1>
              <p class="text-base leading-7 text-toned">
                O AutoPro conecta atendimento, ordens de serviço, cadastros, compras e relatórios em um fluxo pensado para o dia a dia da oficina.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-5">
          <div class="flex justify-center lg:hidden">
            <AppLogo />
          </div>

          <UPageCard
            variant="subtle"
            class="mx-auto w-full max-w-sm border border-default/60 bg-default/75 backdrop-blur"
          >
            <slot />
          </UPageCard>
        </div>
      </div>
    </div>

    <div
      v-if="authLoading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-default/85 backdrop-blur-sm"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="flex flex-col items-center gap-3 text-center">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
        <p class="text-sm text-toned">
          Verificando sessão...
        </p>
      </div>
    </div>
  </div>
</template>
