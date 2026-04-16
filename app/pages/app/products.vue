<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Produtos' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.PRODUCTS_READ))
const canCreate = computed(() => workshop.can(ActionCode.PRODUCTS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.PRODUCTS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.PRODUCTS_DELETE))

type Product = Record<string, any>
type Category = { id: string, name: string }
const ALL_PRODUCT_TYPES_VALUE = 'all'

const search = ref('')
const isServiceFilter = ref(ALL_PRODUCT_TYPES_VALUE)

const { data, status, refresh } = await useAsyncData(
  () => `products-${search.value}-${isServiceFilter.value}`,
  () => requestFetch<Product[]>('/api/products', {
    headers: requestHeaders,
    query: {
      search: search.value || undefined,
      is_service: isServiceFilter.value !== ALL_PRODUCT_TYPES_VALUE ? isServiceFilter.value === 'true' : undefined
    }
  }),
  { watch: [search, isServiceFilter] }
)

const { data: categoriesData } = await useAsyncData(
  'product-categories',
  () => requestFetch<Category[]>('/api/product-categories', { headers: requestHeaders })
)

const categoryOptions = computed(() =>
  (categoriesData.value ?? []).map(c => ({ label: c.name, value: c.id }))
)

// ─── Modal ────────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  name: '',
  description: '',
  sku: '',
  unit: 'un',
  category_id: '',
  sale_price: '' as string | number,
  cost_price: '' as string | number,
  is_service: false,
  is_active: true
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(p: Product) {
  Object.assign(form, {
    name: p.name ?? '',
    description: p.description ?? '',
    sku: p.sku ?? '',
    unit: p.unit ?? 'un',
    category_id: p.category_id ?? '',
    sale_price: p.sale_price ?? '',
    cost_price: p.cost_price ?? '',
    is_service: p.is_service ?? false,
    is_active: p.is_active ?? true
  })
  isEditing.value = true
  selectedId.value = p.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.name) { toast.add({ title: 'Nome obrigatório', color: 'warning' }); return }
  isSaving.value = true
  try {
    const body: Record<string, any> = {
      name: form.name,
      description: form.description || null,
      sku: form.sku || null,
      unit: form.unit || 'un',
      category_id: form.category_id || null,
      sale_price: form.sale_price !== '' ? Number(form.sale_price) : null,
      cost_price: form.cost_price !== '' ? Number(form.cost_price) : null,
      is_service: form.is_service,
      is_active: form.is_active
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/products/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Produto atualizado', color: 'success' })
    } else {
      await $fetch('/api/products', { method: 'POST', body })
      toast.add({ title: 'Produto criado', color: 'success' })
    }
    showModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

async function remove(p: Product) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/products/${p.id}`, { method: 'DELETE' })
    toast.add({ title: 'Produto removido', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

const typeFilterOptions = [
  { label: 'Todos', value: ALL_PRODUCT_TYPES_VALUE },
  { label: 'Produto', value: 'false' },
  { label: 'Serviço', value: 'true' }
]

const unitOptions = [
  { label: 'Unidade', value: 'un' },
  { label: 'Par', value: 'par' },
  { label: 'Kit', value: 'kit' },
  { label: 'Hora', value: 'hr' },
  { label: 'Metro', value: 'm' },
  { label: 'Litro', value: 'l' },
  { label: 'Kg', value: 'kg' }
]

const formatCurrency = (val: number | null) =>
  val != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
    : '-'

const columns = [
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'sku', header: 'SKU' },
  {
    id: 'type',
    header: 'Tipo',
    cell: ({ row }: { row: { original: Product } }) => row.original.is_service ? 'Serviço' : 'Produto'
  },
  {
    accessorKey: 'sale_price',
    header: 'Preço de venda',
    cell: ({ row }: { row: { original: Product } }) => formatCurrency(row.original.sale_price)
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }: { row: { original: Product } }) => row.original.is_active ? 'Ativo' : 'Inativo'
  },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Produtos">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Novo produto"
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
          Você não tem permissão para visualizar produtos.
        </p>
      </div>

      <template v-else>
        <div class="flex flex-wrap gap-3 p-4 border-b border-default">
          <UInput
            v-model="search"
            placeholder="Buscar por nome ou SKU..."
            icon="i-lucide-search"
            class="w-72"
          />
          <USelectMenu
            v-model="isServiceFilter"
            :items="typeFilterOptions"
            value-key="value"
            class="w-36"
          />
        </div>

        <div v-if="status === 'pending'" class="p-4 space-y-3">
          <USkeleton v-for="i in 8" :key="i" class="h-10 w-full" />
        </div>

        <UTable
          v-else
          :columns="columns"
          :data="data || []"
          class="min-h-0 flex-1"
        >
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2 justify-end">
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
        </UTable>
      </template>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="showModal" :title="isEditing ? 'Editar produto' : 'Novo produto'" :ui="{ body: 'overflow-y-auto max-h-[70vh]' }">
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Nome" required class="sm:col-span-2">
            <UInput v-model="form.name" class="w-full" />
          </UFormField>
          <UFormField label="SKU">
            <UInput v-model="form.sku" class="w-full" />
          </UFormField>
          <UFormField label="Unidade">
            <USelectMenu
              v-model="form.unit"
              :items="unitOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Categoria">
            <USelectMenu
              v-model="form.category_id"
              :items="categoryOptions"
              value-key="value"
              class="w-full"
              placeholder="Sem categoria"
              searchable
            />
          </UFormField>
          <UFormField label="Preço de venda">
            <UInput
              v-model="form.sale_price"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Preço de custo">
            <UInput
              v-model="form.cost_price"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Descrição" class="sm:col-span-2">
            <UTextarea v-model="form.description" class="w-full" :rows="3" />
          </UFormField>
        </div>
        <div class="flex gap-4">
          <UCheckbox v-model="form.is_service" label="É um serviço" />
          <UCheckbox v-model="form.is_active" label="Ativo" />
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
          color="neutral"
          :loading="isSaving"
          :disabled="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
