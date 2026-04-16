<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Clientes' })

type PersonType = 'pf' | 'pj'
type ViewMode = 'line' | 'card'
const ALL_PERSON_TYPES_VALUE = 'all'

type Client = {
  id: string
  name: string
  person_type: PersonType
  tax_id: string | null
  email: string | null
  phone: string | null
  mobile_phone: string | null
  birth_date: string | null
  zip_code: string | null
  street: string | null
  address_number: string | null
  address_complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  notes: string | null
}

type ClientsResponse = {
  items: Client[]
  total: number
  page: number
  page_size: number
}

const PAGE_SIZE = 20
const MANAGED_QUERY_KEYS = ['search', 'personType', 'page', 'view'] as const

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

function parseView(value: unknown): ViewMode {
  return value === 'card' ? 'card' : 'line'
}

function parsePersonType(value: unknown): PersonType | typeof ALL_PERSON_TYPES_VALUE {
  return value === 'pf' || value === 'pj' ? value : ALL_PERSON_TYPES_VALUE
}

const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const personTypeFilter = ref<PersonType | typeof ALL_PERSON_TYPES_VALUE>(parsePersonType(route.query.personType))
const page = ref(parsePage(route.query.page))
const viewMode = ref<ViewMode>(parseView(route.query.view))
const isLoadingCep = ref(false)

const requestQuery = computed(() => ({
  search: search.value || undefined,
  person_type: personTypeFilter.value !== ALL_PERSON_TYPES_VALUE ? personTypeFilter.value : undefined,
  page: page.value,
  page_size: PAGE_SIZE
}))

const { data, status, refresh } = await useAsyncData(
  () => `clients-${search.value}-${personTypeFilter.value}-${page.value}`,
  async () => {
    if (!canRead.value) {
      return {
        items: [],
        total: 0,
        page: 1,
        page_size: PAGE_SIZE
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
      page_size: PAGE_SIZE
    })
  }
)

const clientItems = computed(() => data.value?.items ?? [])
const totalClients = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalClients.value / PAGE_SIZE)))
const hasActiveFilters = computed(() => Boolean(search.value || personTypeFilter.value !== ALL_PERSON_TYPES_VALUE))
const resultLabel = computed(() => {
  if (!totalClients.value)
    return 'Nenhum cliente encontrado'

  const from = (page.value - 1) * PAGE_SIZE + 1
  const to = Math.min(page.value * PAGE_SIZE, totalClients.value)
  return `Mostrando ${from}-${to} de ${totalClients.value} clientes`
})

