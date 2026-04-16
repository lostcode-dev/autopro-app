<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Estoque' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.INVENTORY_READ))
const canCreate = computed(() => workshop.can(ActionCode.INVENTORY_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.INVENTORY_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.INVENTORY_DELETE))

type Part = Record<string, any>
type Supplier = { id: string, name: string }

const search = ref('')
const lowStockOnly = ref(false)

const { data, status, refresh } = await useAsyncData(
  () => `parts-${search.value}-${lowStockOnly.value}`,
  () => requestFetch<Part[]>('/api/parts', {
    headers: requestHeaders,
    query: {
      search: search.value || undefined,
      low_stock: lowStockOnly.value ? 'true' : undefined
    }
  }),
  { watch: [search, lowStockOnly] }
)

const { data: suppliersData } = await useAsyncData(
  'parts-suppliers',
  () => requestFetch<Supplier[]>('/api/suppliers', { headers: requestHeaders })
)

const supplierOptions = computed(() =>
  (suppliersData.value ?? []).map(s => ({ label: s.name, value: s.id }))
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
  supplier_id: '',
  quantity: '' as string | number,
  min_quantity: '' as string | number,
  cost_price: '' as string | number,
  sale_price: '' as string | number,
  location: ''
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(p: Part) {
  Object.assign(form, {
    name: p.name ?? '',
    description: p.description ?? '',
    sku: p.sku ?? '',
    unit: p.unit ?? 'un',
    supplier_id: p.supplier_id ?? '',
    quantity: p.quantity ?? 0,
    min_quantity: p.min_quantity ?? '',
    cost_price: p.cost_price ?? '',
    sale_price: p.sale_price ?? '',
    location: p.location ?? ''
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
      supplier_id: form.supplier_id || null,
      quantity: form.quantity !== '' ? Number(form.quantity) : 0,
      min_quantity: form.min_quantity !== '' ? Number(form.min_quantity) : null,
      cost_price: form.cost_price !== '' ? Number(form.cost_price) : null,
      sale_price: form.sale_price !== '' ? Number(form.sale_price) : null,
      location: form.location || null
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/parts/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Peça atualizada', color: 'success' })
    } else {
      await $fetch('/api/parts', { method: 'POST', body })
      toast.add({ title: 'Peça cadastrada', color: 'success' })
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

async function remove(p: Part) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/parts/${p.id}`, { method: 'DELETE' })
    toast.add({ title: 'Peça removida', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

const unitOptions = [
  { label: 'Unidade', value: 'un' },
  { label: 'Par', value: 'par' },
  { label: 'Kit', value: 'kit' },
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
  { accessorKey: 'quantity', header: 'Estoque' },
  { accessorKey: 'min_quantity', header: 'Mínimo' },
  {
    accessorKey: 'cost_price',
    header: 'Custo',
    cell: ({ row }: { row: { original: Part } }) => formatCurrency(row.original.cost_price)
  },
  {
    id: 'stock_status',
    header: 'Situação',
    cell: ({ row }: { row: { original: Part } }) => {
      const qty = row.original.quantity ?? 0
      const min = row.original.min_quantity
      if (min != null && qty <= min) return 'Estoque baixo'
      return 'Normal'
    }
  },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Estoque">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Nova peça"
            icon="i-lucide-plus"
            color="neutral"
            @click="openCreate"
          />
        </template>
      </AppPageHeader>
    </template>

    <div v-if="!canRead" class="p-6">
      <p class="text-sm text-muted">
        Você não tem permissão para visualizar estoque.
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
        <UCheckbox v-model="lowStockOnly" label="Somente estoque baixo" />
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
        <template #stock_status-cell="{ row }">
          <UBadge
            :color="(row.original.min_quantity != null && (row.original.quantity ?? 0) <= row.original.min_quantity) ? 'warning' : 'success'"
            variant="subtle"
            :label="(row.original.min_quantity != null && (row.original.quantity ?? 0) <= row.original.min_quantity) ? 'Estoque baixo' : 'Normal'"
          />
        </template>
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
  </UDashboardPanel>

  <UModal v-model:open="showModal" :title="isEditing ? 'Editar peça' : 'Nova peça'" :ui="{ body: 'overflow-y-auto max-h-[70vh]' }">
    <template #body>
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
        <UFormField label="Fornecedor">
          <USelectMenu
            v-model="form.supplier_id"
            :items="supplierOptions"
            value-key="value"
            class="w-full"
            placeholder="Nenhum"
            searchable
          />
        </UFormField>
        <UFormField label="Localização">
          <UInput v-model="form.location" class="w-full" placeholder="Ex: Prateleira A1" />
        </UFormField>
        <UFormField label="Quantidade em estoque">
          <UInput
            v-model="form.quantity"
            type="number"
            min="0"
            step="1"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Estoque mínimo">
          <UInput
            v-model="form.min_quantity"
            type="number"
            min="0"
            step="1"
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
        <UFormField label="Preço de venda">
          <UInput
            v-model="form.sale_price"
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


