<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Impostos' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canView = computed(() => workshop.can(ActionCode.TAXES_VIEW))
const canUpdate = computed(() => workshop.can(ActionCode.TAXES_UPDATE))

type Tax = Record<string, any>

const { data, status, refresh } = await useAsyncData(
  'taxes-list',
  () => requestFetch<Tax[]>('/api/taxes', { headers: requestHeaders })
)

// ─── Modal ────────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  name: '',
  type: '',
  rate: '' as string | number,
  description: '',
  is_default: false,
  is_active: true
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(t: Tax) {
  Object.assign(form, {
    name: t.name ?? '',
    type: t.type ?? '',
    rate: t.rate ?? '',
    description: t.description ?? '',
    is_default: t.is_default ?? false,
    is_active: t.is_active ?? true
  })
  isEditing.value = true
  selectedId.value = t.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.name) { toast.add({ title: 'Nome obrigatório', color: 'warning' }); return }
  isSaving.value = true
  try {
    const body: Record<string, any> = {
      name: form.name,
      type: form.type || null,
      rate: form.rate !== '' ? Number(form.rate) : null,
      description: form.description || null,
      is_default: form.is_default,
      is_active: form.is_active
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/taxes/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Imposto atualizado', color: 'success' })
    } else {
      await $fetch('/api/taxes', { method: 'POST', body })
      toast.add({ title: 'Imposto criado', color: 'success' })
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

async function remove(t: Tax) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/taxes/${t.id}`, { method: 'DELETE' })
    toast.add({ title: 'Imposto removido', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

const taxTypeOptions = [
  { label: 'ISS', value: 'iss' },
  { label: 'ICMS', value: 'icms' },
  { label: 'PIS', value: 'pis' },
  { label: 'COFINS', value: 'cofins' },
  { label: 'IPI', value: 'ipi' },
  { label: 'Outro', value: 'other' }
]

const columns = [
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'type', header: 'Tipo' },
  {
    accessorKey: 'rate',
    header: 'Alíquota (%)',
    cell: ({ row }: { row: { original: Tax } }) =>
      row.original.rate != null ? `${row.original.rate}%` : '-'
  },
  {
    accessorKey: 'is_default',
    header: 'Padrão',
    cell: ({ row }: { row: { original: Tax } }) => row.original.is_default ? 'Sim' : 'Não'
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }: { row: { original: Tax } }) => row.original.is_active ? 'Ativo' : 'Inativo'
  },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Impostos">
        <template #right>
          <UButton
            v-if="canUpdate"
            label="Novo imposto"
            icon="i-lucide-plus"
            color="neutral"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <div v-if="!canView" class="p-6">
      <p class="text-sm text-muted">
        Você não tem permissão para visualizar impostos.
      </p>
    </div>

    <template v-else>
      <div v-if="status === 'pending'" class="p-4 space-y-3">
        <USkeleton v-for="i in 5" :key="i" class="h-10 w-full" />
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
              v-if="canUpdate"
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

  <UModal v-model:open="showModal" :title="isEditing ? 'Editar imposto' : 'Novo imposto'">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nome" required>
          <UInput v-model="form.name" class="w-full" />
        </UFormField>
        <UFormField label="Tipo">
          <USelectMenu
            v-model="form.type"
            :items="taxTypeOptions"
            value-key="value"
            class="w-full"
            placeholder="Selecionar..."
          />
        </UFormField>
        <UFormField label="Alíquota (%)">
          <UInput
            v-model="form.rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Descrição">
          <UTextarea v-model="form.description" class="w-full" :rows="3" />
        </UFormField>
        <div class="flex gap-4">
          <UCheckbox v-model="form.is_default" label="Imposto padrão" />
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
