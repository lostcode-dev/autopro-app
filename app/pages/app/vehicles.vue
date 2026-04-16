<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Veículos' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.VEHICLES_READ))
const canCreate = computed(() => workshop.can(ActionCode.VEHICLES_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.VEHICLES_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.VEHICLES_DELETE))

type Vehicle = Record<string, any>
type Client = { id: string, name: string }

const search = ref('')

const { data, status, refresh } = await useAsyncData(
  () => `vehicles-${search.value}`,
  () => requestFetch<Vehicle[]>('/api/vehicles', {
    headers: requestHeaders,
    query: { search: search.value || undefined }
  }),
  { watch: [search] }
)

const { data: clientsData } = await useAsyncData(
  'vehicles-clients',
  () => requestFetch<{ items: Client[] }>('/api/clients', {
    headers: requestHeaders,
    query: { page_size: 500 }
  })
)

const clientOptions = computed(() =>
  (clientsData.value?.items ?? []).map(c => ({ label: c.name, value: c.id }))
)

// ─── Modal ────────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  client_id: '',
  plate: '',
  brand: '',
  model: '',
  year: '' as string | number,
  color: '',
  mileage: '' as string | number,
  chassis: '',
  fuel_type: '' as string,
  notes: ''
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(v: Vehicle) {
  Object.assign(form, {
    client_id: v.client_id ?? '',
    plate: v.plate ?? '',
    brand: v.brand ?? '',
    model: v.model ?? '',
    year: v.year ?? '',
    color: v.color ?? '',
    mileage: v.mileage ?? '',
    chassis: v.chassis ?? '',
    fuel_type: v.fuel_type ?? '',
    notes: v.notes ?? ''
  })
  isEditing.value = true
  selectedId.value = v.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.client_id || !form.plate) {
    toast.add({ title: 'Cliente e placa são obrigatórios', color: 'warning' })
    return
  }
  isSaving.value = true
  try {
    const body: Record<string, any> = {
      client_id: form.client_id,
      plate: form.plate,
      brand: form.brand || null,
      model: form.model || null,
      year: form.year !== '' ? Number(form.year) : null,
      color: form.color || null,
      mileage: form.mileage !== '' ? Number(form.mileage) : null,
      chassis: form.chassis || null,
      fuel_type: form.fuel_type || null,
      notes: form.notes || null
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/vehicles/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Veículo atualizado', color: 'success' })
    } else {
      await $fetch('/api/vehicles', { method: 'POST', body })
      toast.add({ title: 'Veículo cadastrado', color: 'success' })
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

async function remove(v: Vehicle) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/vehicles/${v.id}`, { method: 'DELETE' })
    toast.add({ title: 'Veículo removido', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

const fuelTypeOptions = [
  { label: 'Gasolina', value: 'gasoline' },
  { label: 'Etanol', value: 'ethanol' },
  { label: 'Flex', value: 'flex' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'GNV', value: 'gnv' },
  { label: 'Elétrico', value: 'electric' },
  { label: 'Híbrido', value: 'hybrid' }
]

const columns = [
  { accessorKey: 'plate', header: 'Placa' },
  { accessorKey: 'brand', header: 'Marca' },
  { accessorKey: 'model', header: 'Modelo' },
  { accessorKey: 'year', header: 'Ano' },
  { accessorKey: 'color', header: 'Cor' },
  {
    id: 'client',
    header: 'Cliente',
    cell: ({ row }: { row: { original: Vehicle } }) =>
      row.original.clients?.name ?? row.original.client_id ?? '-'
  },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Veículos">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Novo veículo"
            icon="i-lucide-plus"
            color="neutral"
            @click="openCreate"
          />
        </template>
      </AppPageHeader>
    </template>

    <div v-if="!canRead" class="p-6">
      <p class="text-sm text-muted">
        Você não tem permissão para visualizar veículos.
      </p>
    </div>

    <template v-else>
      <div class="flex flex-wrap gap-3 p-4 border-b border-default">
        <UInput
          v-model="search"
          placeholder="Buscar por placa, marca ou modelo..."
          icon="i-lucide-search"
          class="w-72"
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
  </UDashboardPanel>

  <!-- Modal -->
  <UModal v-model:open="showModal" :title="isEditing ? 'Editar veículo' : 'Novo veículo'" :ui="{ body: 'overflow-y-auto max-h-[70vh]' }">
    <template #body>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="Cliente" required class="sm:col-span-2">
          <USelectMenu
            v-model="form.client_id"
            :items="clientOptions"
            value-key="value"
            searchable
            class="w-full"
            placeholder="Selecionar cliente..."
          />
        </UFormField>
        <UFormField label="Placa" required>
          <UInput v-model="form.plate" class="w-full uppercase" />
        </UFormField>
        <UFormField label="Combustível">
          <USelectMenu
            v-model="form.fuel_type"
            :items="fuelTypeOptions"
            value-key="value"
            class="w-full"
            placeholder="Selecionar..."
          />
        </UFormField>
        <UFormField label="Marca">
          <UInput v-model="form.brand" class="w-full" />
        </UFormField>
        <UFormField label="Modelo">
          <UInput v-model="form.model" class="w-full" />
        </UFormField>
        <UFormField label="Ano">
          <UInput
            v-model="form.year"
            type="number"
            min="1900"
            max="2100"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Cor">
          <UInput v-model="form.color" class="w-full" />
        </UFormField>
        <UFormField label="Quilometragem">
          <UInput
            v-model="form.mileage"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Chassi">
          <UInput v-model="form.chassis" class="w-full uppercase" />
        </UFormField>
        <UFormField label="Observações" class="sm:col-span-2">
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


