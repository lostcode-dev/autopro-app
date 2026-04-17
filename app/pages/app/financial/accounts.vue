<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { RowSelectionState, SortingState } from '@tanstack/table-core'
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Contas bancárias' })

type BankAccount = Record<string, any>
type AccountsResponse = { items: BankAccount[]; total: number; page: number; page_size: number }
type ViewMode = 'table' | 'card'

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const MANAGED_QUERY_KEYS = ['search', 'page', 'pageSize', 'view', 'sortBy', 'sortOrder'] as const

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const route = useRoute()
const router = useRouter()

const canRead = computed(() => workshop.can(ActionCode.BANK_ACCOUNTS_READ))
const canCreate = computed(() => workshop.can(ActionCode.BANK_ACCOUNTS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.BANK_ACCOUNTS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.BANK_ACCOUNTS_DELETE))

function parsePage(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
}
function parsePageSize(v: unknown) {
  const n = Number(v)
  return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE
}
function parseView(v: unknown): ViewMode {
  return v === 'card' ? 'card' : 'table'
}

const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const debouncedSearch = ref(search.value)
const page = ref(parsePage(route.query.page))
const pageSize = ref(parsePageSize(route.query.pageSize))
const viewMode = ref<ViewMode>(parseView(route.query.view))

const DEFAULT_SORT = { id: 'account_name', desc: false }
const sorting = ref<SortingState>(
  typeof route.query.sortBy === 'string' && route.query.sortBy
    ? [{ id: route.query.sortBy, desc: route.query.sortOrder === 'desc' }]
    : [DEFAULT_SORT],
)

const requestQuery = computed(() => ({
  search: debouncedSearch.value || undefined,
  page: page.value,
  page_size: pageSize.value,
  sort_by: sorting.value[0]?.id || undefined,
  sort_order: sorting.value[0] ? (sorting.value[0].desc ? 'desc' : 'asc') : undefined,
}))

