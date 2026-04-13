<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin'],
})
useSeoMeta({ title: 'Fiscal — Logs' })

const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const page = ref(1)
const pageSize = 50

const { data, status, refresh } = await useAsyncData(
  'admin-fiscal-logs',
  () => requestFetch<{ data: { logs: any[]; page: number; pageSize: number; hasMore: boolean } }>(
    '/api/fiscal/integration-logs',
    {
      headers: requestHeaders,
      query: { page: page.value, pageSize },
    }
  )
)

watch(page, () => refresh())

const logs = computed(() => data.value?.data?.logs ?? [])
const hasMore = computed(() => data.value?.data?.hasMore ?? false)
const hasPrev = computed(() => page.value > 1)

const columns = [
  { key: 'created_at', label: 'Data/Hora' },
  { key: 'function_name', label: 'Função' },
  { key: 'status_code', label: 'Status' },
  { key: 'auth_user_email', label: 'Usuário' },
  { key: 'request_url', label: 'URL' },
  { key: 'duration_ms', label: 'Duração (ms)' },
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

    <div class="p-6 space-y-4">
      <div v-if="status === 'pending'" class="space-y-2">
        <USkeleton v-for="i in 8" :key="i" class="h-10 rounded" />
      </div>

      <template v-else>
        <UTable :rows="logs" :columns="columns">
          <template #created_at-data="{ row }">
            <span class="text-xs font-mono">{{ formatDate(row.created_at) }}</span>
          </template>

          <template #status_code-data="{ row }">
            <UBadge
              :color="statusColor(row.status_code)"
              variant="subtle"
              size="sm"
            >
              {{ row.status_code ?? '—' }}
            </UBadge>
          </template>

          <template #request_url-data="{ row }">
            <span class="text-xs font-mono truncate max-w-64 block" :title="row.request_url">
              {{ row.request_url || '—' }}
            </span>
          </template>

          <template #duration_ms-data="{ row }">
            {{ row.duration_ms != null ? `${row.duration_ms}ms` : '—' }}
          </template>
        </UTable>

        <p v-if="logs.length === 0" class="text-center text-sm text-muted py-8">
          Nenhum log encontrado.
        </p>

        <div v-if="hasPrev || hasMore" class="flex justify-between items-center pt-2">
          <UButton
            variant="ghost"
            icon="i-lucide-chevron-left"
            :disabled="!hasPrev"
            @click="page--"
          >
            Anterior
          </UButton>
          <span class="text-sm text-muted">Página {{ page }}</span>
          <UButton
            variant="ghost"
            trailing-icon="i-lucide-chevron-right"
            :disabled="!hasMore"
            @click="page++"
          >
            Próxima
          </UButton>
        </div>
      </template>
    </div>
  </UDashboardPanel>
</template>
