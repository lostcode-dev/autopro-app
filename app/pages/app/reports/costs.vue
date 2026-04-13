<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Custos e Lucro' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

const dateFrom = ref(defaultFrom)
const dateTo = ref(defaultTo)

const { data, status } = await useAsyncData(
  () => `report-costs-${dateFrom.value}-${dateTo.value}`,
  () => requestFetch<{ data: any }>('/api/reports/costs-profit', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, includeReport: 'true', includeProfitReport: 'true' }
  }),
  { watch: [dateFrom, dateTo] }
)

const report = computed(() => data.value?.data?.costsReport ?? data.value?.data ?? {})

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatPercent(v: number) {
  return `${parseFloat(String(v || 0)).toFixed(1)}%`
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Custos e Lucro">
        <template #leading>
          <AppSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UInput
              v-model="dateFrom"
              type="date"
              size="sm"
              class="w-36"
            />
            <span class="text-muted text-sm">até</span>
            <UInput
              v-model="dateTo"
              type="date"
              size="sm"
              class="w-36"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="p-6 space-y-4">
        <USkeleton v-for="i in 6" :key="i" class="h-20 rounded-xl" />
      </div>

      <div v-else class="p-4 space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-green-600">
              {{ formatCurrency(report.grossRevenue ?? report.totalRevenue ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Receita bruta
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-red-500">
              {{ formatCurrency(report.totalCosts ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Custos totais
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-blue-600">
              {{ formatCurrency(report.netProfit ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Lucro líquido
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold">
              {{ formatPercent(report.profitMargin ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Margem de lucro
            </p>
          </UPageCard>
        </div>

        <!-- Cost breakdown if available -->
        <UPageCard v-if="report.costBreakdown" title="Detalhamento de Custos" variant="subtle">
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div v-for="(value, key) in report.costBreakdown" :key="key">
              <dt class="text-muted text-xs">
                {{ key }}
              </dt>
              <dd class="font-medium">
                {{ formatCurrency(value) }}
              </dd>
            </div>
          </dl>
        </UPageCard>

        <div v-if="!data?.data" class="text-center text-muted py-8">
          <p>Nenhum dado disponível para o período selecionado.</p>
        </div>
      </div>
    </template>
    </UDashboardPanelst lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const dateFrom = ref(defaultFrom)
    const dateTo = ref(defaultTo)

    const { data, status } = await useAsyncData(
    () => `report-costs-${dateFrom.value}-${dateTo.value}`,
    () => requestFetch<{ data: any }>('/api/reports/costs-profit', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, includeReport: 'true', includeProfitReport: 'true' },
    }),
    { watch: [dateFrom, dateTo] }
    )

    const report = computed(() => data.value?.data?.costsReport ?? data.value?.data ?? {})

    function formatCurrency(v: number | string) {
    return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }
    function formatPercent(v: number) {
    return `${parseFloat(String(v || 0)).toFixed(1)}%`
    }
    </script>

    <template>
      <UDashboardPanel>
        <template #header>
          <UDashboardNavbar title="Custos e Lucro">
            <template #leading>
              <AppSidebarCollapse />
            </template>
            <template #right>
              <div class="flex items-center gap-2">
                <UInput
                  v-model="dateFrom"
                  type="date"
                  size="sm"
                  class="w-36"
                />
                <span class="text-muted text-sm">até</span>
                <UInput
                  v-model="dateTo"
                  type="date"
                  size="sm"
                  class="w-36"
                />
              </div>
            </template>
          </UDashboardNavbar>
        </template>

        <template #body>
          <div v-if="status === 'pending'" class="p-6 space-y-4">
            <USkeleton v-for="i in 6" :key="i" class="h-20 rounded-xl" />
          </div>

          <div v-else class="p-4 space-y-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <UPageCard variant="subtle" class="text-center">
                <p class="text-lg font-bold text-green-600">
                  {{ formatCurrency(report.grossRevenue ?? report.totalRevenue ?? 0) }}
                </p>
                <p class="text-xs text-muted">
                  Receita bruta
                </p>
              </UPageCard>
              <UPageCard variant="subtle" class="text-center">
                <p class="text-lg font-bold text-red-500">
                  {{ formatCurrency(report.totalCosts ?? 0) }}
                </p>
                <p class="text-xs text-muted">
                  Custos totais
                </p>
              </UPageCard>
              <UPageCard variant="subtle" class="text-center">
                <p class="text-lg font-bold text-blue-600">
                  {{ formatCurrency(report.netProfit ?? 0) }}
                </p>
                <p class="text-xs text-muted">
                  Lucro líquido
                </p>
              </UPageCard>
              <UPageCard variant="subtle" class="text-center">
                <p class="text-lg font-bold">
                  {{ formatPercent(report.profitMargin ?? 0) }}
                </p>
                <p class="text-xs text-muted">
                  Margem de lucro
                </p>
              </UPageCard>
            </div>

            <!-- Cost breakdown if available -->
            <UPageCard v-if="report.costBreakdown" title="Detalhamento de Custos" variant="subtle">
              <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                <div v-for="(value, key) in report.costBreakdown" :key="key">
                  <dt class="text-muted text-xs">
                    {{ key }}
                  </dt>
                  <dd class="font-medium">
                    {{ formatCurrency(value) }}
                  </dd>
                </div>
              </dl>
            </UPageCard>

            <div v-if="!data?.data" class="text-center text-muted py-8">
              <p>Nenhum dado disponível para o período selecionado.</p>
            </div>
          </div>
        </template>
      </UDashboardPanel>
    </template>
  </udashboardpanel>
</template>
