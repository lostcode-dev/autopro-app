<script setup lang="ts">
definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'NFS-e — Notas de Serviço' })

const toast = useToast()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const search = ref('')
const page = ref(1)
const pageSize = 30

/**
 * NOTE: The org-scoped NFS-e listing endpoint is not yet implemented.
 * The current /api/fiscal/invoice/* endpoints are restricted to the global
 * NUVEM_FISCAL_OWNER_EMAIL and are not org-scoped.
 * This page will show the blocker state until the org-scoped backend is ready.
 */
const backendReady = false

const { data, status, refresh } = await useAsyncData(
  'fiscal-service-invoices',
  async () => {
    if (!backendReady) return { items: [], total: 0 }
    return requestFetch<{ items: any[]; total: number }>(
      '/api/fiscal/service-invoices',
      {
        headers: requestHeaders,
        query: {
          search: search.value || undefined,
          page: page.value,
          page_size: pageSize,
        },
      }
    )
  }
)

watch([search], () => { page.value = 1; refresh() })
watch(page, () => refresh())

const invoices = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)

const columns = [
  { key: 'numero', label: 'Número' },
  { key: 'data_emissao', label: 'Emissão' },
  { key: 'tomador_nome', label: 'Tomador' },
  { key: 'valor_servicos', label: 'Valor' },
  { key: 'status', label: 'Status' },
]

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('pt-BR')
}

function formatCurrency(val: number | null) {
  if (val == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Notas Fiscais de Serviço (NFS-e)</h1>
        <p class="text-sm text-muted">Emissão e gestão de notas fiscais eletrônicas de serviço.</p>
      </div>
    </div>

    <!-- Backend blocker notice -->
    <UPageCard
      v-if="!backendReady"
      title="Integração fiscal de serviço em implementação"
      description="A emissão e consulta de NFS-e por organização ainda está em desenvolvimento. Esta funcionalidade estará disponível em breve."
    >
      <template #leading>
        <UIcon name="i-lucide-construction" class="size-5 text-warning" />
      </template>
      <template #footer>
        <p class="text-xs text-muted">
          Status: backend org-scoped para NFS-e pendente. Os endpoints atuais são restritos ao administrador global.
        </p>
      </template>
    </UPageCard>

    <!-- Future: invoice table (rendered once backend is ready) -->
    <template v-if="backendReady">
      <div class="flex gap-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Buscar notas..."
          class="max-w-xs"
        />
      </div>

      <div v-if="status === 'pending'" class="space-y-2">
        <USkeleton v-for="i in 6" :key="i" class="h-10 rounded" />
      </div>

      <UTable v-else :rows="invoices" :columns="columns">
        <template #data_emissao-data="{ row }">
          {{ formatDate(row.data_emissao) }}
        </template>
        <template #valor_servicos-data="{ row }">
          {{ formatCurrency(row.valor_servicos) }}
        </template>
        <template #status-data="{ row }">
          <UBadge
            :color="row.status === 'autorizado' ? 'success' : row.status === 'cancelado' ? 'error' : 'neutral'"
            variant="subtle"
            size="sm"
          >
            {{ row.status }}
          </UBadge>
        </template>
      </UTable>

      <div v-if="total > pageSize" class="flex justify-center pt-4">
        <UPagination v-model:page="page" :total="total" :page-size="pageSize" />
      </div>
    </template>
  </div>
</template>
