<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin']
})
useSeoMeta({ title: 'Admin — Sistema' })

const toast = useToast()

// ─── Commission seed ──────────────────────────────────────────────────────────
const seedingCommissions = ref(false)
const seedResult = ref<{ created: number, skipped: number, errors: number } | null>(null)

async function runCommissionSeed() {
  seedingCommissions.value = true
  seedResult.value = null
  try {
    const res = await $fetch<{ data: { created: number, skipped: number, errors: number } }>(
      '/api/service-orders/seed-commissions',
      { method: 'POST', body: {} }
    )
    seedResult.value = res.data
    toast.add({ title: 'Seed de comissões concluído', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Erro ao executar seed', description: err?.data?.statusMessage ?? err?.message, color: 'error' })
  } finally {
    seedingCommissions.value = false
  }
}

const tools = [
  {
    id: 'seed-commissions',
    title: 'Seed de Comissões',
    description: 'Recalcula e armazena comissões em nível de item para todas as ordens de serviço sem comissão registrada.',
    icon: 'i-lucide-percent',
    action: runCommissionSeed,
    loadingRef: seedingCommissions
  }
]
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar title="Ferramentas do Sistema" />

    <div class="p-6 space-y-4">
      <p class="text-sm text-muted">
        Ferramentas administrativas e de manutenção do sistema. Use com cuidado — estas operações afetam dados globais.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UPageCard
          v-for="tool in tools"
          :key="tool.id"
          :title="tool.title"
          :description="tool.description"
        >
          <template #leading>
            <UIcon :name="tool.icon" class="size-5 text-primary" />
          </template>

          <template #footer>
            <div class="flex flex-col gap-2">
              <div
                v-if="tool.id === 'seed-commissions' && seedResult"
                class="text-xs text-muted space-x-3"
              >
                <span>Criadas: <strong>{{ seedResult.created }}</strong></span>
                <span>Ignoradas: <strong>{{ seedResult.skipped }}</strong></span>
                <span>Erros: <strong>{{ seedResult.errors }}</strong></span>
              </div>
              <UButton
                :loading="tool.loadingRef.value"
                :disabled="tool.loadingRef.value"
                variant="outline"
                size="sm"
                @click="tool.action"
              >
                Executar
              </UButton>
            </div>
          </template>
        </UPageCard>
      </div>
    </div>
  </UDashboardPanel>
</template>
