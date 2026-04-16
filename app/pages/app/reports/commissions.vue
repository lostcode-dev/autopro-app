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
      <!-- Summary cards -->
      <div v-if="summary" class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-default">
        <UPageCard variant="subtle" class="text-center">
          <p class="text-lg font-bold">
            {{ formatCurrency(summary.totalCommissions ?? 0) }}
          </p>
          <p class="text-xs text-muted">
            Total comissões
          </p>
        </UPageCard>
        <UPageCard variant="subtle" class="text-center">
          <p class="text-lg font-bold">
            {{ formatCurrency(summary.totalPaid ?? 0) }}
          </p>
          <p class="text-xs text-muted">
            Pago
          </p>
        </UPageCard>
        <UPageCard variant="subtle" class="text-center">
          <p class="text-lg font-bold">
            {{ formatCurrency(summary.totalPending ?? 0) }}
          </p>
          <p class="text-xs text-muted">
            Pendente
          </p>
        </UPageCard>
        <UPageCard variant="subtle" class="text-center">
          <p class="text-lg font-bold">
            {{ summary.employeeCount ?? 0 }}
          </p>
          <p class="text-xs text-muted">
            Funcionários
          </p>
        </UPageCard>
      </div>

      <div v-if="status === 'pending'" class="p-4 space-y-3">
        <USkeleton v-for="i in 8" :key="i" class="h-10 w-full" />
      </div>

      <UTable
        v-else
        :columns="columns"
        :data="items"
        class="min-h-0 flex-1"
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
      </UTable>

      <div v-if="pagination && pagination.totalPages > 1" class="flex justify-center p-4 border-t border-default">
        <UPagination v-model="page" :page-count="pageSize" :total="pagination.totalItems" />
      </div>
    </template>
  </UDashboardPanel>
</template>


