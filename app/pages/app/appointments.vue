<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Agendamentos' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.APPOINTMENTS_READ))
const canCreate = computed(() => workshop.can(ActionCode.APPOINTMENTS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.APPOINTMENTS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.APPOINTMENTS_DELETE))

type Appointment = Record<string, any>

const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 30

const { data, status, refresh } = await useAsyncData(
  () => `appointments-${page.value}-${search.value}-${statusFilter.value}`,
  () => requestFetch<{ items: Appointment[], total: number, page: number, page_size: number }>(
    '/api/appointments',
    {
      headers: requestHeaders,
      query: {
        search: search.value || undefined,
        status: statusFilter.value || undefined,
        page: page.value,
        page_size: pageSize
      }
    }
  ),
  { watch: [page, search, statusFilter] }
)

// Clients and vehicles for the form select fields
const { data: clientsData } = await useAsyncData('appt-clients', () =>
  requestFetch<{ items: any[] }>('/api/clients', { headers: requestHeaders, query: { page_size: 500 } })
)
const { data: vehiclesData } = await useAsyncData('appt-vehicles', () =>
  requestFetch<{ items: any[] }>('/api/vehicles', { headers: requestHeaders, query: { page_size: 500 } })
)

const clientOptions = computed(() =>
  (clientsData.value?.items ?? []).map((c: any) => ({ label: c.name, value: c.id }))
)

const vehicleOptions = computed(() =>
  (vehiclesData.value?.items ?? []).map((v: any) => ({
    label: [v.brand, v.model, v.license_plate].filter(Boolean).join(' - '),
    value: v.id
  }))
)

