<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Dashboard' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { data: dashStats, status } = await useAsyncData(
  'dashboard-stats',
  () => requestFetch<{
    openOrdersCount: number
    grossRevenue: number
    totalClients: number
    todayAppointmentsCount: number
    lowStockCount: number
    recentOrders: {
      id: string
      number: string | number
      status: string
      entry_date: string
      reported_defect: string | null
      total_amount: number
      clientName: string
      vehicleLabel: string
    }[]
    todaySchedule: {
      id: string
      time: string
      status: string
      service_type: string
      clientName: string
      vehicleLabel: string
    }[]
  }>('/api/reports/dashboard-stats', { headers: requestHeaders })
)

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

const statusColorMap: Record<string, string> = {
  estimate: 'neutral', open: 'info', in_progress: 'warning',
  waiting_for_part: 'orange', completed: 'success', delivered: 'success', cancelled: 'error'
}
const statusLabelMap: Record<string, string> = {
  estimate: 'Orçamento', open: 'Aberta', in_progress: 'Em andamento',
  waiting_for_part: 'Aguard. peça', completed: 'Concluída', delivered: 'Entregue', cancelled: 'Cancelada'
}

const apptStatusColorMap: Record<string, string> = {
  scheduled: 'neutral', confirmed: 'success', cancelled: 'error', completed: 'success'
}
const apptStatusLabelMap: Record<string, string> = {
  scheduled: 'Agendado', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Concluído'
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #leading>
          <AppSidebarCollapse />
        </template>
        <template #right>
          <NotificationsButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 space-y-6">
        <!-- Stats cards skeleton -->
        <div v-if="status === 'pending'" class="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <USkeleton v-for="i in 4" :key="i" class="h-28 rounded-xl" />
        </div>

        <!-- Stats cards -->
        <div v-else class="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <UPageCard
            to="/app/service-orders?status=open,in_progress,waiting_for_part"
            variant="subtle"
            class="text-center"
          >
            <div class="flex flex-col items-center gap-1">
              <UIcon name="i-lucide-wrench" class="text-2xl text-blue-500" />
              <p class="text-xl font-bold">
                {{ dashStats!.openOrdersCount }}
              </p>
              <p class="text-xs text-muted">
                OS em Andamento
              </p>
            </div>
          </UPageCard>

          <UPageCard
            to="/app/reports"
            variant="subtle"
            class="text-center"
          >
            <div class="flex flex-col items-center gap-1">
              <UIcon name="i-lucide-trending-up" class="text-2xl text-green-500" />
              <p class="text-xl font-bold">
                {{ formatCurrency(dashStats!.grossRevenue) }}
              </p>
              <p class="text-xs text-muted">
                Faturamento do Mês
              </p>
            </div>
          </UPageCard>

          <UPageCard
            to="/app/customers"
            variant="subtle"
            class="text-center"
          >
            <div class="flex flex-col items-center gap-1">
              <UIcon name="i-lucide-users" class="text-2xl text-purple-500" />
              <p class="text-xl font-bold">
                {{ dashStats!.totalClients }}
              </p>
              <p class="text-xs text-muted">
                Total de Clientes
              </p>
            </div>
          </UPageCard>

          <UPageCard
            to="/app/appointments"
            variant="subtle"
            class="text-center"
          >
            <div class="flex flex-col items-center gap-1">
              <UIcon name="i-lucide-calendar" class="text-2xl text-orange-500" />
              <p class="text-xl font-bold">
                {{ dashStats!.todayAppointmentsCount }}
              </p>
              <p class="text-xs text-muted">
                Agendamentos Hoje
              </p>
            </div>
          </UPageCard>
        </div>

        <!-- Low stock banner -->
        <div
          v-if="(dashStats?.lowStockCount ?? 0) > 0"
          class="flex items-center gap-3 rounded-xl border border-warning bg-warning/10 p-4"
        >
          <UIcon name="i-lucide-alert-triangle" class="text-warning text-xl shrink-0" />
          <div>
            <p class="font-semibold text-sm">
              Atenção ao Estoque
            </p>
            <p class="text-xs text-muted">
              {{ dashStats!.lowStockCount }} peça{{ dashStats!.lowStockCount > 1 ? 's' : '' }} com estoque baixo
            </p>
          </div>
          <NuxtLink to="/app/inventory" class="ml-auto text-xs text-primary hover:underline">
            Ver itens →
          </NuxtLink>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <!-- Ordens recentes -->
          <UPageCard
            icon="i-lucide-clipboard-list"
            variant="subtle"
          >
            <template #title>
              <NuxtLink to="/app/service-orders" class="hover:underline">
                Ordens Recentes
              </NuxtLink>
            </template>
            <div v-if="status === 'pending'" class="space-y-2">
              <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
            </div>
            <div v-else-if="!dashStats?.recentOrders?.length" class="text-sm text-muted py-8 text-center flex flex-col items-center gap-2">
              <UIcon name="i-lucide-wind" class="text-2xl text-muted" />
              Nenhuma ordem de serviço encontrada.
            </div>
            <ul v-else class="divide-y divide-default text-sm">
              <li
                v-for="order in dashStats!.recentOrders"
                :key="order.id"
              >
                <NuxtLink
                  :to="`/app/service-orders/${order.id}`"
                  class="py-2 flex items-start justify-between gap-2 hover:bg-elevated/50 rounded-md px-1 -mx-1 transition"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="font-medium">
                        OS {{ order.number }} — {{ order.clientName }}
                      </p>
                      <UBadge
                        :color="statusColorMap[order.status] ?? 'neutral'"
                        variant="subtle"
                        :label="statusLabelMap[order.status] ?? order.status"
                        size="xs"
                      />
                    </div>
                    <p class="text-muted text-xs truncate">
                      {{ order.vehicleLabel }}
                    </p>
                    <p v-if="order.reported_defect" class="text-muted text-xs truncate">
                      {{ order.reported_defect }}
                    </p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-xs font-medium">
                      {{ formatCurrency(order.total_amount) }}
                    </p>
                    <p class="text-muted text-xs">
                      {{ formatDate(order.entry_date) }}
                    </p>
                  </div>
                </NuxtLink>
              </li>
            </ul>
          </UPageCard>

          <!-- Agenda de hoje -->
          <UPageCard
            icon="i-lucide-calendar-days"
            variant="subtle"
          >
            <template #title>
              <NuxtLink to="/app/appointments" class="hover:underline">
                Agenda de Hoje
              </NuxtLink>
            </template>
            <div v-if="status === 'pending'" class="space-y-2">
              <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
            </div>
            <div v-else-if="!dashStats?.todaySchedule?.length" class="text-sm text-muted py-8 text-center flex flex-col items-center gap-2">
              <UIcon name="i-lucide-wind" class="text-2xl text-muted" />
              Nenhum agendamento para hoje.
            </div>
            <ul v-else class="divide-y divide-default text-sm">
              <li
                v-for="appt in dashStats!.todaySchedule"
                :key="appt.id"
              >
                <NuxtLink
                  :to="`/app/appointments/${appt.id}`"
                  class="py-2 flex items-center justify-between gap-2 hover:bg-elevated/50 rounded-md px-1 -mx-1 transition"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-mono text-xs font-semibold">{{ appt.time }}</span>
                      <p class="font-medium truncate">
                        {{ appt.clientName }}
                      </p>
                    </div>
                    <p class="text-muted text-xs">
                      {{ appt.vehicleLabel }} — {{ appt.service_type }}
                    </p>
                  </div>
                  <UBadge
                    :color="apptStatusColorMap[appt.status] ?? 'neutral'"
                    variant="subtle"
                    :label="apptStatusLabelMap[appt.status] ?? appt.status"
                    size="sm"
                  />
                </NuxtLink>
              </li>
            </ul>
          </UPageCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

