<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Dashboard' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

const dateFrom = ref(defaultFrom)
const dateTo = ref(defaultTo)

const { data, status, refresh } = await useAsyncData(
  () => `dashboard-${dateFrom.value}-${dateTo.value}`,
  () => requestFetch<{ data: { overview: Record<string, any> } }>('/api/reports/overview', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value },
  }),
  { watch: [dateFrom, dateTo] }
)

// Also fetch today's appointments and open/in_progress service orders
const { data: todayAppointments } = await useAsyncData(
  () => `dash-appts-${dateFrom.value}`,
  () => requestFetch<{ items: any[]; total: number }>('/api/appointments', {
    headers: requestHeaders,
    query: { date_from: defaultFrom, date_to: defaultTo, page_size: 10 },
  })
)

const { data: openOrders } = await useAsyncData(
  'dash-open-orders',
  () => requestFetch<{ items: any[]; total: number }>('/api/service-orders', {
    headers: requestHeaders,
    query: { status: 'in_progress', cursor: 0, limit: 10 },
  })
)

const overview = computed(() => data.value?.data?.overview ?? null)

function formatCurrency(value: number | string) {
  return parseFloat(String(value || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPercent(value: number) {
  return `${parseFloat(String(value || 0)).toFixed(1)}%`
}

const statsCards = computed(() => {
  if (!overview.value) return []
  return [
    {
      label: 'Faturamento bruto',
      value: formatCurrency(overview.value.grossRevenue),
      icon: 'i-lucide-trending-up',
      color: 'text-green-500',
    },
    {
      label: 'Lucro líquido',
      value: formatCurrency(overview.value.netProfit),
      icon: 'i-lucide-circle-dollar-sign',
      color: 'text-blue-500',
    },
    {
      label: 'OS concluídas',
      value: overview.value.totalOrders ?? 0,
      icon: 'i-lucide-wrench',
      color: 'text-orange-500',
    },
    {
      label: 'Ticket médio',
      value: formatCurrency(overview.value.averageTicket),
      icon: 'i-lucide-receipt',
      color: 'text-purple-500',
    },
    {
      label: 'Novos clientes',
      value: overview.value.newClients ?? 0,
      icon: 'i-lucide-users',
      color: 'text-teal-500',
    },
    {
      label: 'Margem de lucro',
      value: formatPercent(overview.value.profitMargin),
      icon: 'i-lucide-percent',
      color: 'text-slate-500',
    },
  ]
})

const statusColorMap: Record<string, string> = {
  estimate: 'neutral', open: 'info', in_progress: 'warning',
  waiting_for_part: 'orange', completed: 'success', delivered: 'success', cancelled: 'error',
}
const statusLabelMap: Record<string, string> = {
  estimate: 'Orçamento', open: 'Aberta', in_progress: 'Em andamento',
  waiting_for_part: 'Aguard. peça', completed: 'Concluída', delivered: 'Entregue', cancelled: 'Cancelada',
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
          <div class="flex items-center gap-2">
            <UInput v-model="dateFrom" type="date" size="sm" class="w-36" />
            <span class="text-muted text-sm">até</span>
            <UInput v-model="dateTo" type="date" size="sm" class="w-36" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 space-y-6">
        <!-- Stats cards skeleton -->
        <div v-if="status === 'pending'" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <USkeleton v-for="i in 6" :key="i" class="h-28 rounded-xl" />
        </div>

        <!-- Stats cards -->
        <div v-else class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <UPageCard
            v-for="card in statsCards"
            :key="card.label"
            variant="subtle"
            class="text-center"
          >
            <div class="flex flex-col items-center gap-1">
              <UIcon :name="card.icon" :class="['text-2xl', card.color]" />
              <p class="text-xl font-bold">{{ card.value }}</p>
              <p class="text-xs text-muted">{{ card.label }}</p>
            </div>
          </UPageCard>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <!-- Today's appointments -->
          <UPageCard title="Agendamentos do período" variant="subtle">
            <div v-if="!todayAppointments" class="space-y-2">
              <USkeleton v-for="i in 3" :key="i" class="h-10 w-full" />
            </div>
            <div v-else-if="!todayAppointments.items?.length" class="text-sm text-muted py-4 text-center">
              Nenhum agendamento no período.
            </div>
            <ul v-else class="divide-y divide-default text-sm">
              <li
                v-for="appt in todayAppointments.items"
                :key="appt.id"
                class="py-2 flex items-center justify-between gap-2"
              >
                <div>
                  <p class="font-medium">{{ appt.clients?.name ?? '—' }}</p>
                  <p class="text-muted text-xs">{{ appt.service_type }} — {{ appt.appointment_date }} {{ appt.time }}</p>
                </div>
                <UBadge color="info" variant="subtle" :label="appt.status" size="sm" />
              </li>
            </ul>
            <template v-if="(todayAppointments?.total ?? 0) > 10" #footer>
              <NuxtLink to="/app/appointments" class="text-xs text-primary hover:underline">
                Ver todos ({{ todayAppointments?.total }})
              </NuxtLink>
            </template>
          </UPageCard>

          <!-- OS in progress -->
          <UPageCard title="OS em andamento" variant="subtle">
            <div v-if="!openOrders" class="space-y-2">
              <USkeleton v-for="i in 3" :key="i" class="h-10 w-full" />
            </div>
            <div v-else-if="!openOrders.items?.length" class="text-sm text-muted py-4 text-center">
              Nenhuma OS em andamento.
            </div>
            <ul v-else class="divide-y divide-default text-sm">
              <li
                v-for="order in openOrders.items"
                :key="order.id"
                class="py-2 flex items-center justify-between gap-2"
              >
                <div>
                  <p class="font-medium">OS {{ order.number }} — {{ order._clientName ?? '—' }}</p>
                  <p class="text-muted text-xs">{{ order._vehicleLabel ?? '' }}</p>
                </div>
                <UBadge
                  :color="statusColorMap[order.status] ?? 'neutral'"
                  variant="subtle"
                  :label="statusLabelMap[order.status] ?? order.status"
                  size="sm"
                />
              </li>
            </ul>
            <template v-if="(openOrders?.total ?? 0) > 10" #footer>
              <NuxtLink to="/app/service-orders" class="text-xs text-primary hover:underline">
                Ver todas ({{ openOrders?.total }})
              </NuxtLink>
            </template>
          </UPageCard>
        </div>

        <!-- Top items -->
        <UPageCard
          v-if="overview?.topItems?.length"
          title="Serviços/peças mais frequentes no período"
          variant="subtle"
        >
          <ul class="divide-y divide-default text-sm">
            <li
              v-for="(item, i) in overview.topItems"
              :key="i"
              class="py-2 flex items-center justify-between"
            >
              <span>{{ item.name }}</span>
              <UBadge color="neutral" variant="subtle" :label="`${item.count}×`" />
            </li>
          </ul>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
