<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Financeiro' })

type BadgeColor = 'success' | 'error' | 'warning' | 'primary' | 'secondary' | 'info' | 'neutral'

interface Entry {
  id: string
  description: string
  amount: string | number
  due_date: string
  type: string
  status: string
  category: string
  bank_account_id?: string | null
  notes?: string | null
  recurrence?: string | null
  [key: string]: unknown
}

type BankAccountOption = {
  label: string
  value: string
}

type FinancialResponse = {
  items: Entry[]
  total: number
  page: number
  page_size: number
}

const PAGE_SIZE = 20
const MANAGED_QUERY_KEYS = ['search', 'status', 'type', 'dateFrom', 'dateTo', 'page'] as const

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const route = useRoute()
const router = useRouter()

const canRead = computed(() => workshop.can(ActionCode.FINANCIAL_READ))
const canCreate = computed(() => workshop.can(ActionCode.FINANCIAL_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.FINANCIAL_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.FINANCIAL_DELETE))

function getDefaultDateRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0')

  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${lastDay}`
  }
}

function parsePage(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
}

function parseArrayQuery(value: unknown) {
  if (Array.isArray(value))
    return value.flatMap(item => String(item || '').split(',')).map(item => item.trim()).filter(Boolean)

  if (typeof value === 'string')
    return value.split(',').map(item => item.trim()).filter(Boolean)

  return []
}

function normalizeStatusValue(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'pago') return 'paid'
  if (normalized === 'pendente') return 'pending'
  if (normalized === 'paid' || normalized === 'pending') return normalized
  return normalized
}

function normalizeStatusForApi(value: string) {
  return value === 'paid' ? 'pago' : value === 'pending' ? 'pendente' : value
}

function normalizeRecurrenceValue(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || normalized === 'null' || normalized === 'none' || normalized === 'nao_recorrente')
    return null
  if (normalized === 'mensal') return 'monthly'
  if (normalized === 'anual') return 'yearly'
  if (normalized === 'semanal') return 'weekly'
  return normalized
}

function isPaidStatus(value: unknown) {
  return normalizeStatusValue(value) === 'paid'
}

const defaultDateRange = getDefaultDateRange()

const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const debouncedSearch = ref(search.value)
const statusFilters = ref<string[]>(parseArrayQuery(route.query.status))
const typeFilters = ref<string[]>(parseArrayQuery(route.query.type))
const dateFrom = ref(typeof route.query.dateFrom === 'string' ? route.query.dateFrom : defaultDateRange.from)
const dateTo = ref(typeof route.query.dateTo === 'string' ? route.query.dateTo : defaultDateRange.to)
const page = ref(parsePage(route.query.page))

const requestQuery = computed(() => ({
  search: debouncedSearch.value || undefined,
  status: statusFilters.value.length === 1 ? normalizeStatusForApi(statusFilters.value[0]!) : undefined,
  type: typeFilters.value.length === 1 ? typeFilters.value[0] : undefined,
  date_from: dateFrom.value || undefined,
  date_to: dateTo.value || undefined,
  page: page.value,
  page_size: PAGE_SIZE
}))

const { data, status, refresh } = await useAsyncData(
  () => `financial-${debouncedSearch.value}-${statusFilters.value.join(',')}-${typeFilters.value.join(',')}-${dateFrom.value}-${dateTo.value}-${page.value}`,
  async () => {
    if (!canRead.value) {
      return {
        items: [],
        total: 0,
        page: 1,
        page_size: PAGE_SIZE
      } satisfies FinancialResponse
    }

    return requestFetch<FinancialResponse>('/api/financial', {
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

const { data: bankAccountsData } = await useAsyncData(
  'financial-bank-accounts-options',
  () => requestFetch<BankAccountOption[] | { items?: BankAccountOption[] }>('/api/bank-accounts', {
    headers: requestHeaders,
    query: { page_size: 100 }
  }),
  { default: () => ({ items: [] }) }
)

const bankAccountOptions = computed<BankAccountOption[]>(() => {
  const raw = bankAccountsData.value
  const items = Array.isArray(raw)
    ? raw
    : ((raw as Record<string, unknown>)?.items as Array<Record<string, unknown>> | undefined) ?? []

  return items.map(item => ({
    label: String(item.name ?? item.label ?? 'Conta bancária'),
    value: String(item.id ?? item.value ?? '')
  })).filter(item => item.value)
})

const bankAccountById = computed(() =>
  new Map(bankAccountOptions.value.map(option => [option.value, option.label]))
)

const accumulatedItems = ref<Entry[]>([])
const totalFromServer = ref(0)

watch(data, (newData) => {
  const newItems = newData?.items ?? []
  totalFromServer.value = newData?.total ?? 0

  if (page.value === 1) {
    accumulatedItems.value = newItems
    return
  }

  const existingIds = new Set(accumulatedItems.value.map(item => item.id))
  accumulatedItems.value = [
    ...accumulatedItems.value,
    ...newItems.filter(item => !existingIds.has(item.id))
  ]
}, { immediate: true })

const hasMore = computed(() => accumulatedItems.value.length < totalFromServer.value)
const loadingMore = computed(() => status.value === 'pending' && page.value > 1)

const loadedSummary = computed(() => {
  const income = accumulatedItems.value
    .filter(entry => String(entry.type || '').toLowerCase() === 'income')
    .reduce((sum, entry) => sum + Number.parseFloat(String(entry.amount || 0)), 0)

  const expense = accumulatedItems.value
    .filter(entry => String(entry.type || '').toLowerCase() === 'expense')
    .reduce((sum, entry) => sum + Number.parseFloat(String(entry.amount || 0)), 0)

  const paidCount = accumulatedItems.value.filter(entry => isPaidStatus(entry.status)).length

  return {
    income,
    expense,
    balance: income - expense,
    paidCount,
    pendingCount: Math.max(0, accumulatedItems.value.length - paidCount)
  }
})

const hasActiveFilters = computed(() =>
  Boolean(
    search.value
    || statusFilters.value.length
    || typeFilters.value.length
    || dateFrom.value !== defaultDateRange.from
    || dateTo.value !== defaultDateRange.to
  )
)

function buildManagedQuery() {
  return {
    search: search.value || undefined,
    status: statusFilters.value.length ? statusFilters.value.join(',') : undefined,
    type: typeFilters.value.length ? typeFilters.value.join(',') : undefined,
    dateFrom: dateFrom.value !== defaultDateRange.from ? dateFrom.value : undefined,
    dateTo: dateTo.value !== defaultDateRange.to ? dateTo.value : undefined,
    page: page.value > 1 ? String(page.value) : undefined
  }
}

async function syncQuery() {
  const nextQuery = Object.fromEntries(
    Object.entries(route.query).filter(
      ([key]) => !MANAGED_QUERY_KEYS.includes(key as typeof MANAGED_QUERY_KEYS[number])
    )
  ) as Record<string, string | string[] | undefined>

  Object.assign(nextQuery, buildManagedQuery())

  if (JSON.stringify(route.query) === JSON.stringify(nextQuery))
    return

  await router.replace({ query: nextQuery })
}

watch(
  () => route.query,
  (query) => {
    const nextSearch = typeof query.search === 'string' ? query.search : ''
    const nextStatus = parseArrayQuery(query.status)
    const nextType = parseArrayQuery(query.type)
    const nextDateFrom = typeof query.dateFrom === 'string' ? query.dateFrom : defaultDateRange.from
    const nextDateTo = typeof query.dateTo === 'string' ? query.dateTo : defaultDateRange.to
    const nextPage = parsePage(query.page)

    if (search.value !== nextSearch) {
      search.value = nextSearch
      debouncedSearch.value = nextSearch
    }

    if (JSON.stringify(statusFilters.value) !== JSON.stringify(nextStatus))
      statusFilters.value = nextStatus

    if (JSON.stringify(typeFilters.value) !== JSON.stringify(nextType))
      typeFilters.value = nextType

    if (dateFrom.value !== nextDateFrom) dateFrom.value = nextDateFrom
    if (dateTo.value !== nextDateTo) dateTo.value = nextDateTo
    if (page.value !== nextPage) page.value = nextPage
  }
)

watchDebounced(
  search,
  async (value) => {
    debouncedSearch.value = value
    accumulatedItems.value = []
    page.value = 1
    await syncQuery()
  },
  { debounce: 300, maxWait: 800 }
)

watch(
  [statusFilters, typeFilters, dateFrom, dateTo],
  async () => {
    accumulatedItems.value = []
    page.value = 1
    await syncQuery()
  },
  { deep: true }
)

watch(page, syncQuery)

function loadMore() {
  if (hasMore.value && status.value !== 'pending')
    page.value += 1
}

function resetFilters() {
  search.value = ''
  debouncedSearch.value = ''
  statusFilters.value = []
  typeFilters.value = []
  dateFrom.value = defaultDateRange.from
  dateTo.value = defaultDateRange.to
  accumulatedItems.value = []
  page.value = 1
}

async function resetAndRefresh() {
  accumulatedItems.value = []

  if (page.value !== 1) {
    page.value = 1
    return
  }

  await refresh()
}

const isPaying = ref(false)
const payingEntryId = ref<string | null>(null)

async function pay(entry: Entry) {
  if (isPaying.value || isPaidStatus(entry.status)) return

  isPaying.value = true
  payingEntryId.value = String(entry.id)

  try {
    await $fetch(`/api/financial/${String(entry.id)}/pay`, { method: 'POST' })
    toast.add({ title: 'Lançamento marcado como pago', color: 'success' })
    await resetAndRefresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Falha ao pagar',
      color: 'error'
    })
  } finally {
    isPaying.value = false
    payingEntryId.value = null
  }
}

const showFormModal = ref(false)
const selectedEntry = ref<Entry | null>(null)

function openCreate() {
  selectedEntry.value = null
  showFormModal.value = true
}

function openEdit(entry: Entry) {
  selectedEntry.value = entry
  showFormModal.value = true
}

async function onEntrySaved() {
  showFormModal.value = false
  selectedEntry.value = null
  await resetAndRefresh()
}

const isDeleting = ref(false)
const showDeleteModal = ref(false)
const entryPendingDeletion = ref<Entry | null>(null)

function requestRemove(entry: Entry) {
  if (isDeleting.value) return
  entryPendingDeletion.value = entry
  showDeleteModal.value = true
}

async function confirmRemove() {
  if (!entryPendingDeletion.value || isDeleting.value) return

  isDeleting.value = true

  try {
    await $fetch(`/api/financial/${String(entryPendingDeletion.value.id)}`, { method: 'DELETE' })
    toast.add({ title: 'Lançamento removido', color: 'success' })
    showDeleteModal.value = false
    entryPendingDeletion.value = null
    await resetAndRefresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Falha ao remover',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

function formatCurrency(value: number | string) {
  const parsed = Number.parseFloat(String(value || 0))
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'R$ 0,00'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  const [year, month, day] = String(value).split('-')
  if (!year || !month || !day) return value

  return `${day}/${month}/${year}`
}

function formatStatusLabel(value: unknown) {
  const normalized = normalizeStatusValue(value)
  if (normalized === 'paid') return 'Pago'
  if (normalized === 'pending') return 'Pendente'
  return String(value || '—')
}

function formatRecurrence(value: unknown) {
  const normalized = normalizeRecurrenceValue(value)
  if (!normalized) return 'Sem recorrência'
  if (normalized === 'weekly') return 'Semanal'
  if (normalized === 'monthly') return 'Mensal'
  if (normalized === 'yearly') return 'Anual'
  return String(value || 'Sem recorrência')
}

function getBankAccountLabel(entry: Entry) {
  const accountId = String(entry.bank_account_id || '')
  if (!accountId) return 'Sem conta vinculada'
  return bankAccountById.value.get(accountId) || 'Conta vinculada'
}

const typeBadgeColor: Record<string, BadgeColor> = {
  income: 'success',
  expense: 'error'
}

const typeBadgeLabel: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa'
}

const statusBadgeColor: Record<string, BadgeColor> = {
  paid: 'success',
  pending: 'warning'
}

const columns = [
  { accessorKey: 'description', header: 'Lançamento', enableSorting: false },
  { accessorKey: 'category', header: 'Categoria', enableSorting: false },
  { accessorKey: 'due_date', header: 'Vencimento', enableSorting: false },
  { id: 'type', header: 'Tipo', enableSorting: false },
  { id: 'status_col', header: 'Status', enableSorting: false },
  { id: 'amount_col', header: 'Valor', enableSorting: false },
  { id: 'actions', header: '', enableSorting: false }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Financeiro" />
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">
          Você não tem permissão para visualizar lançamentos financeiros.
        </p>
      </div>

      <div v-else class="space-y-4 p-4">
        <FinancialEntriesFilters
          v-model:date-from="dateFrom"
          v-model:date-to="dateTo"
          v-model:type-filters="typeFilters"
          v-model:status-filters="statusFilters"
        />

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-2xl border border-default/80 bg-default/60 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-medium uppercase tracking-[0.08em] text-muted">
                  Resultados filtrados
                </p>
                <p class="mt-2 text-2xl font-semibold text-highlighted">
                  {{ totalFromServer }}
                </p>
              </div>
              <div class="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <UIcon name="i-lucide-list-filter" class="size-5" />
              </div>
            </div>
            <p class="mt-3 text-sm text-muted">
              {{ accumulatedItems.length }} carregado(s) até agora.
            </p>
          </div>

          <div class="rounded-2xl border border-default/80 bg-default/60 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-medium uppercase tracking-[0.08em] text-muted">
                  Receitas carregadas
                </p>
                <p class="mt-2 text-2xl font-semibold text-success">
                  {{ formatCurrency(loadedSummary.income) }}
                </p>
              </div>
              <div class="flex size-11 items-center justify-center rounded-2xl bg-success/12 text-success">
                <UIcon name="i-lucide-trending-up" class="size-5" />
              </div>
            </div>
            <p class="mt-3 text-sm text-muted">
              Somatório das entradas já carregadas no scroll.
            </p>
          </div>

          <div class="rounded-2xl border border-default/80 bg-default/60 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-medium uppercase tracking-[0.08em] text-muted">
                  Despesas carregadas
                </p>
                <p class="mt-2 text-2xl font-semibold text-error">
                  {{ formatCurrency(loadedSummary.expense) }}
                </p>
              </div>
              <div class="flex size-11 items-center justify-center rounded-2xl bg-error/12 text-error">
                <UIcon name="i-lucide-trending-down" class="size-5" />
              </div>
            </div>
            <p class="mt-3 text-sm text-muted">
              Somatório das saídas já carregadas no scroll.
            </p>
          </div>

          <div class="rounded-2xl border border-default/80 bg-default/60 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-medium uppercase tracking-[0.08em] text-muted">
                  Saldo carregado
                </p>
                <p
                  class="mt-2 text-2xl font-semibold"
                  :class="loadedSummary.balance >= 0 ? 'text-success' : 'text-error'"
                >
                  {{ formatCurrency(loadedSummary.balance) }}
                </p>
              </div>
              <div
                class="flex size-11 items-center justify-center rounded-2xl"
                :class="loadedSummary.balance >= 0 ? 'bg-success/12 text-success' : 'bg-error/12 text-error'"
              >
                <UIcon name="i-lucide-wallet" class="size-5" />
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <UBadge
                :label="`${loadedSummary.pendingCount} pendente(s)`"
                color="warning"
                variant="subtle"
                size="xs"
              />
              <UBadge
                :label="`${loadedSummary.paidCount} pago(s)`"
                color="success"
                variant="subtle"
                size="xs"
              />
            </div>
          </div>
        </div>

        <AppDataTableInfinite
          v-model:search-term="search"
          :columns="columns"
          :data="accumulatedItems as Record<string, unknown>[]"
          :loading="status === 'pending' && page === 1"
          :loading-more="loadingMore"
          :has-more="hasMore"
          :total="totalFromServer"
          show-search
          search-placeholder="Buscar por descrição..."
          empty-icon="i-lucide-wallet-cards"
          empty-title="Nenhum lançamento encontrado"
          empty-description="Cadastre lançamentos ou ajuste os filtros para continuar."
          @load-more="loadMore"
        >
          <template #toolbar-right>
            <UTooltip text="Atualizar listagem">
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="outline"
                size="sm"
                :loading="status === 'pending' && page === 1"
                @click="resetAndRefresh()"
              />
            </UTooltip>

            <UButton
              v-if="hasActiveFilters"
              label="Limpar filtros"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="resetFilters"
            />

            <UButton
              v-if="canCreate"
              label="Novo lançamento"
              icon="i-lucide-plus"
              size="sm"
              @click="openCreate"
            />
          </template>

          <template #description-cell="{ row }">
            <div class="min-w-0 space-y-1">
              <p class="truncate font-semibold text-highlighted">
                {{ row.original.description }}
              </p>
              <p class="truncate text-xs text-muted">
                {{ getBankAccountLabel(row.original as Entry) }}
              </p>
            </div>
          </template>

          <template #category-cell="{ row }">
            <div class="space-y-1">
              <p class="text-sm text-highlighted">
                {{ row.original.category || 'Sem categoria' }}
              </p>
              <p class="text-xs text-muted">
                {{ formatRecurrence((row.original as Entry).recurrence) }}
              </p>
            </div>
          </template>

          <template #due_date-cell="{ row }">
            <span class="text-sm text-muted">
              {{ formatDate(String(row.original.due_date || '')) }}
            </span>
          </template>

          <template #type-cell="{ row }">
            <UBadge
              :color="typeBadgeColor[String(row.original.type)] ?? 'neutral'"
              variant="subtle"
              :label="typeBadgeLabel[String(row.original.type)] ?? String(row.original.type || '—')"
              size="xs"
            />
          </template>

          <template #status_col-cell="{ row }">
            <UBadge
              :color="statusBadgeColor[normalizeStatusValue((row.original as Entry).status)] ?? 'neutral'"
              variant="subtle"
              :label="formatStatusLabel((row.original as Entry).status)"
              size="xs"
            />
          </template>

          <template #amount_col-cell="{ row }">
            <span
              class="text-sm font-semibold"
              :class="row.original.type === 'income' ? 'text-success' : 'text-error'"
            >
              {{ formatCurrency(row.original.amount as string | number) }}
            </span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex items-center justify-end gap-2">
              <UTooltip
                v-if="canUpdate && !isPaidStatus((row.original as Entry).status)"
                text="Marcar como pago"
              >
                <UButton
                  icon="i-lucide-check-circle"
                  color="success"
                  variant="ghost"
                  size="xs"
                  :loading="isPaying && payingEntryId === String((row.original as Entry).id)"
                  @click="pay(row.original as Entry)"
                />
              </UTooltip>

              <UTooltip v-if="canUpdate" text="Editar lançamento">
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="openEdit(row.original as Entry)"
                />
              </UTooltip>

              <UTooltip v-if="canDelete" text="Excluir lançamento">
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :loading="isDeleting && entryPendingDeletion?.id === (row.original as Entry).id"
                  @click="requestRemove(row.original as Entry)"
                />
              </UTooltip>
            </div>
          </template>

          <template #end-of-list>
            Todos os {{ totalFromServer }} registro(s) foram carregados
          </template>
        </AppDataTableInfinite>
      </div>
    </template>
  </UDashboardPanel>

  <FinancialEntriesFormModal
    v-model:open="showFormModal"
    :entry="selectedEntry"
    :bank-account-options="bankAccountOptions"
    @saved="onEntrySaved"
  />

  <AppConfirmModal
    v-model:open="showDeleteModal"
    title="Excluir lançamento"
    confirm-label="Excluir lançamento"
    confirm-color="error"
    :loading="isDeleting"
    @confirm="confirmRemove"
    @update:open="
      (value: boolean) => {
        showDeleteModal = value
        if (!value && !isDeleting) entryPendingDeletion = null
      }
    "
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir
        <strong class="text-highlighted">{{ entryPendingDeletion?.description || 'este lançamento' }}</strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>
</template>
