<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { RowSelectionState, SortingState } from '@tanstack/table-core'
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Produtos' })

type ViewMode = 'table' | 'card'
type ProductTypeFilter = 'all' | 'unit' | 'group'
type InventoryFilter = 'all' | 'tracked' | 'not_tracked'

type ProductCategory = {
  id: string
  name: string
}

type ProductItem = {
  id: string
  name: string
  code: string
  type: 'unit' | 'group'
  category_id: string | null
  track_inventory: boolean
  initial_stock_quantity: number | null
  unit_sale_price: number | null
  unit_cost_price: number | null
  notes: string | null
  product_categories?: ProductCategory | null
}

type ProductsResponse = {
  items: ProductItem[]
  total: number
  page: number
  page_size: number
}

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const MANAGED_QUERY_KEYS = [
  'search',
  'type',
  'inventory',
  'category',
  'page',
  'pageSize',
  'view',
  'sortBy',
  'sortOrder'
] as const

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const route = useRoute()
const router = useRouter()

const canRead = computed(() => workshop.can(ActionCode.PRODUCTS_READ))
const canCreate = computed(() => workshop.can(ActionCode.PRODUCTS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.PRODUCTS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.PRODUCTS_DELETE))

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

function parseProductType(value: unknown): ProductTypeFilter {
  return value === 'unit' || value === 'group' ? value : 'all'
}

function parseInventoryFilter(value: unknown): InventoryFilter {
  return value === 'tracked' || value === 'not_tracked' ? value : 'all'
}

const search = ref(typeof route.query.search === 'string' ? route.query.search : '')
const debouncedSearch = ref(search.value)
const typeFilter = ref<ProductTypeFilter>(parseProductType(route.query.type))
const inventoryFilter = ref<InventoryFilter>(parseInventoryFilter(route.query.inventory))
const categoryFilter = ref(typeof route.query.category === 'string' ? route.query.category : 'all')
const page = ref(parsePage(route.query.page))
const pageSize = ref(parsePageSize(route.query.pageSize))
const viewMode = ref<ViewMode>(parseView(route.query.view))

const DEFAULT_SORT = { id: 'name', desc: false }
const sorting = ref<SortingState>(
  typeof route.query.sortBy === 'string' && route.query.sortBy
    ? [{ id: route.query.sortBy, desc: route.query.sortOrder === 'desc' }]
    : [DEFAULT_SORT]
)

const requestQuery = computed(() => ({
  search: debouncedSearch.value || undefined,
  type: typeFilter.value !== 'all' ? typeFilter.value : undefined,
  track_inventory:
    inventoryFilter.value === 'tracked'
      ? 'true'
      : inventoryFilter.value === 'not_tracked'
        ? 'false'
        : undefined,
  category_id: categoryFilter.value !== 'all' ? categoryFilter.value : undefined,
  page: page.value,
  page_size: pageSize.value,
  sort_by: sorting.value[0]?.id || undefined,
  sort_order: sorting.value[0]?.desc ? 'desc' : 'asc'
}))

