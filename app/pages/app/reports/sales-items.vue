<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Itens Vendidos' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const now = new Date()
const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

const dateFrom = ref(defaultFrom)
const dateTo = ref(defaultTo)
const search = ref('')
const page = ref(1)
const pageSize = 20

const { data, status } = await useAsyncData(
  () => `report-sales-items-${dateFrom.value}-${dateTo.value}-${page.value}-${search.value}`,
  () => requestFetch<{ data: any }>('/api/reports/sales-items', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, searchTerm: search.value || undefined, page: page.value, pageSize }
  }),
  { watch: [dateFrom, dateTo, page, search] }
)

const items = computed(() => data.value?.data?.salesItemsReport?.table?.items ?? [])
const summary = computed(() => data.value?.data?.salesItemsReport?.summary ?? {})
const pagination = computed(() => data.value?.data?.salesItemsReport?.table?.pagination ?? null)

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const columns = [
  { accessorKey: 'name', header: 'Item' },
  { accessorKey: 'category', header: 'Categoria' },
  { accessorKey: 'quantity', header: 'Qtd.' },
  { id: 'revenue', header: 'Receita' },
  { id: 'cost', header: 'Custo' },
  { id: 'profit', header: 'Lucro' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Itens Vendidos">
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
            Total itens
          </p>
          <p class="font-bold">
            {{ summary.totalItems ?? summary.totalQuantity ?? 0 }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Receita total
          </p>
          <p class="font-bold">
            {{ formatCurrency(summary.totalRevenue ?? 0) }}
          </p>
        </div>
        <div>
          <p class="text-muted text-xs">
            Lucro total
          </p>
          <p class="font-bold text-blue-600">
            {{ formatCurrency(summary.totalProfit ?? 0) }}
          </p>
        </div>
      </div>

      <div class="p-4 border-b border-default">
        <UInput
          v-model="search"
          placeholder="Buscar item..."
          icon="i-lucide-search"
          class="w-72"
          @update:model-value="page = 1"
        />
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
        <template #revenue-cell="{ row }">
          {{ formatCurrency(row.original.totalRevenue ?? row.original.revenue ?? 0) }}
        </template>
        <template #cost-cell="{ row }">
          {{ formatCurrency(row.original.totalCost ?? row.original.cost ?? 0) }}
        </template>
        <template #profit-cell="{ row }">
          <span class="font-medium">{{ formatCurrency(row.original.totalProfit ?? row.original.profit ?? 0) }}</span>
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
    const search = ref('')
    const page = ref(1)
    const pageSize = 20

    const { data, status } = await useAsyncData(
    () => `report-sales-items-${dateFrom.value}-${dateTo.value}-${page.value}-${search.value}`,
    () => requestFetch<{ data: any }>('/api/reports/sales-items', {
    headers: requestHeaders,
    query: { dateFrom: dateFrom.value, dateTo: dateTo.value, searchTerm: search.value || undefined, page: page.value, pageSize },
    }),
    { watch: [dateFrom, dateTo, page, search] }
    )

    const items = computed(() => data.value?.data?.salesItemsReport?.table?.items ?? [])
    const summary = computed(() => data.value?.data?.salesItemsReport?.summary ?? {})
    const pagination = computed(() => data.value?.data?.salesItemsReport?.table?.pagination ?? null)

    function formatCurrency(v: number | string) {
    return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    const columns = [
    { accessorKey: 'name', header: 'Item' },
    { accessorKey: 'category', header: 'Categoria' },
    { accessorKey: 'quantity', header: 'Qtd.' },
    { id: 'revenue', header: 'Receita' },
    { id: 'cost', header: 'Custo' },
    { id: 'profit', header: 'Lucro' },
    ]
    </script>

    <template>
      <UDashboardPanel>
        <template #header>
          <UDashboardNavbar title="Itens Vendidos">
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
                Total itens
              </p>
              <p class="font-bold">
                {{ summary.totalItems ?? summary.totalQuantity ?? 0 }}
              </p>
            </div>
            <div>
              <p class="text-muted text-xs">
                Receita total
              </p>
              <p class="font-bold">
                {{ formatCurrency(summary.totalRevenue ?? 0) }}
              </p>
            </div>
            <div>
              <p class="text-muted text-xs">
                Lucro total
              </p>
              <p class="font-bold text-blue-600">
                {{ formatCurrency(summary.totalProfit ?? 0) }}
              </p>
            </div>
          </div>

          <div class="p-4 border-b border-default">
            <UInput
              v-model="search"
              placeholder="Buscar item..."
              icon="i-lucide-search"
              class="w-72"
              @update:model-value="page = 1"
            />
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
            <template #revenue-cell="{ row }">
              {{ formatCurrency(row.original.totalRevenue ?? row.original.revenue ?? 0) }}
            </template>
            <template #cost-cell="{ row }">
              {{ formatCurrency(row.original.totalCost ?? row.original.cost ?? 0) }}
            </template>
            <template #profit-cell="{ row }">
              <span class="font-medium">{{ formatCurrency(row.original.totalProfit ?? row.original.profit ?? 0) }}</span>
            </template>
          </UTable>

          <div v-if="pagination && pagination.totalPages > 1" class="flex justify-center p-4 border-t border-default">
            <UPagination v-model="page" :page-count="pageSize" :total="pagination.totalItems" />
          </div>
        </template>
      </UDashboardPanel>
    </template>
  </udashboardpanel>
</template>
