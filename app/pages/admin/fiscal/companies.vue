<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin']
})
useSeoMeta({ title: 'Fiscal — Empresas' })

const toast = useToast()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const search = ref('')
const skip = ref(0)
const stop = 50

const { data, status, refresh } = await useAsyncData(
  'admin-fiscal-companies',
  () => requestFetch<{ success: boolean, data: Record<string, any> }>(
    '/api/fiscal/company/list',
    {
      headers: requestHeaders,
      query: {
        stop,
        skip: skip.value,
        nome_razao_social: search.value || undefined
      }
    }
  )
)

watch(search, () => {
  skip.value = 0
  refresh()
})
watch(skip, () => refresh())

const companies = computed<any[]>(() => {
  const d = data.value?.data
  if (!d) return []
  if (Array.isArray(d['@value'])) return d['@value']
  if (Array.isArray(d.data)) return d.data
  return []
})
const totalCount = computed(() => data.value?.data?.['@count'] ?? companies.value.length)
const hasMore = computed(() => skip.value + stop < totalCount.value)
const hasPrev = computed(() => skip.value > 0)

const columns = [
  { key: 'cpf_cnpj', label: 'CNPJ/CPF' },
  { key: 'nome_razao_social', label: 'Razão Social' },
  { key: 'nome_fantasia', label: 'Nome Fantasia' },
  { key: 'email', label: 'E-mail' },
  { key: 'ambiente', label: 'Ambiente' }
]

function nextPage() {
  skip.value += stop
}
function prevPage() {
  skip.value = Math.max(0, skip.value - stop)
}
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar title="Empresas NuvemFiscal">
      <template #right>
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Buscar por razão social..."
          class="w-72"
        />
      </template>
    </UDashboardNavbar>

    <div class="p-6 space-y-4">
      <div v-if="status === 'pending'" class="space-y-2">
        <USkeleton v-for="i in 6" :key="i" class="h-10 rounded" />
      </div>

      <template v-else>
        <UTable :rows="companies" :columns="columns">
          <template #cpf_cnpj-data="{ row }">
            <span class="font-mono text-sm">{{ row.cpf_cnpj || '—' }}</span>
          </template>

          <template #ambiente-data="{ row }">
            <UBadge
              :color="row.ambiente === 'producao' ? 'success' : 'warning'"
              variant="subtle"
              size="sm"
            >
              {{ row.ambiente === 'producao' ? 'Produção' : 'Homologação' }}
            </UBadge>
          </template>
        </UTable>

        <p v-if="companies.length === 0" class="text-center text-sm text-muted py-8">
          Nenhuma empresa encontrada.
        </p>

        <div v-if="hasPrev || hasMore" class="flex justify-between items-center pt-2">
          <UButton
            variant="ghost"
            icon="i-lucide-chevron-left"
            :disabled="!hasPrev"
            @click="prevPage"
          >
            Anterior
          </UButton>
          <span class="text-sm text-muted">
            {{ skip + 1 }}–{{ Math.min(skip + stop, totalCount) }} de {{ totalCount }}
          </span>
          <UButton
            variant="ghost"
            trailing-icon="i-lucide-chevron-right"
            :disabled="!hasMore"
            @click="nextPage"
          >
            Próxima
          </UButton>
        </div>
      </template>
    </div>
  </UDashboardPanel>
</template>
