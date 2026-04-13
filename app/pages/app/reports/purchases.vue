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
      <UDashboardNavbar title="Relatório de Compras">
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

      <div v-if="status === 'pending'" class="p-4 space-y-3">
        <USkeleton v-for="i in 8" :key="i" class="h-10 w-full" />
      </div>

      <UTable
        v-else
        :columns="columns"
        :data="items"
        class="min-h-0 flex-1"
      >
        <template #supplier-cell="{ row }">
          {{ row.original.suppliers?.name ?? row.original.supplier_name ?? '—' }}
        </template>
        <template #purchase_date-cell="{ row }">
          {{ formatDate(row.original.purchase_date) }}
        </template>
        <template #total_amount-cell="{ row }">
          <span class="font-medium">{{ formatCurrency(row.original.total_amount) }}</span>
        </template>
        <template #pay_status-cell="{ row }">
          <UBadge
            :color="payStatusColor[row.original.payment_status] ?? 'neutral'"
            variant="subtle"
            :label="payStatusLabel[row.original.payment_status] ?? row.original.payment_status"
            size="sm"
          />
        </template>
      </UTable>

      <div v-if="pagination && pagination.totalPages > 1" class="flex justify-center p-4 border-t border-default">
        <UPagination v-model="page" :page-count="pageSize" :total="pagination.totalItems" />
      </div>
    </template>
    </UDashboardPanelst lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const dateFrom = ref(defaultFrom)
    const dateTo = ref(defaultTo)
    const page = ref(1)
    const pageSize = 20

    const { data, status } = await useAsyncData(
    () => `report-purchases-${dateFrom.value}-${dateTo.value}-${page.value}`,
    () => requestFetch<{ data: any }>('/api/reports/purchases', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, page: page.value, pageSize },
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

    const payStatusColor: Record<string, string>
      = { pending: 'warning', paid: 'success' }
      const payStatusLabel: Record<string, string>
        = { pending: 'Pendente', paid: 'Pago' }

        const columns = [
        { id: 'supplier', header: 'Fornecedor' },
        { accessorKey: 'purchase_date', header: 'Data' },
        { id: 'total_amount', header: 'Total' },
        { id: 'pay_status', header: 'Status' },
        ]
        </script>

        <template>
          <UDashboardPanel>
            <template #header>
              <UDashboardNavbar title="Relatório de Compras">
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

              <div v-if="status === 'pending'" class="p-4 space-y-3">
                <USkeleton v-for="i in 8" :key="i" class="h-10 w-full" />
              </div>

              <UTable
                v-else
                :columns="columns"
                :data="items"
                class="min-h-0 flex-1"
              >
                <template #supplier-cell="{ row }">
                  {{ row.original.suppliers?.name ?? row.original.supplier_name ?? '—' }}
                </template>
                <template #purchase_date-cell="{ row }">
                  {{ formatDate(row.original.purchase_date) }}
                </template>
                <template #total_amount-cell="{ row }">
                  <span class="font-medium">{{ formatCurrency(row.original.total_amount) }}</span>
                </template>
                <template #pay_status-cell="{ row }">
                  <UBadge
                    :color="payStatusColor[row.original.payment_status] ?? 'neutral'"
                    variant="subtle"
                    :label="payStatusLabel[row.original.payment_status] ?? row.original.payment_status"
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
      </string,>
    </string,>
  </udashboardpanel>
</template>
