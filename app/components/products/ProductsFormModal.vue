<script setup lang="ts">
import type { ProductItem, ProductCategory, GroupItem } from '~/types/products'

const props = defineProps<{
  open: boolean
  product: ProductItem | null
  cloneFrom: ProductItem | null
  categories: ProductCategory[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const toast = useToast()
const isSaving = ref(false)

const productTypeOptions = [
  { label: 'Unitário', value: 'unit' },
  { label: 'Grupo', value: 'group' }
]

const categoryOptions = computed(() =>
  (props.categories ?? []).map(c => ({ label: c.name, value: c.id }))
)

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

const groupItems = ref<GroupItem[]>([])

function createEmptyGroupItem(): GroupItem {
  return {
    description: '',
    quantity: 1,
    unit: 'un',
    cost_price: 0,
    sale_price: 0,
    track_inventory: false,
    initial_stock_quantity: 0
  }
}

function resetForm() {
  Object.assign(form, {
    name: '',
    code: generateCode('P'),
    type: 'unit',
    category_id: '',
    track_inventory: true,
    initial_stock_quantity: 0,
    unit_sale_price: '',
    unit_cost_price: '',
    notes: ''
  })
  groupItems.value = []
}

function populateFromProduct(source: ProductItem, clone = false) {
  Object.assign(form, {
    name: clone ? `${source.name} (Cópia)` : (source.name ?? ''),
    code: clone ? generateCode('P') : (source.code ?? ''),
    type: source.type ?? 'unit',
    category_id: source.category_id ?? '',
    track_inventory: source.track_inventory ?? false,
    initial_stock_quantity: source.initial_stock_quantity ?? 0,
    unit_sale_price: source.unit_sale_price ?? '',
    unit_cost_price: source.unit_cost_price ?? '',
    notes: source.notes ?? ''
  })
  groupItems.value = source.group_items ? [...source.group_items] : []
}

watch(
  () => form.type,
  (type, previousType) => {
    if (type === previousType)
      return

    if (type === 'group') {
      if (!groupItems.value.length)
        groupItems.value = [createEmptyGroupItem()]
      return
    }

    groupItems.value = []
  }
)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen)
      return

    if (props.product) {
      populateFromProduct(props.product)
    } else if (props.cloneFrom) {
      populateFromProduct(props.cloneFrom, true)
    } else {
      resetForm()
    }
  }
)

async function save() {
  if (isSaving.value)
    return

  if (!form.name.trim() || !form.code.trim()) {
    toast.add({ title: 'Preencha nome e código do produto', color: 'warning' })
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
      initial_stock_quantity:
        form.type === 'unit' && form.track_inventory
          ? Number(form.initial_stock_quantity || 0)
          : 0,
      unit_sale_price:
        form.type === 'unit'
          ? (form.unit_sale_price === '' ? null : Number(form.unit_sale_price))
          : null,
      unit_cost_price:
        form.type === 'unit'
          ? (form.unit_cost_price === '' ? null : Number(form.unit_cost_price))
          : null,
      group_items: form.type === 'group' ? groupItems.value : null,
      notes: form.notes || null
    }

    if (props.product?.id) {
      await $fetch(`/api/products/${props.product.id}`, { method: 'PUT', body })
      toast.add({ title: 'Produto atualizado', color: 'success' })
    } else {
      await $fetch('/api/products', { method: 'POST', body })
      toast.add({ title: 'Produto criado', color: 'success' })
    }

    emit('update:open', false)
    emit('saved')
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
</script>

<template>
  <UModal
    :open="open"
    :title="product ? 'Editar produto' : 'Novo produto'"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
    @update:open="emit('update:open', $event)"
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
              :items="categoryOptions"
              value-key="value"
              class="w-full"
              searchable
              placeholder="Sem categoria"
            />
          </UFormField>

          <UFormField v-if="form.type === 'unit'" label="Preço de venda">
            <UiCurrencyInput v-model="form.unit_sale_price" />
          </UFormField>

          <UFormField v-if="form.type === 'unit'" label="Preço de custo">
            <UiCurrencyInput v-model="form.unit_cost_price" />
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

        <ProductsGroupItems v-if="form.type === 'group'" v-model="groupItems" />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="emit('update:open', false)"
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
</template>
