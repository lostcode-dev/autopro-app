<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Relatório de Comissões' })

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
  () => `report-commissions-${dateFrom.value}-${dateTo.value}-${page.value}`,
  () => requestFetch<{ data: any }>('/api/reports/commissions', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, page: page.value, pageSize }
  }),
  { watch: [dateFrom, dateTo, page] }
)

const items = computed(() => data.value?.data?.items ?? [])
const summary = computed(() => data.value?.data?.summary ?? {})
const pagination = computed(() => data.value?.data?.pagination ?? null)

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function formatDate(v: string) {
  if (!v) return '—'
  const [y, m, d] = v.split('-')
  return `${d}/${m}/${y}`
}

const statusColorMap: Record<string, string> = { pending: 'warning', paid: 'success', cancelled: 'error' }
const statusLabelMap: Record<string, string> = { pending: 'Pendente', paid: 'Pago', cancelled: 'Cancelado' }

const columns = [
  { accessorKey: 'employee_name', header: 'Funcionário' },
  { accessorKey: 'order_number', header: 'OS' },
  { accessorKey: 'order_entry_date', header: 'Data OS' },
  { id: 'amount', header: 'Comissão' },
  { id: 'order_total', header: 'Total OS' },
  { id: 'status_col', header: 'Status' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Relatório de Comissões">
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
      </AppPageHeader>
    </template>

    <template #body>
      <div class="space-y-4">
      <!-- Summary cards -->
      <div class="grid grid-cols-2 gap-3 p-4 pb-0 sm:grid-cols-4">
        <UCard
          v-for="stat in [
            { label: 'Total comissões', value: formatCurrency(summary.totalCommissions ?? 0), icon: 'i-lucide-badge-percent', color: 'text-primary', description: 'no período' },
            { label: 'Pago', value: formatCurrency(summary.totalPaid ?? 0), icon: 'i-lucide-circle-check', color: 'text-success', description: 'já quitado' },
            { label: 'Pendente', value: formatCurrency(summary.totalPending ?? 0), icon: 'i-lucide-clock', color: 'text-warning', description: 'a receber' },
            { label: 'Funcionários', value: summary.employeeCount ?? 0, icon: 'i-lucide-users', color: 'text-info', description: 'com comissão' },
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

      <div class="p-4">
        <AppDataTable
          :columns="columns"
          :data="items"
          :loading="status === 'pending'"
          v-model:page="page"
          :page-size="pageSize"
          :total="pagination?.totalItems ?? items.length"
          :show-page-size-selector="false"
          empty-icon="i-lucide-badge-percent"
          empty-title="Nenhuma comissão encontrada"
          empty-description="Não há comissões registradas para o período selecionado."
        >
          <template #order_entry_date-cell="{ row }">
            {{ formatDate(row.original.order_entry_date) }}
          </template>
          <template #amount-cell="{ row }">
            <span class="font-medium">{{ formatCurrency(row.original.amount) }}</span>
          </template>
          <template #order_total-cell="{ row }">
            {{ formatCurrency(row.original.order_total_amount) }}
          </template>
          <template #status_col-cell="{ row }">
            <UBadge
              :color="statusColorMap[row.original.status] ?? 'neutral'"
              variant="subtle"
              :label="statusLabelMap[row.original.status] ?? row.original.status"
              size="sm"
            />
          </template>
        </AppDataTable>
      </div>
      </div>
    </template>
  </UDashboardPanel>
</template>


