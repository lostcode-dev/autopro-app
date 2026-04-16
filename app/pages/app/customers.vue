<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { SortingState } from '@tanstack/vue-table'
import { ActionCode } from '~/constants/action-codes'
import type { Client, PersonType } from '~/types/clients'

function formatTaxId(taxId: string | null, personType: PersonType): string {
  if (!taxId)
    return '-'
  const digits = taxId.replace(/\D/g, '')
  if (personType === 'pf' && digits.length === 11)
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (personType === 'pj' && digits.length === 14)
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return taxId
}

function formatPhone(phone: string | null): string {
  if (!phone)
    return '-'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10)
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  if (digits.length === 11)
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  return phone
}

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Clientes' })

type ViewMode = 'table' | 'card'
const ALL_PERSON_TYPES_VALUE = 'all'

type ClientsResponse = {
  items: Client[]
  total: number
  page: number
  page_size: number
}

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const MANAGED_QUERY_KEYS = ['search', 'personType', 'page', 'pageSize', 'view', 'sortBy', 'sortOrder'] as const

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const route = useRoute()
const router = useRouter()

const canRead = computed(() => workshop.can(ActionCode.CUSTOMERS_READ))
const canCreate = computed(() => workshop.can(ActionCode.CUSTOMERS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.CUSTOMERS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.CUSTOMERS_DELETE))

function parsePage(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
}

function parsePageSize(value: unknown) {
  const parsed = Number(value)
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE
}

function parseView(value: unknown): ViewMode {
  return value === 'card' ? 'card' : 'table'
}

function parsePersonType(value: unknown): PersonType | typeof ALL_PERSON_TYPES_VALUE {
  return value === 'pf' || value === 'pj' ? value : ALL_PERSON_TYPES_VALUE
}

const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const personTypeFilter = ref<PersonType | typeof ALL_PERSON_TYPES_VALUE>(parsePersonType(route.query.personType))
const page = ref(parsePage(route.query.page))
const pageSize = ref(parsePageSize(route.query.pageSize))
const viewMode = ref<ViewMode>(parseView(route.query.view))

const sorting = ref<SortingState>(
  typeof route.query.sortBy === 'string' && route.query.sortBy
    ? [{ id: route.query.sortBy, desc: route.query.sortOrder === 'desc' }]
    : []
)

const requestQuery = computed(() => ({
  search: search.value || undefined,
  person_type: personTypeFilter.value !== ALL_PERSON_TYPES_VALUE ? personTypeFilter.value : undefined,
  page: page.value,
  page_size: pageSize.value,
  sort_by: sorting.value[0]?.id || undefined,
  sort_order: sorting.value[0] ? (sorting.value[0].desc ? 'desc' : 'asc') : undefined
}))

const { data, status, refresh } = await useAsyncData(
  () => `clients-${search.value}-${personTypeFilter.value}-${page.value}-${pageSize.value}-${sorting.value[0]?.id}-${sorting.value[0]?.desc}`,
  async () => {
    if (!canRead.value) {
      return {
        items: [],
        total: 0,
        page: 1,
        page_size: pageSize.value
      } satisfies ClientsResponse
    }

    return requestFetch<ClientsResponse>('/api/clients', {
      headers: requestHeaders,
      query: requestQuery.value
    })
  },
  {
    watch: [requestQuery],
    default: () => ({
      items: [],
      total: 0,
      page: 1,
      page_size: pageSize.value
    })
  }
)

const clientItems = computed(() => data.value?.items ?? [])
const totalClients = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalClients.value / pageSize.value)))

function buildManagedQuery() {
  return {
    search: search.value || undefined,
    personType: personTypeFilter.value !== ALL_PERSON_TYPES_VALUE ? personTypeFilter.value : undefined,
    page: page.value > 1 ? String(page.value) : undefined,
    pageSize: pageSize.value !== DEFAULT_PAGE_SIZE ? String(pageSize.value) : undefined,
    view: viewMode.value !== 'table' ? viewMode.value : undefined,
    sortBy: sorting.value[0]?.id || undefined,
    sortOrder: sorting.value[0]?.desc ? 'desc' : undefined
  }
}

async function syncQuery() {
  const nextQuery = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => !MANAGED_QUERY_KEYS.includes(key as typeof MANAGED_QUERY_KEYS[number]))
  ) as Record<string, string | string[] | undefined>

  Object.assign(nextQuery, buildManagedQuery())

  const currentSerialized = JSON.stringify(route.query)
  const nextSerialized = JSON.stringify(nextQuery)
  if (currentSerialized === nextSerialized)
    return

  await router.replace({ query: nextQuery })
}