const { data, status, refresh } = await useAsyncData(
  () => `bank-accounts-${debouncedSearch.value}-${page.value}-${pageSize.value}-${sorting.value[0]?.id}-${sorting.value[0]?.desc}`,
  async () => {
    if (!canRead.value)
      return { items: [], total: 0, page: 1, page_size: pageSize.value } satisfies AccountsResponse
    return requestFetch<AccountsResponse>('/api/bank-accounts', { headers: requestHeaders, query: requestQuery.value })
  },
  {
    watch: [requestQuery],
    default: () => ({ items: [], total: 0, page: 1, page_size: pageSize.value }),
  },
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function buildManagedQuery() {
  return {
    search: search.value || undefined,
    page: page.value > 1 ? String(page.value) : undefined,
    pageSize: pageSize.value !== DEFAULT_PAGE_SIZE ? String(pageSize.value) : undefined,
    view: viewMode.value !== 'table' ? viewMode.value : undefined,
    sortBy: sorting.value[0]?.id || undefined,
    sortOrder: sorting.value[0]?.desc ? 'desc' : undefined,
  }
}

async function syncQuery() {
  const nextQuery = Object.fromEntries(
    Object.entries(route.query).filter(([k]) => !MANAGED_QUERY_KEYS.includes(k as typeof MANAGED_QUERY_KEYS[number])),
  ) as Record<string, string | string[] | undefined>
  Object.assign(nextQuery, buildManagedQuery())
  if (JSON.stringify(route.query) === JSON.stringify(nextQuery)) return
  await router.replace({ query: nextQuery })
}

watch(() => route.query, (query) => {
  const nextSearch = typeof query.search === 'string' ? query.search : ''
  const nextPage = parsePage(query.page)
  const nextPageSize = parsePageSize(query.pageSize)
  const nextView = parseView(query.view)
  if (search.value !== nextSearch) { search.value = nextSearch; debouncedSearch.value = nextSearch }
  if (page.value !== nextPage) page.value = nextPage
  if (pageSize.value !== nextPageSize) pageSize.value = nextPageSize
  if (viewMode.value !== nextView) viewMode.value = nextView
  const nextSortBy = typeof query.sortBy === 'string' ? query.sortBy : ''
  const nextSortDesc = query.sortOrder === 'desc'
  const cur = sorting.value[0]
  if (nextSortBy) {
    if (!cur || cur.id !== nextSortBy || cur.desc !== nextSortDesc)
      sorting.value = [{ id: nextSortBy, desc: nextSortDesc }]
  }
  else if (!cur || cur.id !== DEFAULT_SORT.id || cur.desc !== DEFAULT_SORT.desc) {
    sorting.value = [DEFAULT_SORT]
  }
})

watchDebounced(search, async (val) => { debouncedSearch.value = val; page.value = 1; await syncQuery() }, { debounce: 300, maxWait: 800 })
watch(page, async () => { if (page.value > totalPages.value && totalPages.value > 0) page.value = totalPages.value; await syncQuery() })
watch(pageSize, async () => { page.value = 1; await syncQuery() })
watch(viewMode, syncQuery)
watch(sorting, async () => { page.value = 1; await syncQuery() })

// ─── Row selection ───────────────────────────────────────────────────────────
const rowSelection = ref<RowSelectionState>({})
const selectedIds = computed(() => Object.entries(rowSelection.value).filter(([, v]) => v).map(([id]) => id))
const selectedCount = computed(() => selectedIds.value.length)
watch(viewMode, () => { rowSelection.value = {} })

// ─── Modal / CRUD ─────────────────────────────────────────────────────────────
const showModal = ref(false)
const selectedAccount = ref<BankAccount | null>(null)
const isDeleting = ref(false)
const showDeleteModal = ref(false)
const accountPendingDeletion = ref<BankAccount | null>(null)
const showBulkDeleteModal = ref(false)
const isBulkDeleting = ref(false)

function openCreate() { selectedAccount.value = null; showModal.value = true }
function openEdit(a: BankAccount) { selectedAccount.value = a; showModal.value = true }

function requestRemove(a: BankAccount) {
  if (isDeleting.value) return
  accountPendingDeletion.value = a
  showDeleteModal.value = true
}

async function remove(a: BankAccount) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/bank-accounts/${a.id}`, { method: 'DELETE' })
    toast.add({ title: 'Conta removida', color: 'success' })
    showDeleteModal.value = false
    accountPendingDeletion.value = null
    if (items.value.length === 1 && page.value > 1) page.value -= 1
    await refresh()
  }
  catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  }
  finally {
    isDeleting.value = false
  }
}

async function confirmBulkDelete() {
  if (!selectedIds.value.length || isBulkDeleting.value) return
  isBulkDeleting.value = true
  try {
    await Promise.all(selectedIds.value.map(id => $fetch(`/api/bank-accounts/${id}`, { method: 'DELETE' })))
    toast.add({ title: `${selectedIds.value.length} conta(s) removida(s)`, color: 'success' })
    rowSelection.value = {}
    showBulkDeleteModal.value = false
    await refresh()
  }
  catch {
    toast.add({ title: 'Erro ao excluir contas', color: 'error' })
  }
  finally {
    isBulkDeleting.value = false
  }
}

const accountTypeLabel = (type: string) =>
  ({ checking: 'Corrente', savings: 'Poupança', cash: 'Caixa', other: 'Outro' }[type] ?? type)

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val) : '-'

const lineColumns = [
  { accessorKey: 'account_name', header: 'Nome', enableSorting: true },
  { accessorKey: 'account_type', header: 'Tipo', enableSorting: true },
  { accessorKey: 'bank_name', header: 'Banco', enableSorting: true },
  { accessorKey: 'initial_balance', header: 'Saldo inicial', enableSorting: false },
  { accessorKey: 'is_active', header: 'Status', enableSorting: false },
  { id: 'actions', header: 'Ações', enableSorting: false },
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Contas bancárias" />
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">
          Você não tem permissão para visualizar contas bancárias.
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
            v-model:row-selection="rowSelection"
            :columns="lineColumns"
            :data="items"
            :loading="status === 'pending'"
            :loading-variant="viewMode === 'card' ? 'card' : 'row'"
            :selectable="viewMode === 'table'"
            :sticky-header="viewMode === 'table'"
            :get-row-id="(row) => String(row.id ?? '')"
            :page-size-options="PAGE_SIZE_OPTIONS"
            :total="total"
            search-placeholder="Buscar por nome ou banco..."
            :show-search="true"
            :show-view-mode-toggle="true"
            card-grid-class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2"
            empty-icon="i-lucide-landmark"
            empty-title="Nenhuma conta encontrada"
            empty-description="Cadastre uma conta bancária para começar."
          >
            <template #toolbar-right>
              <UTooltip v-if="canDelete" :text="selectedCount > 0 ? `Excluir ${selectedCount} selecionada(s)` : 'Excluir seleção'">
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="outline"
                  size="sm"
                  :disabled="selectedCount === 0"
                  @click="showBulkDeleteModal = true"
                />
              </UTooltip>
              <UButton v-if="canCreate" label="Nova conta" icon="i-lucide-plus" size="sm" @click="openCreate" />
            </template>

            <template #account_name-cell="{ row }">
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12">
                  <UIcon name="i-lucide-landmark" class="size-4 text-primary" />
                </div>
                <div class="min-w-0">
                  <p class="truncate font-semibold text-highlighted">
                    {{ row.original.account_name }}
                  </p>
                  <p v-if="row.original.bank_name" class="truncate text-xs text-muted">
                    {{ row.original.bank_name }}
                  </p>
                </div>
              </div>
            </template>

            <template #account_type-cell="{ row }">
              <UBadge :label="accountTypeLabel(row.original.account_type as string)" color="neutral" variant="subtle" size="xs" />
            </template>

            <template #initial_balance-cell="{ row }">
              <span class="text-sm text-muted">{{ formatCurrency(row.original.initial_balance as number | null) }}</span>
            </template>

            <template #is_active-cell="{ row }">
              <UBadge
                :label="row.original.is_active ? 'Ativa' : 'Inativa'"
                :color="row.original.is_active ? 'success' : 'neutral'"
                variant="subtle"
                size="xs"
              />
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-2">
                <UButton
                  v-if="canUpdate"
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="openEdit(row.original as BankAccount)"
                />
                <UButton
                  v-if="canDelete"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :loading="isDeleting"
                  @click="requestRemove(row.original as BankAccount)"
                />
              </div>
            </template>

            <template #card="{ item: account }">
              <UCard class="border border-default/80 shadow-sm">
                <div class="flex items-start gap-4">
                  <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12">
                    <UIcon name="i-lucide-landmark" class="size-5 text-primary" />
                  </div>
                  <div class="min-w-0 flex-1 space-y-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0 space-y-1">
                        <h3 class="truncate text-base font-semibold text-highlighted">
                          {{ account.account_name }}
                        </h3>
                        <div class="flex items-center gap-2">
                          <UBadge :label="accountTypeLabel(account.account_type as string)" color="neutral" variant="subtle" size="xs" />
                          <UBadge
                            :label="account.is_active ? 'Ativa' : 'Inativa'"
                            :color="account.is_active ? 'success' : 'neutral'"
                            variant="subtle"
                            size="xs"
                          />
                        </div>
                      </div>
                      <div class="flex shrink-0 items-center gap-1">
                        <UButton
                          v-if="canUpdate"
                          icon="i-lucide-pencil"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          @click="openEdit(account as BankAccount)"
                        />
                        <UButton
                          v-if="canDelete"
                          icon="i-lucide-trash-2"
                          color="error"
                          variant="ghost"
                          size="xs"
                          @click="requestRemove(account as BankAccount)"
                        />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-sm text-muted">
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-building-2" class="size-4 shrink-0" />
                        <span class="truncate">{{ account.bank_name || 'Banco não informado' }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-wallet" class="size-4 shrink-0" />
                        <span class="truncate">{{ formatCurrency(account.initial_balance as number | null) }}</span>
                      </div>
                      <div v-if="account.branch" class="flex items-center gap-2">
                        <UIcon name="i-lucide-git-branch" class="size-4 shrink-0" />
                        <span class="truncate">Ag. {{ account.branch }}</span>
                      </div>
                      <div v-if="account.account_number" class="flex items-center gap-2">
                        <UIcon name="i-lucide-hash" class="size-4 shrink-0" />
                        <span class="truncate">Cta. {{ account.account_number }}</span>
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

  <FinancialAccountsFormModal
    v-model:open="showModal"
    :account="selectedAccount"
    @saved="refresh"
  />

  <AppConfirmModal
    v-model:open="showDeleteModal"
    title="Confirmar exclusão"
    confirm-label="Excluir conta"
    confirm-color="error"
    :loading="isDeleting"
    @confirm="remove(accountPendingDeletion!)"
    @update:open="(v: boolean) => { showDeleteModal = v; if (!v && !isDeleting) accountPendingDeletion = null }"
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir a conta
        <strong class="text-highlighted">{{ accountPendingDeletion?.account_name || 'esta conta' }}</strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>

  <AppConfirmModal
    v-model:open="showBulkDeleteModal"
    title="Excluir contas selecionadas"
    confirm-label="Excluir todas"
    confirm-color="error"
    :loading="isBulkDeleting"
    @confirm="confirmBulkDelete"
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir
        <strong class="text-highlighted">{{ selectedCount }} conta(s)</strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>
</template>
