<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['workshop-admin'],
})
useSeoMeta({ title: 'Organizações — Admin' })

const toast = useToast()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const search = ref('')
const page = ref(1)
const pageSize = 30

const { data, status, refresh } = await useAsyncData(
  'admin-organizations',
  () => requestFetch<{ items: any[]; total: number; page: number; page_size: number }>(
    '/api/admin/organizations',
    {
      headers: requestHeaders,
      query: {
        search: search.value || undefined,
        page: page.value,
        page_size: pageSize,
      },
    }
  )
)

watch([search], () => {
  page.value = 1
  refresh()
})
watch(page, () => refresh())

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)

const columns = [
  { key: 'name', label: 'Razão Social' },
  { key: 'trade_name', label: 'Nome Fantasia' },
  { key: 'tax_id', label: 'CNPJ/CPF' },
  { key: 'email', label: 'E-mail' },
  { key: 'user_count', label: 'Usuários' },
  { key: 'is_active', label: 'Status' },
  { key: 'created_at', label: 'Criado em' },
]

function formatDate(val: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('pt-BR')
}
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar title="Organizações">
      <template #right>
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Buscar por nome, fantasia ou CNPJ..."
          class="w-72"
        />
      </template>
    </UDashboardNavbar>

    <div class="p-6 space-y-4">
      <div v-if="status === 'pending'" class="space-y-2">
        <USkeleton v-for="i in 8" :key="i" class="h-10 rounded" />
      </div>

      <template v-else>
        <UTable :rows="items" :columns="columns">
          <template #is_active-data="{ row }">
            <UBadge
              :color="row.is_active ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{ row.is_active ? 'Ativa' : 'Inativa' }}
            </UBadge>
          </template>

          <template #user_count-data="{ row }">
            <span class="font-medium">{{ row.user_count }}</span>
          </template>

          <template #created_at-data="{ row }">
            {{ formatDate(row.created_at) }}
          </template>

          <template #tax_id-data="{ row }">
            <span class="font-mono text-sm">{{ row.tax_id || '—' }}</span>
          </template>
        </UTable>

        <div v-if="total > pageSize" class="flex justify-center pt-4">
          <UPagination
            v-model:page="page"
            :total="total"
            :page-size="pageSize"
          />
        </div>

        <p v-if="total === 0" class="text-center text-sm text-muted py-8">
          Nenhuma organização encontrada.
        </p>
      </template>
    </div>
  </UDashboardPanel>
</template>
