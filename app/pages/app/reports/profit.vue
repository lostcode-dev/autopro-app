<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Lucro' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

const dateFrom = ref(defaultFrom)
const dateTo = ref(defaultTo)

const { data, status } = await useAsyncData(
  () => `report-profit-${dateFrom.value}-${dateTo.value}`,
  () => requestFetch<{ data: any }>('/api/reports/costs-profit', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, includeProfitReport: 'true' }
  }),
  { watch: [dateFrom, dateTo] }
)

const profitReport = computed(() => data.value?.data?.profitReport ?? {})
const current = computed(() => profitReport.value?.currentData ?? {})
const previous = computed(() => profitReport.value?.previousData ?? {})
const variations = computed(() => profitReport.value?.variations ?? {})
const evolution = computed(() => profitReport.value?.evolutionData ?? [])

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatPercent(v: number) {
  return `${parseFloat(String(v || 0)).toFixed(1)}%`
}
function variationColor(v: number) {
  return v >= 0 ? 'text-green-600' : 'text-red-500'
}
function variationIcon(v: number) {
  return v >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
}

const evolutionColumns = [
  { accessorKey: 'label', header: 'Período' },
  { id: 'revenue', header: 'Receita' },
  { id: 'costs', header: 'Custos' },
  { id: 'profit', header: 'Lucro' },
  { id: 'margin', header: 'Margem' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Relatório de Lucro">
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
        <!-- Current period KPIs -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-green-600">
              {{ formatCurrency(current.grossRevenue ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Receita bruta
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-red-500">
              {{ formatCurrency(current.totalCosts ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Custos
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold text-blue-600">
              {{ formatCurrency(current.netProfit ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Lucro líquido
            </p>
          </UPageCard>
          <UPageCard variant="subtle" class="text-center">
            <p class="text-lg font-bold">
              {{ formatPercent(current.profitMargin ?? 0) }}
            </p>
            <p class="text-xs text-muted">
              Margem
            </p>
          </UPageCard>
        </div>

        <!-- vs previous period -->
        <UPageCard v-if="variations && Object.keys(variations).length" title="Variação vs. período anterior" variant="subtle">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div v-for="(val, key) in variations" :key="key" class="flex items-center gap-2">
              <UIcon :name="variationIcon(Number(val))" :class="variationColor(Number(val))" />
              <div>
                <p class="text-muted text-xs">
                  {{ key }}
                </p>
                <p :class="['font-medium', variationColor(Number(val))]">
                  {{ formatPercent(Number(val)) }}
                </p>
              </div>
            </div>
          </div>
        </UPageCard>

        <!-- Evolution table -->
        <UPageCard v-if="evolution.length" title="Evolução" variant="subtle">
          <UTable :columns="evolutionColumns" :data="evolution" class="min-h-0">
            <template #revenue-cell="{ row }">
              {{ formatCurrency(row.original.grossRevenue ?? row.original.revenue ?? 0) }}
            </template>
            <template #costs-cell="{ row }">
              {{ formatCurrency(row.original.totalCosts ?? row.original.costs ?? 0) }}
            </template>
            <template #profit-cell="{ row }">
              <span class="font-medium">{{ formatCurrency(row.original.netProfit ?? row.original.profit ?? 0) }}</span>
            </template>
            <template #margin-cell="{ row }">
              {{ formatPercent(row.original.profitMargin ?? row.original.margin ?? 0) }}
            </template>
          </UTable>
        </UPageCard>
      </div>
    </template>
    </UDashboardPanelst lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const dateFrom = ref(defaultFrom)
    const dateTo = ref(defaultTo)

    const { data, status } = await useAsyncData(
    () => `report-profit-${dateFrom.value}-${dateTo.value}`,
    () => requestFetch<{ data: any }>('/api/reports/costs-profit', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, includeProfitReport: 'true' },
    }),
    { watch: [dateFrom, dateTo] }
    )

    const profitReport = computed(() => data.value?.data?.profitReport ?? {})
    const current = computed(() => profitReport.value?.currentData ?? {})
    const previous = computed(() => profitReport.value?.previousData ?? {})
    const variations = computed(() => profitReport.value?.variations ?? {})
    const evolution = computed(() => profitReport.value?.evolutionData ?? [])

    function formatCurrency(v: number | string) {
    return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }
    function formatPercent(v: number) {
    return `${parseFloat(String(v || 0)).toFixed(1)}%`
    }
    function variationColor(v: number) {
    return v >= 0 ? 'text-green-600' : 'text-red-500'
    }
    function variationIcon(v: number) {
    return v >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
    }

    const evolutionColumns = [
    { accessorKey: 'label', header: 'Período' },
    { id: 'revenue', header: 'Receita' },
    { id: 'costs', header: 'Custos' },
    { id: 'profit', header: 'Lucro' },
    { id: 'margin', header: 'Margem' },
    ]
    </script>

    <template>
      <UDashboardPanel>
        <template #header>
          <UDashboardNavbar title="Relatório de Lucro">
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
            <!-- Current period KPIs -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <UPageCard variant="subtle" class="text-center">
                <p class="text-lg font-bold text-green-600">
                  {{ formatCurrency(current.grossRevenue ?? 0) }}
                </p>
                <p class="text-xs text-muted">
                  Receita bruta
                </p>
              </UPageCard>
              <UPageCard variant="subtle" class="text-center">
                <p class="text-lg font-bold text-red-500">
                  {{ formatCurrency(current.totalCosts ?? 0) }}
                </p>
                <p class="text-xs text-muted">
                  Custos
                </p>
              </UPageCard>
              <UPageCard variant="subtle" class="text-center">
                <p class="text-lg font-bold text-blue-600">
                  {{ formatCurrency(current.netProfit ?? 0) }}
                </p>
                <p class="text-xs text-muted">
                  Lucro líquido
                </p>
              </UPageCard>
              <UPageCard variant="subtle" class="text-center">
                <p class="text-lg font-bold">
                  {{ formatPercent(current.profitMargin ?? 0) }}
                </p>
                <p class="text-xs text-muted">
                  Margem
                </p>
              </UPageCard>
            </div>

            <!-- vs previous period -->
            <UPageCard v-if="variations && Object.keys(variations).length" title="Variação vs. período anterior" variant="subtle">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div v-for="(val, key) in variations" :key="key" class="flex items-center gap-2">
                  <UIcon :name="variationIcon(Number(val))" :class="variationColor(Number(val))" />
                  <div>
                    <p class="text-muted text-xs">
                      {{ key }}
                    </p>
                    <p :class="['font-medium', variationColor(Number(val))]">
                      {{ formatPercent(Number(val)) }}
                    </p>
                  </div>
                </div>
              </div>
            </UPageCard>

            <!-- Evolution table -->
            <UPageCard v-if="evolution.length" title="Evolução" variant="subtle">
              <UTable :columns="evolutionColumns" :data="evolution" class="min-h-0">
                <template #revenue-cell="{ row }">
                  {{ formatCurrency(row.original.grossRevenue ?? row.original.revenue ?? 0) }}
                </template>
                <template #costs-cell="{ row }">
                  {{ formatCurrency(row.original.totalCosts ?? row.original.costs ?? 0) }}
                </template>
                <template #profit-cell="{ row }">
                  <span class="font-medium">{{ formatCurrency(row.original.netProfit ?? row.original.profit ?? 0) }}</span>
                </template>
                <template #margin-cell="{ row }">
                  {{ formatPercent(row.original.profitMargin ?? row.original.margin ?? 0) }}
                </template>
              </UTable>
            </UPageCard>
          </div>
        </template>
      </UDashboardPanel>
    </template>
  </udashboardpanel>
</template>
