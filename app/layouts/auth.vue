<script setup lang="ts">
const { loading: authLoading } = useAuth()
</script>

<template>
  <div class="min-h-screen bg-white flex">
    <!-- ─── Left panel — brand (desktop only) ─────────────────────────── -->
    <div class="hidden lg:flex lg:w-2/5 xl:w-1/2 flex-col relative overflow-hidden bg-gradient-to-br from-purple-600 to-purple-800">
      <!-- Decorative circles -->
      <div class="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/5" />
      <div class="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-purple-900/40 translate-x-1/3 translate-y-1/4" />
      <div class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full bg-white/[0.03] border border-white/10" />

      <!-- Content -->
      <div class="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">
        <!-- Logo -->
        <div>
          <img
            src="/images/beenk-logo.png"
            alt="beenk"
            class="h-9 w-auto brightness-0 invert"
          >
        </div>

        <!-- Tagline -->
        <div class="space-y-4">
          <p class="text-xs font-semibold uppercase tracking-widest text-purple-200">
            Sistema de gestão para oficinas
          </p>
          <h2 class="text-3xl xl:text-4xl font-bold leading-snug text-white">
            Organize a oficina e centralize a operação em um só lugar.
          </h2>
          <p class="text-purple-200 leading-relaxed text-sm">
            Ordens de serviço, clientes, estoque, financeiro e relatórios — tudo integrado para o dia a dia da sua oficina.
          </p>
        </div>

        <!-- Footer note -->
        <p class="text-purple-300/60 text-xs">
          © {{ new Date().getFullYear() }} beenk. Todos os direitos reservados.
        </p>
      </div>
    </div>

    <!-- ─── Right panel — form ─────────────────────────────────────────── -->
    <div
      class="flex flex-1 flex-col items-center justify-center px-6 py-12"
      style="padding-top: max(3rem, var(--safe-area-top)); padding-bottom: max(3rem, var(--safe-area-bottom));"
    >
      <!-- Mobile logo -->
      <div class="mb-8 lg:hidden">
        <img
          src="/images/beenk-logo.png"
          alt="beenk"
          class="h-8 w-auto"
        >
      </div>

      <div class="w-full max-w-sm">
        <slot />
      </div>
    </div>

    <!-- ─── Auth loading overlay ──────────────────────────────────────── -->
    <div
      v-if="authLoading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="flex flex-col items-center gap-3 text-center">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
        <p class="text-sm text-muted">
          Verificando sessão...
        </p>
      </div>
    </div>
  </div>
</template>
