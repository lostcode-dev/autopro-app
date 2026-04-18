<script setup lang="ts">
definePageMeta({ layout: "app" });
useSeoMeta({ title: "Relatórios - Visão Geral" });

const requestFetch = useRequestFetch();
const requestHeaders = import.meta.server
  ? useRequestHeaders(["cookie"])
  : undefined;

const { dateFrom, dateTo } = useReportDateRange();

const { data, status } = await useAsyncData(
  () => `report-overview-${dateFrom.value}-${dateTo.value}`,
  () =>
    requestFetch<{ data: any }>("/api/reports/overview", {
      headers: requestHeaders,
      query: { dateFrom: dateFrom.value, dateTo: dateTo.value },
    }),
  { watch: [dateFrom, dateTo] },
);

const overview = computed(() => data.value?.data?.overview ?? {});
const chartData = computed(() => overview.value?.chartData ?? []);
const topItems = computed(() => overview.value?.topItems ?? []);

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
function formatPercent(v: number) {
  return `${parseFloat(String(v || 0)).toFixed(1)}%`;
}

const chartBars = [
  { key: "revenue", label: "Faturamento", color: "#22c55e" },
  { key: "cost", label: "Custo", color: "#f87171" },
];

const kpis = computed(() => [
  {
    label: "Receita bruta",
    value: formatCurrency(overview.value?.grossRevenue ?? 0),
    icon: "i-lucide-trending-up",
    color: "text-green-600",
  },
  {
    label: "Custos totais",
    value: formatCurrency(overview.value?.totalCosts ?? 0),
    icon: "i-lucide-receipt",
    color: "text-red-500",
  },
  {
    label: "Lucro líquido",
    value: formatCurrency(overview.value?.netProfit ?? 0),
    icon: "i-lucide-circle-dollar-sign",
    color: "text-blue-600",
  },
  {
    label: "Margem de lucro",
    value: formatPercent(overview.value?.profitMargin ?? 0),
    icon: "i-lucide-percent",
    color: "text-purple-600",
  },
  {
    label: "Ticket médio",
    value: formatCurrency(overview.value?.averageTicket ?? 0),
    icon: "i-lucide-tag",
    color: "text-orange-500",
  },
  {
    label: "Clientes ativos",
    value: String(overview.value?.activeClients ?? 0),
    icon: "i-lucide-users",
    color: "text-primary",
  },
  {
    label: "Ordens finalizadas",
    value: String(overview.value?.totalOrders ?? 0),
    icon: "i-lucide-check-circle-2",
    color: "text-green-600",
  },
  {
    label: "Novos clientes",
    value: String(overview.value?.newClients ?? 0),
    icon: "i-lucide-user-plus",
    color: "text-primary",
  },
]);

const reports = [
  {
    title: "Comissões",
    description: "Comissões por funcionário e OS.",
    icon: "i-lucide-badge-percent",
    to: "/app/reports/commissions",
  },
  {
    title: "Clientes",
    description: "Receita e ticket médio por cliente.",
    icon: "i-lucide-users",
    to: "/app/reports/customers",
  },
  {
    title: "Inadimplentes",
    description: "Clientes com pagamentos pendentes.",
    icon: "i-lucide-alert-triangle",
    to: "/app/reports/debtors",
  },
  {
    title: "Custos e Lucro",
    description: "Análise de custos e margem.",
    icon: "i-lucide-trending-up",
    to: "/app/reports/costs",
  },
  {
    title: "Lucro",
    description: "Evolução e detalhamento de lucro.",
    icon: "i-lucide-circle-dollar-sign",
    to: "/app/reports/profit",
  },
  {
    title: "Compras",
    description: "Análise de compras por período.",
    icon: "i-lucide-shopping-cart",
    to: "/app/reports/purchases",
  },
  {
    title: "Fornecedores",
    description: "Histórico por fornecedor.",
    icon: "i-lucide-truck",
    to: "/app/reports/suppliers",
  },
  {
    title: "Itens Vendidos",
    description: "Serviços e peças mais vendidos.",
    icon: "i-lucide-list-checks",
    to: "/app/reports/sales-items",
  },
];
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Visão Geral" />
    </template>

    <template #body>
      <div class="p-4 pb-0">
        <!-- Filter card -->
        <UCard :ui="{ body: 'p-3' }">
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2 shrink-0 text-muted">
              <UIcon name="i-lucide-filter" class="size-4" />
              <span class="text-sm font-medium">Filtros</span>
            </div>
            <UiDateRangePicker v-model:from="dateFrom" v-model:to="dateTo" class="w-72" />
          </div>
        </UCard>
      </div>
      <div v-if="status === 'pending'" class="p-6 space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <USkeleton v-for="i in 8" :key="i" class="h-20 rounded-xl" />
        </div>
        <USkeleton class="h-56 rounded-xl" />
        <USkeleton class="h-32 rounded-xl" />
      </div>

      <div v-else class="p-4 space-y-5 pt-0">
        <!-- KPI Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <UPageCard
            v-for="kpi in kpis"
            :key="kpi.label"
            variant="subtle"
            class="text-center"
          >
            <div class="flex flex-col items-center gap-1 py-1">
              <UIcon :name="kpi.icon" class="text-xl" :class="kpi.color" />
              <p class="text-lg font-bold" :class="kpi.color">
                {{ kpi.value }}
              </p>
              <p class="text-xs text-muted">
                {{ kpi.label }}
              </p>
            </div>
          </UPageCard>
        </div>

        <!-- Revenue vs Cost Chart -->
        <UPageCard variant="subtle">
          <template #header>
            <p class="text-sm font-semibold">Faturamento vs Custo</p>
          </template>
          <AppBarChart
            :data="chartData"
            :bars="chartBars"
            :height="220"
            :format-value="formatCurrency"
          />
        </UPageCard>

        <!-- Top Items -->
        <UPageCard v-if="topItems.length" variant="subtle">
          <template #header>
            <p class="text-sm font-semibold">Itens mais vendidos</p>
          </template>
          <div class="space-y-1">
            <div
              v-for="(item, i) in topItems.slice(0, 10)"
              :key="item.name"
              class="flex items-center gap-3 py-1.5 border-b border-default last:border-0"
            >
              <span class="text-muted text-xs w-5 text-right shrink-0">{{
                i + 1
              }}</span>
              <span class="flex-1 text-sm truncate">{{ item.name }}</span>
              <UBadge
                :label="`${item.count}×`"
                color="primary"
                variant="subtle"
                size="xs"
              />
            </div>
          </div>
        </UPageCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