const { data, status, refresh } = await useAsyncData(
  () => `products-${debouncedSearch.value}-${typeFilter.value}-${inventoryFilter.value}-${categoryFilter.value}-${page.value}-${pageSize.value}-${sorting.value[0]?.id}-${sorting.value[0]?.desc}`,
  async () => {
    if (!canRead.value) {
      return {
        items: [],
        total: 0,
        page: 1,
        page_size: pageSize.value
      } satisfies ProductsResponse
    }

    return requestFetch<ProductsResponse>('/api/products', {
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

const { data: categoriesData } = await useAsyncData(
  'products-categories-options',
  () => requestFetch<ProductCategory[]>('/api/product-categories', { headers: requestHeaders }),
  { default: () => [] }
)

const productItems = computed(() => data.value?.items ?? [])
const totalProducts = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalProducts.value / pageSize.value)))

const categoryOptions = computed(() => [
  { label: 'Todas as categorias', value: 'all' },
  ...(categoriesData.value ?? []).map(category => ({
    label: category.name,
    value: category.id
  }))
])

function buildManagedQuery() {
  return {
    search: search.value || undefined,
    type: typeFilter.value !== 'all' ? typeFilter.value : undefined,
    inventory: inventoryFilter.value !== 'all' ? inventoryFilter.value : undefined,
    category: categoryFilter.value !== 'all' ? categoryFilter.value : undefined,
    page: page.value > 1 ? String(page.value) : undefined,
    pageSize: pageSize.value !== DEFAULT_PAGE_SIZE ? String(pageSize.value) : undefined,
    view: viewMode.value !== 'table' ? viewMode.value : undefined,
    sortBy: sorting.value[0]?.id || undefined,
    sortOrder: sorting.value[0]?.desc ? 'desc' : undefined
  }
}

async function syncQuery() {
  const nextQuery = Object.fromEntries(
    Object.entries(route.query).filter(
      ([key]) => !MANAGED_QUERY_KEYS.includes(key as (typeof MANAGED_QUERY_KEYS)[number])
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
    const nextType = parseProductType(query.type)
    const nextInventory = parseInventoryFilter(query.inventory)
    const nextCategory = typeof query.category === 'string' ? query.category : 'all'
    const nextPage = parsePage(query.page)
    const nextPageSize = parsePageSize(query.pageSize)
    const nextView = parseView(query.view)

    if (search.value !== nextSearch) {
      search.value = nextSearch
      debouncedSearch.value = nextSearch
    }

    if (typeFilter.value !== nextType)
      typeFilter.value = nextType

    if (inventoryFilter.value !== nextInventory)
      inventoryFilter.value = nextInventory

    if (categoryFilter.value !== nextCategory)
      categoryFilter.value = nextCategory

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
    } else if (!currentSort || currentSort.id !== DEFAULT_SORT.id || currentSort.desc !== DEFAULT_SORT.desc) {
      sorting.value = [DEFAULT_SORT]
    }
  }
)

watchDebounced(
  search,
  async (value) => {
    debouncedSearch.value = value
    page.value = 1
    await syncQuery()
  },
  { debounce: 300, maxWait: 800 }
)

watch(typeFilter, async () => {
  page.value = 1
  await syncQuery()
})

watch(inventoryFilter, async () => {
  page.value = 1
  await syncQuery()
})

watch(categoryFilter, async () => {
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

function formatCurrency(value: number | null) {
  if (value == null)
    return '-'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function getProductTypeLabel(type: ProductItem['type']) {
  return type === 'group' ? 'Grupo' : 'Unitário'
}

function getStockSummary(product: ProductItem) {
  if (!product.track_inventory)
    return 'Sem controle de estoque'

  return `${product.initial_stock_quantity ?? 0} un`
}

const showModal = ref(false)
const selectedProduct = ref<ProductItem | null>(null)
const isSaving = ref(false)
const isDeleting = ref(false)
const showDeleteModal = ref(false)
const showBulkDeleteModal = ref(false)
const productPendingDeletion = ref<ProductItem | null>(null)
const isBulkDeleting = ref(false)

const form = reactive({
  name: '',
  code: '',
  type: 'unit' as ProductItem['type'],
  category_id: '',
  track_inventory: true,
  initial_stock_quantity: 0,
  unit_sale_price: '' as number | string,
  unit_cost_price: '' as number | string,
  notes: ''
})

function resetForm() {
  Object.assign(form, {
    name: '',
    code: '',
    type: 'unit',
    category_id: '',
    track_inventory: true,
    initial_stock_quantity: 0,
    unit_sale_price: '',
    unit_cost_price: '',
    notes: ''
  })
}

function openCreate() {
  selectedProduct.value = null
  resetForm()
  showModal.value = true
}

function openEdit(product: ProductItem) {
  selectedProduct.value = product
  Object.assign(form, {
    name: product.name ?? '',
    code: product.code ?? '',
    type: product.type ?? 'unit',
    category_id: product.category_id ?? '',
    track_inventory: product.track_inventory ?? false,
    initial_stock_quantity: product.initial_stock_quantity ?? 0,
    unit_sale_price: product.unit_sale_price ?? '',
    unit_cost_price: product.unit_cost_price ?? '',
    notes: product.notes ?? ''
  })
  showModal.value = true
}

async function save() {
  if (isSaving.value)
    return

  if (!form.name.trim() || !form.code.trim()) {
    toast.add({
      title: 'Preencha nome e código do produto',
      color: 'warning'
    })
    return
  }

  isSaving.value = true

  try {
    const body = {
      name: form.name.trim(),
      code: form.code.trim(),
      type: form.type,
      category_id: form.category_id || null,
      track_inventory: form.type === 'unit' ? form.track_inventory : false,
      initial_stock_quantity: form.type === 'unit' && form.track_inventory
        ? Number(form.initial_stock_quantity || 0)
        : 0,
      unit_sale_price: form.unit_sale_price === '' ? null : Number(form.unit_sale_price),
      unit_cost_price: form.unit_cost_price === '' ? null : Number(form.unit_cost_price),
      notes: form.notes || null
    }

    if (selectedProduct.value?.id) {
      await $fetch(`/api/products/${selectedProduct.value.id}`, {
        method: 'PUT',
        body
      })
      toast.add({ title: 'Produto atualizado', color: 'success' })
    } else {
      await $fetch('/api/products', {
        method: 'POST',
        body
      })
      toast.add({ title: 'Produto criado', color: 'success' })
    }

    showModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao salvar produto',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

function requestRemove(product: ProductItem) {
  if (isDeleting.value)
    return

  productPendingDeletion.value = product
  showDeleteModal.value = true
}

async function remove(product: ProductItem) {
  if (isDeleting.value)
    return

  isDeleting.value = true

  try {
    await $fetch(`/api/products/${product.id}`, { method: 'DELETE' })
    toast.add({ title: 'Produto removido', color: 'success' })
    showDeleteModal.value = false
    productPendingDeletion.value = null

    if (productItems.value.length === 1 && page.value > 1)
      page.value -= 1

    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao remover produto',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isDeleting.value = false
  }
}

async function confirmRemove() {
  if (!productPendingDeletion.value)
    return

  await remove(productPendingDeletion.value)
}

const rowSelection = ref<RowSelectionState>({})
const selectedIds = computed(() =>
  Object.entries(rowSelection.value)
    .filter(([, value]) => value)
    .map(([id]) => id)
)
const selectedCount = computed(() => selectedIds.value.length)

watch(viewMode, () => {
  rowSelection.value = {}
})

async function confirmBulkDelete() {
  if (!selectedIds.value.length || isBulkDeleting.value)
    return

  isBulkDeleting.value = true

  try {
    await Promise.all(
      selectedIds.value.map(id => $fetch(`/api/products/${id}`, { method: 'DELETE' }))
    )

    toast.add({
      title: `${selectedIds.value.length} produto(s) removido(s)`,
      color: 'success'
    })

    rowSelection.value = {}
    showBulkDeleteModal.value = false
    await refresh()
  } catch {
    toast.add({
      title: 'Erro ao excluir produtos',
      color: 'error'
    })
  } finally {
    isBulkDeleting.value = false
  }
}

async function exportCsv() {
  try {
    const all = await $fetch<ProductsResponse>('/api/products', {
      query: {
        search: debouncedSearch.value || undefined,
        type: typeFilter.value !== 'all' ? typeFilter.value : undefined,
        track_inventory:
          inventoryFilter.value === 'tracked'
            ? 'true'
            : inventoryFilter.value === 'not_tracked'
              ? 'false'
              : undefined,
        category_id: categoryFilter.value !== 'all' ? categoryFilter.value : undefined,
        page: 1,
        page_size: 2000,
        sort_by: sorting.value[0]?.id || undefined,
        sort_order: sorting.value[0]?.desc ? 'desc' : 'asc'
      }
    })

    if (!all.items.length) {
      toast.add({ title: 'Nenhum produto para exportar', color: 'warning' })
      return
    }

    const headers = [
      'nome',
      'codigo',
      'tipo',
      'categoria',
      'controla_estoque',
      'estoque_inicial',
      'preco_venda',
      'preco_custo',
      'observacoes'
    ]

    const rows = all.items.map(item => [
      item.name,
      item.code,
      item.type,
      item.product_categories?.name ?? '',
      item.track_inventory ? 'sim' : 'nao',
      item.initial_stock_quantity ?? 0,
      item.unit_sale_price ?? '',
      item.unit_cost_price ?? '',
      item.notes ?? ''
    ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `produtos_${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.add({ title: 'Erro ao exportar produtos', color: 'error' })
  }
}

const typeFilterOptions = [
  { label: 'Todos os tipos', value: 'all' },
  { label: 'Unitário', value: 'unit' },
  { label: 'Grupo', value: 'group' }
]

const inventoryFilterOptions = [
  { label: 'Todo o catálogo', value: 'all' },
  { label: 'Com estoque', value: 'tracked' },
  { label: 'Sem estoque', value: 'not_tracked' }
]

const productTypeOptions = [
  { label: 'Unitário', value: 'unit' },
  { label: 'Grupo', value: 'group' }
]

const lineColumns = [
  { accessorKey: 'name', header: 'Produto', enableSorting: true },
  { accessorKey: 'code', header: 'Código', enableSorting: true },
  { accessorKey: 'type', header: 'Tipo', enableSorting: true },
  { accessorKey: 'track_inventory', header: 'Estoque', enableSorting: true },
  { accessorKey: 'unit_sale_price', header: 'Venda', enableSorting: true },
  { id: 'actions', header: 'Ações', enableSorting: false }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Produtos" />
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">
          Você não tem permissão para visualizar produtos.
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
            :data="productItems"
            :loading="status === 'pending'"
            :loading-variant="viewMode === 'card' ? 'card' : 'row'"
            :selectable="viewMode === 'table'"
            :sticky-header="viewMode === 'table'"
            :get-row-id="(row) => String(row.id ?? '')"
            :page-size-options="PAGE_SIZE_OPTIONS"
            :total="totalProducts"
            search-placeholder="Buscar por nome ou código..."
            :show-search="true"
            :show-view-mode-toggle="true"
            card-grid-class="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2"
            empty-icon="i-lucide-package-search"
            empty-title="Nenhum produto encontrado"
            empty-description="Cadastre um produto ou ajuste os filtros para continuar."
          >
            <template #toolbar-right>
              <UTooltip text="Exportar produtos">
                <UButton
                  icon="i-lucide-download"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  @click="exportCsv"
                />
              </UTooltip>

              <UTooltip
                v-if="canDelete"
                :text="selectedCount > 0 ? `Excluir ${selectedCount} selecionado(s)` : 'Excluir seleção'"
              >
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="outline"
                  size="sm"
                  :disabled="selectedCount === 0"
                  @click="showBulkDeleteModal = true"
                />
              </UTooltip>

              <UButton
                v-if="canCreate"
                label="Novo produto"
                icon="i-lucide-plus"
                size="sm"
                @click="openCreate"
              />
            </template>

            <template #filters>
              <USelectMenu
                v-model="typeFilter"
                :items="typeFilterOptions"
                value-key="value"
                class="w-full sm:w-44"
                :search-input="false"
              />

              <USelectMenu
                v-model="inventoryFilter"
                :items="inventoryFilterOptions"
                value-key="value"
                class="w-full sm:w-44"
                :search-input="false"
              />

              <USelectMenu
                v-model="categoryFilter"
                :items="categoryOptions"
                value-key="value"
                class="w-full sm:w-56"
                searchable
              />
            </template>

            <template #name-cell="{ row }">
              <div class="min-w-0 space-y-1">
                <p class="truncate font-semibold text-highlighted">
                  {{ row.original.name }}
                </p>
                <p class="truncate text-xs text-muted">
                  {{ row.original.product_categories?.name || 'Sem categoria' }}
                </p>
              </div>
            </template>

            <template #type-cell="{ row }">
              <UBadge
                :label="getProductTypeLabel(row.original.type)"
                color="neutral"
                variant="subtle"
                size="xs"
              />
            </template>

            <template #track_inventory-cell="{ row }">
              <div class="min-w-0 space-y-1">
                <UBadge
                  :label="row.original.track_inventory ? 'Controlado' : 'Livre'"
                  :color="row.original.track_inventory ? 'success' : 'neutral'"
                  variant="subtle"
                  size="xs"
                />
                <p class="text-xs text-muted">
                  {{ getStockSummary(row.original as ProductItem) }}
                </p>
              </div>
            </template>

            <template #unit_sale_price-cell="{ row }">
              <span class="text-sm text-muted">
                {{ formatCurrency(row.original.unit_sale_price) }}
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
                  @click="openEdit(row.original as ProductItem)"
                />

                <UButton
                  v-if="canDelete"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :loading="isDeleting"
                  @click="requestRemove(row.original as ProductItem)"
                />
              </div>
            </template>

            <template #card="{ item: product }">
              <UCard class="border border-default/80 shadow-sm">
                <div class="space-y-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 space-y-2">
                      <h3 class="truncate text-base font-semibold text-highlighted">
                        {{ product.name }}
                      </h3>
                      <div class="flex flex-wrap items-center gap-2">
                        <UBadge
                          :label="getProductTypeLabel(product.type)"
                          color="neutral"
                          variant="subtle"
                          size="xs"
                        />
                        <UBadge
                          :label="product.track_inventory ? 'Estoque controlado' : 'Sem estoque'"
                          :color="product.track_inventory ? 'success' : 'neutral'"
                          variant="subtle"
                          size="xs"
                        />
                      </div>
                    </div>

                    <div class="flex shrink-0 items-center gap-1">
                      <UTooltip v-if="canUpdate" text="Editar produto">
                        <UButton
                          icon="i-lucide-pencil"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          @click="openEdit(product as ProductItem)"
                        />
                      </UTooltip>

                      <UTooltip v-if="canDelete" text="Excluir produto">
                        <UButton
                          icon="i-lucide-trash-2"
                          color="error"
                          variant="ghost"
                          size="xs"
                          :loading="isDeleting"
                          @click="requestRemove(product as ProductItem)"
                        />
                      </UTooltip>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-2 text-sm text-muted sm:grid-cols-2">
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-scan-line" class="size-4 shrink-0" />
                      <span class="truncate">{{ product.code }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-folder-tree" class="size-4 shrink-0" />
                      <span class="truncate">{{ product.product_categories?.name || 'Sem categoria' }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-badge-dollar-sign" class="size-4 shrink-0" />
                      <span class="truncate">{{ formatCurrency(product.unit_sale_price) }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-box" class="size-4 shrink-0" />
                      <span class="truncate">{{ getStockSummary(product as ProductItem) }}</span>
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

  <UModal
    v-model:open="showModal"
    :title="selectedProduct ? 'Editar produto' : 'Novo produto'"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Nome" required class="sm:col-span-2">
            <UInput v-model="form.name" class="w-full" />
          </UFormField>

          <UFormField label="Código" required>
            <UInput v-model="form.code" class="w-full" />
          </UFormField>

          <UFormField label="Tipo">
            <USelectMenu
              v-model="form.type"
              :items="productTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Categoria" class="sm:col-span-2">
            <USelectMenu
              v-model="form.category_id"
              :items="categoryOptions.filter(option => option.value !== 'all')"
              value-key="value"
              class="w-full"
              searchable
              placeholder="Sem categoria"
            />
          </UFormField>

          <UFormField label="Preço de venda">
            <UInput
              v-model="form.unit_sale_price"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Preço de custo">
            <UInput
              v-model="form.unit_cost_price"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="form.type === 'unit' && form.track_inventory"
            label="Estoque inicial"
          >
            <UInput
              v-model="form.initial_stock_quantity"
              type="number"
              min="0"
              step="1"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Observações" class="sm:col-span-2">
            <UTextarea v-model="form.notes" class="w-full" :rows="3" />
          </UFormField>
        </div>

        <div v-if="form.type === 'unit'" class="flex gap-4">
          <UCheckbox v-model="form.track_inventory" label="Controlar estoque" />
        </div>
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
          :loading="isSaving"
          :disabled="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>

  <AppConfirmModal
    v-model:open="showDeleteModal"
    title="Confirmar exclusão"
    confirm-label="Excluir produto"
    confirm-color="error"
    :loading="isDeleting"
    @confirm="confirmRemove"
    @update:open="
      (value: boolean) => {
        showDeleteModal = value
        if (!value && !isDeleting) productPendingDeletion = null
      }
    "
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir
        <strong class="text-highlighted">
          {{ productPendingDeletion?.name || 'este produto' }}
        </strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>

  <AppConfirmModal
    v-model:open="showBulkDeleteModal"
    title="Excluir produtos selecionados"
    confirm-label="Excluir todos"
    confirm-color="error"
    :loading="isBulkDeleting"
    @confirm="confirmBulkDelete"
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir
        <strong class="text-highlighted">{{ selectedCount }} produto(s)</strong>?
        Esta ação não pode ser desfeita.
      </p>
    </template>
  </AppConfirmModal>
</template>
