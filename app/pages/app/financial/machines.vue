<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Maquininhas' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canView = computed(() => workshop.can(ActionCode.PAYMENT_MACHINES_VIEW))
const canUpdate = computed(() => workshop.can(ActionCode.PAYMENT_MACHINES_UPDATE))

type Terminal = Record<string, any>

const { data, status, refresh } = await useAsyncData(
  'terminals-list',
  () => requestFetch<Terminal[]>('/api/payment-terminals', { headers: requestHeaders })
)

// ─── Modal ────────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  name: '',
  provider: '',
  serial_number: '',
  fee_type: 'percentage' as string,
  fee_value: '' as string | number,
  is_active: true,
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(t: Terminal) {
  Object.assign(form, {
    name: t.name ?? '',
    provider: t.provider ?? '',
    serial_number: t.serial_number ?? '',
    fee_type: t.fee_type ?? 'percentage',
    fee_value: t.fee_value ?? '',
    is_active: t.is_active ?? true,
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
      provider: form.provider || null,
      serial_number: form.serial_number || null,
      fee_type: form.fee_type || null,
      fee_value: form.fee_value !== '' ? Number(form.fee_value) : null,
      is_active: form.is_active,
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/payment-terminals/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Maquininha atualizada', color: 'success' })
    } else {
      await $fetch('/api/payment-terminals', { method: 'POST', body })
      toast.add({ title: 'Maquininha cadastrada', color: 'success' })
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

async function remove(t: Terminal) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/payment-terminals/${t.id}`, { method: 'DELETE' })
    toast.add({ title: 'Maquininha removida', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

const feeTypeOptions = [
  { label: 'Percentual (%)', value: 'percentage' },
  { label: 'Fixo (R$)', value: 'fixed' },
]

const columns = [
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'provider', header: 'Operadora' },
  { accessorKey: 'serial_number', header: 'Série' },
  {
    id: 'fee',
    header: 'Taxa',
    cell: ({ row }: { row: { original: Terminal } }) => {
      const val = row.original.fee_value
      if (val == null) return '-'
      return row.original.fee_type === 'percentage' ? `${val}%` : `R$ ${val}`
    }
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }: { row: { original: Terminal } }) => row.original.is_active ? 'Ativa' : 'Inativa'
  },
  { id: 'actions', header: '' },
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Maquininhas">
        <template #right>
          <UButton v-if="canUpdate" label="Nova maquininha" icon="i-lucide-plus" color="neutral" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <div v-if="!canView" class="p-6">
      <p class="text-sm text-muted">Você não tem permissão para visualizar maquininhas.</p>
    </div>

    <template v-else>
      <div v-if="status === 'pending'" class="p-4 space-y-3">
        <USkeleton v-for="i in 5" :key="i" class="h-10 w-full" />
      </div>

      <UTable v-else :columns="columns" :data="data || []" class="min-h-0 flex-1">
        <template #actions-cell="{ row }">
          <div class="flex items-center gap-2 justify-end">
            <UButton v-if="canUpdate" icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(row.original)" />
            <UButton v-if="canUpdate" icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" :loading="isDeleting" @click="remove(row.original)" />
          </div>
        </template>
      </UTable>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="showModal" :title="isEditing ? 'Editar maquininha' : 'Nova maquininha'">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nome" required>
          <UInput v-model="form.name" class="w-full" placeholder="Ex: Maquininha Recepção" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Operadora">
            <UInput v-model="form.provider" class="w-full" placeholder="Ex: Stone, Cielo, PagSeguro" />
          </UFormField>
          <UFormField label="Número de série">
            <UInput v-model="form.serial_number" class="w-full" />
          </UFormField>
          <UFormField label="Tipo de taxa">
            <USelectMenu v-model="form.fee_type" :items="feeTypeOptions" value-key="value" class="w-full" />
          </UFormField>
          <UFormField :label="form.fee_type === 'percentage' ? 'Taxa (%)' : 'Taxa (R$)'">
            <UInput v-model="form.fee_value" type="number" min="0" step="0.01" class="w-full" />
          </UFormField>
        </div>
        <UCheckbox v-model="form.is_active" label="Ativa" />
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Cancelar" color="neutral" variant="ghost" @click="showModal = false" />
        <UButton label="Salvar" color="neutral" :loading="isSaving" :disabled="isSaving" @click="save" />
      </div>
    </template>
  </UModal>
</template>
