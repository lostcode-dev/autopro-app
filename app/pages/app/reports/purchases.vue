<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Compras' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { dateFrom, dateTo } = useReportDateRange()
const page = ref(1)
const pageSize = 20

const { data, status } = await useAsyncData(
  () => `report-purchases-${dateFrom.value}-${dateTo.value}-${page.value}`,
  () => requestFetch<{ data: any }>('/api/reports/purchases', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, page: page.value, pageSize }
  }),
  { watch: [dateFrom, dateTo, page] }
)

const items = computed(() => data.value?.data?.items ?? [])
const summary = computed(() => data.value?.data?.summary ?? {})
const pagination = computed(() => data.value?.data?.pagination ?? null)

const chartData = computed(() => {
  const byDate: Record<string, number> = {}
  for (const item of items.value) {
    const date = String(item.purchase_date ?? '')
    if (!date) continue
    byDate[date] = (byDate[date] ?? 0) + Number(item.total_amount ?? 0)
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => {
      const [, m, d] = date.split('-')
      return { name: `${d}/${m}`, amount }
    })
})

const chartBars = [{ key: 'amount', label: 'Total comprado', color: '#a78bfa' }]

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDate(v: string) {
  if (!v) return '—'
  const [y, m, d] = v.split('-')
  return `${d}/${m}/${y}`
}

const payStatusColor: Record<string, string> = { pending: 'warning', paid: 'success', overdue: 'error' }
const payStatusLabel: Record<string, string> = { pending: 'Pendente', paid: 'Pago', overdue: 'Vencido' }

const columns = [
  { id: 'supplier', header: 'Fornecedor' },
  { accessorKey: 'purchase_date', header: 'Data' },
  { id: 'total_amount', header: 'Total' },
  { id: 'pay_status', header: 'Status' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Relatório de Compras" />
    </template>

    <template #body>
      <div class="space-y-4 p-4">
        <!-- Filter card -->
        <UCard :ui="{ body: 'p-3' }">
          <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
            <div class="flex items-center gap-2 shrink-0 text-muted">
              <UIcon name="i-lucide-filter" class="size-4" />
              <span class="text-sm font-medium">Filtros</span>
            </div>
            <UiDateRangePicker v-model:from="dateFrom" v-model:to="dateTo" class="w-full sm:w-72" />
          </div>
        </UCard>
        <!-- Summary cards -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <UCard
          v-for="stat in [
            { label: 'Total comprado', value: formatCurrency(summary.totalPurchased ?? 0), icon: 'i-lucide-shopping-cart', color: 'text-primary', description: 'no período' },
            { label: 'Total pago', value: formatCurrency(summary.totalPaid ?? 0), icon: 'i-lucide-circle-check', color: 'text-success', description: 'já quitado' },
            { label: 'Pendente', value: formatCurrency(summary.totalPending ?? 0), icon: 'i-lucide-clock', color: 'text-warning', description: 'a pagar' },
          ]"
          :key="stat.label"
          :ui="{ body: 'p-3 sm:p-4' }"
        >
          <div class="flex items-start gap-3">
            <UIcon :name="stat.icon" :class="stat.color" class="mt-0.5 size-5 shrink-0" />
            <div>
              <p class="text-lg font-bold leading-tight">
                {{ stat.value }}
              </p>
              <p class="text-xs font-medium text-highlighted">
                {{ stat.label }}
              </p>
              <p class="text-xs text-muted">
                {{ stat.description }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
        <!-- Chart -->
        <UPageCard v-if="chartData.length" variant="subtle">
          <template #header>
            <p class="text-sm font-semibold">
              Compras por dia
            </p>
          </template>
          <AppBarChart
            :data="chartData"
            :bars="chartBars"
            :height="200"
            :format-value="formatCurrency"
          />
        </UPageCard>

        <AppDataTable
          :columns="columns"
          :data="items"
          :loading="status === 'pending'"
          v-model:page="page"
          :page-size="pageSize"
          :total="pagination?.totalItems ?? items.length"
          :show-page-size-selector="false"
          empty-icon="i-lucide-shopping-cart"
          empty-title="Nenhuma compra encontrada"
          empty-description="Não há compras registradas para o período selecionado."
        >
          <template #supplier-cell="{ row }">
            {{ row.original.suppliers?.name ?? row.original.supplierName ?? row.original.supplier_name ?? '—' }}
          </template>
          <template #purchase_date-cell="{ row }">
            {{ formatDate(row.original.purchase_date) }}
          </template>
          <template #total_amount-cell="{ row }">
            <span class="font-medium">{{ formatCurrency(row.original.total_amount) }}</span>
          </template>
          <template #pay_status-cell="{ row }">
            <UBadge
              :color="payStatusColor[row.original.paymentStatus ?? row.original.payment_status] ?? 'neutral'"
              variant="subtle"
              :label="payStatusLabel[row.original.paymentStatus ?? row.original.payment_status] ?? (row.original.paymentStatus ?? row.original.payment_status ?? '—')"
              size="sm"
            />
          </template>
        </AppDataTable>
      </div>
    </template>
  </UDashboardPanel>
</template>
