<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin']
})
useSeoMeta({ title: 'Admin Dashboard' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { data: stats, status: statsStatus } = await useAsyncData(
  'admin-stats',
  () => requestFetch<Record<string, any>>('/api/admin/stats', { headers: requestHeaders })
)

const statsCards = computed(() => [
  {
    label: 'Organizações',
    value: stats.value?.total_organizations ?? 0,
    sub: `+${stats.value?.new_organizations_last_30_days ?? 0} nos últimos 30 dias`,
    icon: 'i-lucide-building-2',
    color: 'primary'
  },
  {
    label: 'Usuários',
    value: stats.value?.total_users ?? 0,
    icon: 'i-lucide-users',
    color: 'secondary'
  },
  {
    label: 'Assinaturas Ativas',
    value: stats.value?.active_subscriptions ?? 0,
    sub: `${stats.value?.total_subscriptions ?? 0} total`,
    icon: 'i-lucide-credit-card',
    color: 'success'
  },
  {
    label: 'Ordens de Serviço',
    value: stats.value?.total_service_orders ?? 0,
    icon: 'i-lucide-wrench',
    color: 'warning'
  }
])

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
    </div>
  </UDashboardPanel>
</template>