watch(() => route.query, (query) => {
  const nextSearch = typeof query.search === 'string' ? query.search : ''
  const nextPersonType = parsePersonType(query.personType)
  const nextPage = parsePage(query.page)
  const nextPageSize = parsePageSize(query.pageSize)
  const nextView = parseView(query.view)

  if (search.value !== nextSearch)
    search.value = nextSearch
  if (personTypeFilter.value !== nextPersonType)
    personTypeFilter.value = nextPersonType
  if (page.value !== nextPage)
    page.value = nextPage
  if (pageSize.value !== nextPageSize)
    pageSize.value = nextPageSize
  if (viewMode.value !== nextView)
    viewMode.value = nextView

  const nextSortBy = typeof query.sortBy === 'string' ? query.sortBy : ''
  const nextSortDesc = query.sortOrder === 'desc'
  const currentSort = sorting.value[0]
  if (nextSortBy) {
    if (!currentSort || currentSort.id !== nextSortBy || currentSort.desc !== nextSortDesc)
      sorting.value = [{ id: nextSortBy, desc: nextSortDesc }]
  } else if (currentSort) {
    sorting.value = []
  }
})

watchDebounced(search, async () => {
  page.value = 1
  await syncQuery()
}, { debounce: 300, maxWait: 800 })

watch(personTypeFilter, async () => {
  page.value = 1
  await syncQuery()
})

watch(page, async () => {
  if (page.value > totalPages.value && totalPages.value > 0)
    page.value = totalPages.value

  await syncQuery()
})

watch(pageSize, async () => {
  page.value = 1
  await syncQuery()
})

watch(viewMode, syncQuery)

watch(sorting, async () => {
  page.value = 1
  await syncQuery()
})

function getClientInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'C'
}

function getPersonTypeLabel(personType: PersonType) {
  return personType === 'pf' ? 'PF' : 'PJ'
}

function formatContact(client: Client): string {
  const raw = client.phone || client.mobile_phone
  return raw ? formatPhone(raw) : 'Telefone nao informado'
}

// Modal
const showModal = ref(false)
const selectedClient = ref<Client | null>(null)
const isDeleting = ref(false)
const showDeleteModal = ref(false)
const clientPendingDeletion = ref<Client | null>(null)

function openCreate() {
  selectedClient.value = null
  showModal.value = true
}

function openEdit(client: Client) {
  selectedClient.value = client
  showModal.value = true
}

function requestRemove(client: Client) {
  if (isDeleting.value)
    return

  clientPendingDeletion.value = client
  showDeleteModal.value = true
}

function closeDeleteModal() {
  if (isDeleting.value)
    return

  showDeleteModal.value = false
  clientPendingDeletion.value = null
}

