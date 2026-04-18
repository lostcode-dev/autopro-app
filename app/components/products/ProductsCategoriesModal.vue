<script setup lang="ts">
import type { ProductCategory } from '~/types/products'

const props = defineProps<{
  open: boolean
  categories: ProductCategory[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'updated': []
}>()

const toast = useToast()

const categoryForm = reactive({ id: '', name: '' })
const isSaving = ref(false)
const isDeleting = ref(false)
const pendingDelete = ref<ProductCategory | null>(null)
const showDeleteConfirm = ref(false)

function resetForm() {
  categoryForm.id = ''
  categoryForm.name = ''
}

function editCategory(cat: ProductCategory) {
  categoryForm.id = cat.id
  categoryForm.name = cat.name
}

async function saveCategory() {
  if (!categoryForm.name.trim() || isSaving.value)
    return

  isSaving.value = true

  try {
    if (categoryForm.id) {
      await $fetch(`/api/product-categories/${categoryForm.id}`, {
        method: 'PUT',
        body: { name: categoryForm.name }
      })
      toast.add({ title: 'Categoria atualizada', color: 'success' })
    } else {
      await $fetch('/api/product-categories', {
        method: 'POST',
        body: { name: categoryForm.name }
      })
      toast.add({ title: 'Categoria criada', color: 'success' })
    }

    resetForm()
    emit('updated')
  } catch {
    toast.add({ title: 'Erro ao salvar categoria', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

function requestDelete(cat: ProductCategory) {
  pendingDelete.value = cat
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value || isDeleting.value)
    return

  isDeleting.value = true

  try {
    await $fetch(`/api/product-categories/${pendingDelete.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Categoria removida', color: 'success' })
    showDeleteConfirm.value = false
    pendingDelete.value = null
    emit('updated')
  } catch {
    toast.add({ title: 'Erro ao remover categoria', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    title="Gerenciar Categorias"
    :ui="{ body: 'overflow-y-auto max-h-[65vh]' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex gap-2">
          <UInput
            v-model="categoryForm.name"
            class="flex-1"
            :placeholder="categoryForm.id ? 'Editar nome...' : 'Nova categoria...'"
            @keydown.enter="saveCategory"
          />
          <UButton
            :label="categoryForm.id ? 'Atualizar' : 'Criar'"
            :loading="isSaving"
            size="sm"
            @click="saveCategory"
          />
          <UButton
            v-if="categoryForm.id"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="resetForm"
          />
        </div>

        <div class="space-y-1.5">
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="flex items-center justify-between rounded-lg border border-default px-3 py-2"
            :class="{ 'border-primary bg-primary/5': categoryForm.id === cat.id }"
          >
            <span class="text-sm text-highlighted">{{ cat.name }}</span>
            <div class="flex gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="editCategory(cat)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                @click="requestDelete(cat)"
              />
            </div>
          </div>

          <div
            v-if="!categories.length"
            class="py-6 text-center text-sm text-muted"
          >
            Nenhuma categoria cadastrada
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton
          label="Fechar"
          color="neutral"
          variant="ghost"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>

  <AppConfirmModal
    v-model:open="showDeleteConfirm"
    title="Excluir categoria"
    confirm-label="Excluir"
    confirm-color="error"
    :loading="isDeleting"
    @confirm="confirmDelete"
    @update:open="
      (value: boolean) => {
        showDeleteConfirm = value
        if (!value && !isDeleting) pendingDelete = null
      }
    "
  >
    <template #description>
      <p class="text-sm text-muted">
        Tem certeza que deseja excluir a categoria
        <strong class="text-highlighted">{{ pendingDelete?.name }}</strong>?
        Produtos vinculados perderão a categoria.
      </p>
    </template>
  </AppConfirmModal>
</template>