// ─── Modal ────────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  client_id: '',
  vehicle_id: '',
  appointment_date: '',
  time: '',
  service_type: '',
  priority: '' as string,
  status: 'scheduled' as string,
  notes: ''
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(appt: Appointment) {
  Object.assign(form, {
    client_id: appt.client_id ?? '',
    vehicle_id: appt.vehicle_id ?? '',
    appointment_date: appt.appointment_date ?? '',
    time: appt.time ?? '',
    service_type: appt.service_type ?? '',
    priority: appt.priority ?? '',
    status: appt.status ?? 'scheduled',
    notes: appt.notes ?? ''
  })
  isEditing.value = true
  selectedId.value = appt.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.client_id) { toast.add({ title: 'Cliente obrigatório', color: 'warning' }); return }
  if (!form.vehicle_id) { toast.add({ title: 'Veículo obrigatório', color: 'warning' }); return }
  if (!form.appointment_date) { toast.add({ title: 'Data obrigatória', color: 'warning' }); return }
  if (!form.time) { toast.add({ title: 'Horário obrigatório', color: 'warning' }); return }
  if (!form.service_type) { toast.add({ title: 'Tipo de serviço obrigatório', color: 'warning' }); return }

  isSaving.value = true
  try {
    const body = {
      client_id: form.client_id,
      vehicle_id: form.vehicle_id,
      appointment_date: form.appointment_date,
      time: form.time,
      service_type: form.service_type,
      priority: form.priority || null,
      status: form.status,
      notes: form.notes || null
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/appointments/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Agendamento atualizado', color: 'success' })
    } else {
      await $fetch('/api/appointments', { method: 'POST', body })
      toast.add({ title: 'Agendamento criado', color: 'success' })
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

async function remove(appt: Appointment) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/appointments/${appt.id}`, { method: 'DELETE' })
    toast.add({ title: 'Agendamento removido', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

const statusOptions = [
  { label: 'Todos', value: '' },
  { label: 'Agendado', value: 'scheduled' },
  { label: 'Confirmado', value: 'confirmed' },
  { label: 'Concluído', value: 'completed' },
  { label: 'Cancelado', value: 'cancelled' }
]

const statusFormOptions = [
  { label: 'Agendado', value: 'scheduled' },
  { label: 'Confirmado', value: 'confirmed' },
  { label: 'Concluído', value: 'completed' },
  { label: 'Cancelado', value: 'cancelled' }
]

const priorityOptions = [
  { label: 'Sem prioridade', value: '' },
  { label: 'Baixa', value: 'low' },
  { label: 'Média', value: 'medium' },
  { label: 'Alta', value: 'high' }
]

const statusColorMap: Record<string, string> = {
  scheduled: 'info',
  confirmed: 'success',
  completed: 'neutral',
  cancelled: 'error'
}
const statusLabelMap: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado'
}
const priorityColorMap: Record<string, string> = { low: 'neutral', medium: 'warning', high: 'error' }
const priorityLabelMap: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta' }

const columns = [
  { accessorKey: 'appointment_date', header: 'Data' },
  { accessorKey: 'time', header: 'Horário' },
  { id: 'client', header: 'Cliente' },
  { id: 'vehicle', header: 'Veículo' },
  { accessorKey: 'service_type', header: 'Serviço' },
  { id: 'priority', header: 'Prioridade' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Agendamentos">
        <template #leading>
          <AppSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="canCreate"
            label="Novo agendamento"
            icon="i-lucide-plus"
            color="neutral"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <div v-if="!canRead" class="p-6">
      <p class="text-sm text-muted">
        Você não tem permissão para visualizar agendamentos.
      </p>
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="flex flex-wrap gap-3 p-4 border-b border-default">
        <UInput
          v-model="search"
          placeholder="Buscar por serviço..."
          icon="i-lucide-search"
          class="w-72"
          @update:model-value="page = 1"
        />
        <USelectMenu
          v-model="statusFilter"
          :items="statusOptions"
          value-key="value"
          class="w-44"
          placeholder="Todos os status"
          @update:model-value="page = 1"
        />
      </div>

      <!-- Table -->
      <div v-if="status === 'pending'" class="p-4 space-y-3">
        <USkeleton v-for="i in 8" :key="i" class="h-10 w-full" />
      </div>

      <UTable
        v-else
        :columns="columns"
        :data="data?.items || []"
        class="min-h-0 flex-1"
      >
        <template #client-cell="{ row }">
          {{ row.original.clients?.name ?? '—' }}
        </template>
        <template #vehicle-cell="{ row }">
          <span v-if="row.original.vehicles">
            {{ [row.original.vehicles.brand, row.original.vehicles.model, row.original.vehicles.license_plate].filter(Boolean).join(' ') }}
          </span>
          <span v-else>—</span>
        </template>
        <template #priority-cell="{ row }">
          <UBadge
            v-if="row.original.priority"
            :color="priorityColorMap[row.original.priority] ?? 'neutral'"
            variant="subtle"
            :label="priorityLabelMap[row.original.priority] ?? row.original.priority"
          />
          <span v-else class="text-muted text-xs">—</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :color="statusColorMap[row.original.status] ?? 'neutral'"
            variant="subtle"
            :label="statusLabelMap[row.original.status] ?? row.original.status"
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

      <!-- Pagination -->
      <div v-if="(data?.total || 0) > pageSize" class="flex justify-center p-4 border-t border-default">
        <UPagination v-model="page" :page-count="pageSize" :total="data?.total || 0" />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal -->
  <UModal
    v-model:open="showModal"
    :title="isEditing ? 'Editar agendamento' : 'Novo agendamento'"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Cliente" required class="sm:col-span-2">
            <USelectMenu
              v-model="form.client_id"
              :items="clientOptions"
              value-key="value"
              placeholder="Selecione o cliente"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Veículo" required class="sm:col-span-2">
            <USelectMenu
              v-model="form.vehicle_id"
              :items="vehicleOptions"
              value-key="value"
              placeholder="Selecione o veículo"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Data" required>
            <UInput v-model="form.appointment_date" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Horário" required>
            <UInput v-model="form.time" type="time" class="w-full" />
          </UFormField>
          <UFormField label="Tipo de serviço" required class="sm:col-span-2">
            <UInput v-model="form.service_type" placeholder="Ex: Troca de óleo, Revisão..." class="w-full" />
          </UFormField>
          <UFormField label="Prioridade">
            <USelectMenu
              v-model="form.priority"
              :items="priorityOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status">
            <USelectMenu
              v-model="form.status"
              :items="statusFormOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Observações">
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
