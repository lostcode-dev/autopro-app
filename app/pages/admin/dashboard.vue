<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin'],
})
useSeoMeta({ title: 'Admin Dashboard' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { data: stats, status: statsStatus } = await useAsyncData(
  'admin-stats',
  () => requestFetch<Record<string, any>>('/api/admin/stats', { headers: requestHeaders })
)

const { data: quotas, status: quotasStatus } = await useAsyncData(
  'admin-quotas',
  () => requestFetch<Record<string, any>>('/api/fiscal/quotas', { headers: requestHeaders }).catch(() => null)
)

const statsCards = computed(() => [
  {
    label: 'Organizações',
    value: stats.value?.total_organizations ?? 0,
    sub: `+${stats.value?.new_organizations_last_30_days ?? 0} nos últimos 30 dias`,
    icon: 'i-lucide-building-2',
    color: 'primary',
  },
  {
    label: 'Usuários',
    value: stats.value?.total_users ?? 0,
    icon: 'i-lucide-users',
    color: 'secondary',
  },
  {
    label: 'Assinaturas Ativas',
    value: stats.value?.active_subscriptions ?? 0,
    sub: `${stats.value?.total_subscriptions ?? 0} total`,
    icon: 'i-lucide-credit-card',
    color: 'success',
  },
  {
    label: 'Ordens de Serviço',
    value: stats.value?.total_service_orders ?? 0,
    icon: 'i-lucide-wrench',
    color: 'warning',
  },
])

const quotaList = computed(() => {
  const d = quotas.value?.data
  if (!d || !Array.isArray(d['@value'])) return []
  return d['@value'] as Array<Record<string, any>>
})
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar title="Admin Dashboard" />

    <div class="p-6 space-y-8">
      <!-- Stats cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <template v-if="statsStatus === 'pending'">
          <USkeleton v-for="i in 4" :key="i" class="h-28 rounded-xl" />
        </template>
        <template v-else>
          <UPageCard
            v-for="card in statsCards"
            :key="card.label"
            :title="String(card.value)"
            :description="card.label"
          >
            <template #leading>
              <UIcon :name="card.icon" class="size-6 text-primary" />
            </template>
            <template v-if="card.sub" #footer>
              <span class="text-xs text-muted">{{ card.sub }}</span>
            </template>
          </UPageCard>
        </template>
      </div>

      <!-- NuvemFiscal quotas -->
      <UPageCard title="Cotas NuvemFiscal" description="Uso atual das cotas da API de notas fiscais.">
        <template v-if="quotasStatus === 'pending'">
          <USkeleton class="h-32" />
        </template>
        <template v-else-if="quotaList.length === 0">
          <p class="text-sm text-muted py-4">
            Não foi possível carregar as cotas ou nenhuma cota disponível.
          </p>
        </template>
        <template v-else>
          <div class="divide-y divide-default">
            <div
              v-for="quota in quotaList"
              :key="quota.nome"
              class="flex items-center justify-between py-3 gap-4"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium truncate">{{ quota.nome }}</p>
                <p class="text-xs text-muted">{{ quota.descricao }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-sm font-semibold">{{ quota.uso_atual }}</span>
                <span class="text-xs text-muted">/</span>
                <span class="text-sm text-muted">{{ quota.limite }}</span>
                <UBadge
                  :color="quota.uso_atual >= quota.limite ? 'error' : quota.uso_atual >= quota.limite * 0.8 ? 'warning' : 'success'"
                  variant="subtle"
                  size="sm"
                >
                  {{ quota.limite > 0 ? Math.round((quota.uso_atual / quota.limite) * 100) : 0 }}%
                </UBadge>
              </div>
            </div>
          </div>
        </template>
      </UPageCard>
    </div>
  </UDashboardPanel>
</template>