function buildManagedQuery() {
  return {
    search: search.value || undefined,
    personType: personTypeFilter.value !== ALL_PERSON_TYPES_VALUE ? personTypeFilter.value : undefined,
    page: page.value > 1 ? String(page.value) : undefined,
    view: viewMode.value !== 'line' ? viewMode.value : undefined
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
  const nextView = parseView(query.view)

  if (search.value !== nextSearch)
    search.value = nextSearch
  if (personTypeFilter.value !== nextPersonType)
    personTypeFilter.value = nextPersonType
  if (page.value !== nextPage)
    page.value = nextPage
  if (viewMode.value !== nextView)
    viewMode.value = nextView
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

watch(viewMode, syncQuery)

function clearFilters() {
  search.value = ''
  personTypeFilter.value = ALL_PERSON_TYPES_VALUE
  page.value = 1
}

function getClientInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'C'
}

function getPersonTypeLabel(personType: PersonType) {
  return personType === 'pf' ? 'PF' : 'PJ'
}

function formatContact(client: Client) {
  return client.phone || client.mobile_phone || 'Telefone não informado'
}

// Modal
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  name: '',
  person_type: 'pf' as PersonType,
  tax_id: '',
  email: '',
  phone: '',
  mobile_phone: '',
  birth_date: '',
  zip_code: '',
  street: '',
  address_number: '',
  address_complement: '',
  neighborhood: '',
  city: '',
  state: '',
  notes: ''
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(client: Client) {
  Object.assign(form, {
    name: client.name ?? '',
    person_type: client.person_type ?? 'pf',
    tax_id: client.tax_id ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    mobile_phone: client.mobile_phone ?? '',
    birth_date: client.birth_date ? client.birth_date.split('T')[0] : '',
    zip_code: client.zip_code ?? '',
    street: client.street ?? '',
    address_number: client.address_number ?? '',
    address_complement: client.address_complement ?? '',
    neighborhood: client.neighborhood ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    notes: client.notes ?? ''
  })
  isEditing.value = true
  selectedId.value = client.id
  showModal.value = true
}

async function save() {
  if (isSaving.value)
    return

  if (!form.name.trim()) {
    toast.add({ title: 'Nome obrigatório', color: 'warning' })
    return
  }

  if (!form.phone.trim()) {
    toast.add({ title: 'Telefone obrigatório', color: 'warning' })
    return
  }

  isSaving.value = true
  try {
    const body = {
      name: form.name,
      person_type: form.person_type,
      tax_id: form.tax_id || null,
      email: form.email || null,
      phone: form.phone || null,
      mobile_phone: form.mobile_phone || null,
      birth_date: form.birth_date || null,
      zip_code: form.zip_code || null,
      street: form.street || null,
      address_number: form.address_number || null,
      address_complement: form.address_complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      notes: form.notes || null
    }

    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/clients/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Cliente atualizado', color: 'success' })
    } else {
      await $fetch('/api/clients', { method: 'POST', body })
      toast.add({ title: 'Cliente criado', color: 'success' })
    }

    showModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

async function remove(client: Client) {
  if (isDeleting.value)
    return

  isDeleting.value = true
  try {
    await $fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    toast.add({ title: 'Cliente removido', color: 'success' })

    if (clientItems.value.length === 1 && page.value > 1)
      page.value -= 1

    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover.',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

async function lookupCep() {
  const cep = form.zip_code.replace(/\D/g, '')
  if (cep.length !== 8)
    return

  isLoadingCep.value = true
  try {
    const res = await $fetch<Record<string, string | boolean>>(`https://viacep.com.br/ws/${cep}/json/`)
    if (res.erro) {
      toast.add({ title: 'CEP não encontrado', color: 'warning' })
      return
    }

    form.street = String(res.logradouro || form.street)
    form.neighborhood = String(res.bairro || form.neighborhood)
    form.city = String(res.localidade || form.city)
    form.state = String(res.uf || form.state)
  } catch {
    toast.add({ title: 'Erro ao buscar CEP', color: 'error' })
  } finally {
    isLoadingCep.value = false
  }
}

const personTypeOptions = [
  { label: 'Pessoa Física', value: 'pf' },
  { label: 'Pessoa Jurídica', value: 'pj' }
]

const personTypeFilterOptions = [
  { label: 'Todos os tipos', value: ALL_PERSON_TYPES_VALUE },
  { label: 'Pessoa Física', value: 'pf' },
  { label: 'Pessoa Jurídica', value: 'pj' }
]

const lineColumns = [
  { accessorKey: 'name', header: 'Cliente' },
  { accessorKey: 'person_type', header: 'Tipo' },
  { accessorKey: 'tax_id', header: 'CPF/CNPJ' },
  { accessorKey: 'phone', header: 'Telefone' },
  { accessorKey: 'email', header: 'E-mail' },
  { id: 'actions', header: '' }
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
          Você não tem permissão para visualizar clientes.
        </p>
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center gap-3 border-b border-default p-4">
          <UInput
            v-model="search"
            placeholder="Buscar por nome, e-mail ou CPF/CNPJ..."
            icon="i-lucide-search"
            class="w-full sm:w-80"
          />

          <USelectMenu
            v-model="personTypeFilter"
            :items="personTypeFilterOptions"
            value-key="value"
            class="w-full sm:w-52"
          />

          <UButtonGroup class="sm:ml-auto">
            <UButton
              label="Linha"
              icon="i-lucide-list"
              color="neutral"
              :variant="viewMode === 'line' ? 'solid' : 'outline'"
              @click="viewMode = 'line'"
            />
            <UButton
              label="Cards"
              icon="i-lucide-layout-grid"
              color="neutral"
              :variant="viewMode === 'card' ? 'solid' : 'outline'"
              @click="viewMode = 'card'"
            />
          </UButtonGroup>

          <UButton
            v-if="hasActiveFilters"
            label="Limpar"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            @click="clearFilters"
          />

          <p class="w-full text-xs text-muted sm:w-auto sm:ml-auto">
            {{ resultLabel }}
          </p>
        </div>

        <AppDataTable
          v-if="viewMode === 'line'"
          v-model:page="page"
          :columns="lineColumns"
          :data="clientItems"
          :loading="status === 'pending'"
          :page="page"
          :page-size="PAGE_SIZE"
          :total="totalClients"
          empty-title="Nenhum cliente encontrado"
          empty-description="Cadastre um cliente ou ajuste os filtros para continuar."
        >
          <template #name-cell="{ row }">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                {{ getClientInitial(row.original.name) }}
              </div>
              <div class="min-w-0">
                <p class="truncate font-semibold text-highlighted">
                  {{ row.original.name }}
                </p>
                <p class="truncate text-xs text-muted">
                  {{ row.original.email || 'E-mail não informado' }}
                </p>
              </div>
            </div>
          </template>

          <template #person_type-cell="{ row }">
            <UBadge
              :label="getPersonTypeLabel(row.original.person_type)"
              color="neutral"
              variant="subtle"
              size="xs"
            />
          </template>

          <template #tax_id-cell="{ row }">
            <span class="text-sm text-muted">
              {{ row.original.tax_id || '-' }}
            </span>
          </template>

          <template #phone-cell="{ row }">
            <span class="text-sm text-muted">
              {{ formatContact(row.original) }}
            </span>
          </template>

          <template #email-cell="{ row }">
            <span class="text-sm text-muted">
              {{ row.original.email || '-' }}
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
                @click="openEdit(row.original)"
              />
              <UButton
                v-if="canDelete"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :loading="isDeleting"
                @click="remove(row.original)"
              />
            </div>
          </template>
        </AppDataTable>

        <div v-else class="flex min-h-0 flex-1 flex-col">
          <div v-if="status === 'pending'" class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
            <USkeleton v-for="index in 6" :key="index" class="h-44 w-full rounded-2xl" />
          </div>

          <div
            v-else-if="clientItems.length"
            class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2"
          >
            <UCard
              v-for="client in clientItems"
              :key="client.id"
              class="border border-default/80 shadow-sm"
            >
              <div class="flex items-start gap-4">
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-base font-semibold text-primary">
                  {{ getClientInitial(client.name) }}
                </div>

                <div class="min-w-0 flex-1 space-y-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="truncate text-base font-semibold text-highlighted">
                      {{ client.name }}
                    </h3>
                    <UBadge
                      :label="getPersonTypeLabel(client.person_type)"
                      color="neutral"
                      variant="subtle"
                      size="xs"
                    />
                  </div>

                  <div class="grid grid-cols-1 gap-2 text-sm text-muted sm:grid-cols-2">
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-phone" class="size-4 shrink-0" />
                      <span class="truncate">{{ formatContact(client) }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-mail" class="size-4 shrink-0" />
                      <span class="truncate">{{ client.email || 'E-mail não informado' }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-id-card" class="size-4 shrink-0" />
                      <span class="truncate">{{ client.tax_id || 'CPF/CNPJ não informado' }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-map-pinned" class="size-4 shrink-0" />
                      <span class="truncate">{{ [client.city, client.state].filter(Boolean).join(' / ') || 'Localização não informada' }}</span>
                    </div>
                  </div>

                  <div class="flex items-center justify-end gap-2 border-t border-default pt-3">
                    <UButton
                      v-if="canUpdate"
                      label="Editar"
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="openEdit(client)"
                    />
                    <UButton
                      v-if="canDelete"
                      label="Excluir"
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      size="sm"
                      :loading="isDeleting"
                      @click="remove(client)"
                    />
                  </div>
                </div>
              </div>
            </UCard>
          </div>

          <div
            v-else
            class="flex flex-1 items-center justify-center p-10 text-center"
          >
            <div class="max-w-sm space-y-2">
              <p class="text-sm font-semibold text-highlighted">
                Nenhum cliente encontrado
              </p>
              <p class="text-sm text-muted">
                Cadastre um cliente ou ajuste os filtros para continuar.
              </p>
            </div>
          </div>

          <div
            v-if="totalClients > PAGE_SIZE"
            class="flex justify-center border-t border-default p-4"
          >
            <UPagination
              v-model="page"
              :page-count="PAGE_SIZE"
              :total="totalClients"
            />
          </div>
        </div>
      </template>
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="showModal"
    :title="isEditing ? 'Editar cliente' : 'Novo cliente'"
    :ui="{ body: 'overflow-y-auto max-h-[70vh]' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Nome" required class="sm:col-span-2">
            <UInput v-model="form.name" class="w-full" />
          </UFormField>

          <UFormField label="Tipo de pessoa">
            <USelectMenu
              v-model="form.person_type"
              :items="personTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="CPF / CNPJ">
            <UInput v-model="form.tax_id" class="w-full" />
          </UFormField>

          <UFormField label="E-mail">
            <UInput v-model="form.email" type="email" class="w-full" />
          </UFormField>

          <UFormField label="Telefone" required>
            <UInput v-model="form.phone" class="w-full" />
          </UFormField>

          <UFormField label="Celular">
            <UInput v-model="form.mobile_phone" class="w-full" />
          </UFormField>

          <UFormField label="Data de nascimento">
            <UInput v-model="form.birth_date" type="date" class="w-full" />
          </UFormField>
        </div>

        <USeparator label="Endereço" />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="CEP" class="sm:col-span-2">
            <div class="flex gap-2">
              <UInput v-model="form.zip_code" placeholder="00000-000" class="flex-1" />
              <UButton
                label="Buscar"
                color="neutral"
                variant="outline"
                :loading="isLoadingCep"
                :disabled="isLoadingCep"
                @click="lookupCep"
              />
            </div>
          </UFormField>

          <UFormField label="Logradouro" class="sm:col-span-2">
            <UInput v-model="form.street" class="w-full" />
          </UFormField>

          <UFormField label="Número">
            <UInput v-model="form.address_number" class="w-full" />
          </UFormField>

          <UFormField label="Complemento">
            <UInput v-model="form.address_complement" class="w-full" />
          </UFormField>

          <UFormField label="Bairro">
            <UInput v-model="form.neighborhood" class="w-full" />
          </UFormField>

          <UFormField label="Cidade">
            <UInput v-model="form.city" class="w-full" />
          </UFormField>

          <UFormField label="UF">
            <UInput v-model="form.state" maxlength="2" class="w-full uppercase" />
          </UFormField>
        </div>

        <UFormField label="Observações">
          <UTextarea v-model="form.notes" class="w-full" :rows="3" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="showModal = false"
        />
        <UButton
          label="Salvar"
          color="neutral"
          :loading="isSaving"
          :disabled="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
