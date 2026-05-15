<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin']
})
useSeoMeta({ title: 'Fiscal — Logs' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const page = ref(1)
const pageSize = 50

const { data, status, refresh } = await useAsyncData(
  'admin-fiscal-logs',
  () => requestFetch<{ data: { logs: any[], page: number, pageSize: number, hasMore: boolean } }>(
    '/api/fiscal/integration-logs',
    {
      headers: requestHeaders,
      query: { page: page.value, pageSize }
    }
  )
)

watch(page, () => refresh())

const logs = computed(() => data.value?.data?.logs ?? [])
const hasMore = computed(() => data.value?.data?.hasMore ?? false)

// Synthetic total so AppDataTable can show/hide next page button
const total = computed(() => {
  const count = logs.value.length
  if (!count) return 0
  const currentEnd = (page.value - 1) * pageSize + count
  return hasMore.value ? currentEnd + 1 : currentEnd
})

const columns = [
  { accessorKey: 'created_at', header: 'Data/Hora', enableSorting: false },
  { accessorKey: 'function_name', header: 'Função', enableSorting: false },
  { accessorKey: 'status_code', header: 'Status', enableSorting: false },
  { accessorKey: 'auth_user_email', header: 'Usuário', enableSorting: false },
  { accessorKey: 'request_url', header: 'URL', enableSorting: false },
  { accessorKey: 'duration_ms', header: 'Duração (ms)', enableSorting: false }
]

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleString('pt-BR')
}

function statusColor(code: number | null) {
  if (!code) return 'neutral'
  if (code >= 500) return 'error'
  if (code >= 400) return 'warning'
  return 'success'
}
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar title="Logs de Integração Fiscal" />

    <AppDataTable
      v-model:page="page"
      :columns="columns"
      :data="logs as Record<string, unknown>[]"
      :loading="status === 'pending'"
      :page-size="pageSize"
      :total="total"
      empty-icon="i-lucide-scroll-text"
      empty-title="Nenhum log encontrado"
      empty-description="Os logs de integração fiscal aparecerão aqui."
    >
      <template #created_at-cell="{ row }">
        <span class="font-mono text-xs">{{ formatDate(String(row.original.created_at ?? '')) }}</span>
      </template>

      <template #status_code-cell="{ row }">
        <UBadge
          :color="statusColor(Number(row.original.status_code) || null)"
          variant="subtle"
          size="sm"
        >
          {{ row.original.status_code ?? '—' }}
        </UBadge>
      </template>

      <template #request_url-cell="{ row }">
        <span
          class="block max-w-64 truncate font-mono text-xs"
          :title="String(row.original.request_url ?? '')"
        >
          {{ row.original.request_url || '—' }}
        </span>
      </template>

      <template #duration_ms-cell="{ row }">
        {{ row.original.duration_ms != null ? `${row.original.duration_ms}ms` : '—' }}
      </template>
    </AppDataTable>
  </UDashboardPanel>
</template>