async function remove(client: Client) {
  if (isDeleting.value)
    return

  isDeleting.value = true
  try {
    await $fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    toast.add({ title: 'Cliente removido', color: 'success' })
    showDeleteModal.value = false
    clientPendingDeletion.value = null

    if (clientItems.value.length === 1 && page.value > 1)
      page.value -= 1

    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Nao foi possivel remover.',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

async function confirmRemove() {
  if (!clientPendingDeletion.value)
    return

  await remove(clientPendingDeletion.value)
}

const personTypeFilterOptions = [
  { label: 'Todos os tipos', value: ALL_PERSON_TYPES_VALUE },
  { label: 'Pessoa Fisica', value: 'pf' },
  { label: 'Pessoa Juridica', value: 'pj' }
]

const lineColumns = [
  { accessorKey: 'name', header: 'Cliente', enableSorting: true },
  { accessorKey: 'person_type', header: 'Tipo', enableSorting: true },
  { accessorKey: 'tax_id', header: 'CPF/CNPJ', enableSorting: true },
  { accessorKey: 'phone', header: 'Telefone', enableSorting: false },
  { id: 'actions', header: 'Acoes', enableSorting: false }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Clientes">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Novo cliente"
            icon="i-lucide-plus"
            color="neutral"
            @click="openCreate"
          />
        </template>
      </AppPageHeader>
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">
          Voce nao tem permissao para visualizar clientes.
        </p>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="flex min-h-0 flex-1 flex-col p-4">
          <AppDataTable
            v-model:display-mode="viewMode"
            v-model:search-term="search"
            v-model:page="page"
            v-model:page-size="pageSize"
            v-model:sorting="sorting"
            :columns="lineColumns"
            :data="clientItems"
            :loading-variant="viewMode === 'card' ? 'card' : 'row'"
            :selectable="viewMode === 'table'"
            :sticky-header="viewMode === 'table'"
            :get-row-id="row => String(row.id ?? '')"
            :loading="status === 'pending'"
            :page-size-options="PAGE_SIZE_OPTIONS"
            :total="totalClients"
            search-placeholder="Buscar por nome, e-mail ou CPF/CNPJ..."
            :show-search="true"
            :show-view-mode-toggle="true"
            card-grid-class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2"
            empty-icon="i-lucide-users"
            empty-title="Nenhum cliente encontrado"
            empty-description="Cadastre um cliente ou ajuste os filtros para continuar."
          >
            <template #filters>
              <USelectMenu
                v-model="personTypeFilter"
                :items="personTypeFilterOptions"
                value-key="value"
                class="w-full sm:w-52"
              />
            </template>

            <template #name-cell="{ row }">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                  {{ getClientInitial(row.original.name as string) }}
                </div>
                <div class="min-w-0">
                  <p class="truncate font-semibold text-highlighted">
                    {{ row.original.name }}
                  </p>
                  <p class="truncate text-xs text-muted">
                    {{ row.original.email || 'E-mail nao informado' }}
                  </p>
                </div>
              </div>
            </template>

            <template #person_type-cell="{ row }">
              <UBadge
                :label="getPersonTypeLabel(row.original.person_type as PersonType)"
                color="neutral"
                variant="subtle"
                size="xs"
              />
            </template>

            <template #tax_id-cell="{ row }">
              <span class="text-sm text-muted">
                {{ formatTaxId(row.original.tax_id as string | null, row.original.person_type as PersonType) }}
              </span>
            </template>

            <template #phone-cell="{ row }">
              <span class="text-sm text-muted">
                {{ formatContact(row.original as Client) }}
              </span>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-2">
                <UButton
                  v-if="canUpdate"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="openEdit(row.original as Client)"
                />
                <UButton
                  v-if="canDelete"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :loading="isDeleting"
                  @click="requestRemove(row.original as Client)"
                />
              </div>
            </template>

            <template #card="{ item: client }">
              <UCard class="border border-default/80 shadow-sm">
                <div class="flex items-start gap-4">
                  <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-base font-semibold text-primary">
                    {{ getClientInitial(client.name as string) }}
                  </div>

                  <div class="min-w-0 flex-1 space-y-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0 space-y-2">
                        <h3 class="truncate text-base font-semibold text-highlighted">
                          {{ client.name }}
                        </h3>
                        <UBadge
                          :label="getPersonTypeLabel(client.person_type as PersonType)"
                          color="neutral"
                          variant="subtle"
                          size="xs"
                        />
                      </div>

                      <div class="flex shrink-0 items-center gap-1">
                        <UTooltip v-if="canUpdate" text="Editar cliente">
                          <UButton
                            icon="i-lucide-pencil"
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            @click="openEdit(client as Client)"
                          />
                        </UTooltip>
                        <UTooltip v-if="canDelete" text="Excluir cliente">
                          <UButton
                            icon="i-lucide-trash-2"
                            color="error"
                            variant="ghost"
                            size="xs"
                            :loading="isDeleting"
                            @click="requestRemove(client as Client)"
                          />
                        </UTooltip>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 gap-2 text-sm text-muted sm:grid-cols-2">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-phone" class="size-4 shrink-0" />
                        <span class="truncate">{{ formatContact(client as Client) }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-mail" class="size-4 shrink-0" />
                        <span class="truncate">{{ client.email || 'E-mail nao informado' }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-id-card" class="size-4 shrink-0" />
                        <span class="truncate">{{ formatTaxId(client.tax_id as string | null, client.person_type as PersonType) || 'CPF/CNPJ nao informado' }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-map-pinned" class="size-4 shrink-0" />
                        <span class="truncate">{{ [client.city, client.state].filter(Boolean).join(' / ') || 'Localizacao nao informada' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </UCard>
            </template>
          </AppDataTable>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <CustomersFormModal
    v-model:open="showModal"
    :client="selectedClient"
    @saved="refresh"
  />

  <UModal
    :open="showDeleteModal"
    title="Confirmar exclusão"
    @update:open="value => !value && closeDeleteModal()"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Tem certeza que deseja excluir
          <strong class="text-highlighted">{{ clientPendingDeletion?.name || 'este cliente' }}</strong>?
          Esta acao nao pode ser desfeita.
        </p>

        <div class="flex justify-end gap-3">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="ghost"
            :disabled="isDeleting"
            @click="closeDeleteModal"
          />
          <UButton
            label="Excluir cliente"
            color="error"
            :loading="isDeleting"
            @click="confirmRemove"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
