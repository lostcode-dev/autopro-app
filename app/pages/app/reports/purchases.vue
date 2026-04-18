<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Compras' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

const dateFrom = ref(defaultFrom)
const dateTo = ref(defaultTo)
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

const payStatusColor: Record<string, string> = { pending: 'warning', paid: 'success' }
const payStatusLabel: Record<string, string> = { pending: 'Pendente', paid: 'Pago' }

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
      <AppPageHeader title="Relatório de Compras">
        <template #right>
          <div class="flex items-center gap-2">
            <UInput v-model="dateFrom" type="date" size="sm" class="w-36" />
            <span class="text-muted text-sm">até</span>
            <UInput v-model="dateTo" type="date" size="sm" class="w-36" />
          </div>
        </template>
      </AppPageHeader>
    </template>

    <template #body>
      <!-- Summary bar -->
      <div class="grid grid-cols-3 divide-x divide-default border-b border-default text-center text-sm py-3">
        <div>
          <p class="text-muted text-xs">
            Total comprado
          </p>
          <p class="font-bold">
            {{ formatCurrency(summary.totalPurchased ?? 0) }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Total pago
          </p>
          <p class="font-bold text-green-600">
            {{ formatCurrency(summary.totalPaid ?? 0) }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Pendente
          </p>
          <p class="font-bold text-yellow-500">
            {{ formatCurrency(summary.totalPending ?? 0) }}
          </p>
        </div>
      </div>

      <div class="p-4 space-y-4">
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
              :color="payStatusColor[row.original.payment_status ?? row.original.paymentStatus] ?? 'neutral'"
              variant="subtle"
              :label="payStatusLabel[row.original.payment_status ?? row.original.paymentStatus] ?? (row.original.payment_status ?? '—')"
              size="sm"
            />
          </template>
        </AppDataTable>
      </div>
    </template>
  </UDashboardPanel>
</template>
