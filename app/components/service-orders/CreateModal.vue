<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  'created': []
}>()

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectOption {
  label: string
  value: string
}

interface ClientItem {
  id: string
  name: string
}

interface VehicleItem {
  id: string
  brand: string | null
  model: string | null
  license_plate: string | null
}

interface EmployeeItem {
  id: string
  name: string
}

// ─── Options ──────────────────────────────────────────────────────────────────

const toast = useToast()

const clientOptions = ref<SelectOption[]>([])
const vehicleOptions = ref<SelectOption[]>([])
const employeeOptions = ref<SelectOption[]>([])
const isLoadingOptions = ref(false)
const optionsLoaded = ref(false)

async function loadOptions() {
  if (optionsLoaded.value || isLoadingOptions.value) return
  isLoadingOptions.value = true
  try {
    const [clientsRes, vehiclesRes, employeesRes] = await Promise.all([
      $fetch<{ items: ClientItem[] }>('/api/clients', { query: { page_size: 500 } }),
      $fetch<{ items: VehicleItem[] }>('/api/vehicles', { query: { page_size: 500 } }),
      $fetch<{ items: EmployeeItem[] }>('/api/employees')
    ])
    clientOptions.value = (clientsRes.items ?? []).map(c => ({ label: c.name, value: c.id }))
    vehicleOptions.value = (vehiclesRes.items ?? []).map(v => ({
      label: [v.brand, v.model, v.license_plate].filter(Boolean).join(' - ') || '—',
      value: v.id
    }))
    employeeOptions.value = (employeesRes.items ?? []).map(e => ({ label: e.name, value: e.id }))
  } catch {
    toast.add({ title: 'Erro ao carregar opções', color: 'error' })
  } finally {
    isLoadingOptions.value = false
    optionsLoaded.value = true
  }
}

watch(
  () => props.open,
  (opened) => {
    if (opened) {
      resetForm()
      loadOptions()
    }
  }
)

// ─── Form ─────────────────────────────────────────────────────────────────────

const statusOptions = [
  { label: 'Orçamento', value: 'estimate' },
  { label: 'Aberta', value: 'open' },
  { label: 'Em andamento', value: 'in_progress' }
]

interface FormData {
  number: string
  status: string
  client_id: string
  vehicle_id: string
  responsible_employees: string[]
  entry_date: string
  expected_date: string
  reported_defect: string
  diagnosis: string
  notes: string
}

const form = reactive<FormData>({
  number: '',
  status: 'estimate',
  client_id: '',
  vehicle_id: '',
  responsible_employees: [],
  entry_date: new Date().toISOString().substring(0, 10),
  expected_date: '',
  reported_defect: '',
  diagnosis: '',
  notes: ''
})

function resetForm() {
  form.number = ''
  form.status = 'estimate'
  form.client_id = ''
  form.vehicle_id = ''
  form.responsible_employees = []
  form.entry_date = new Date().toISOString().substring(0, 10)
  form.expected_date = ''
  form.reported_defect = ''
  form.diagnosis = ''
  form.notes = ''
}

// ─── Submit ───────────────────────────────────────────────────────────────────

const isSaving = ref(false)

async function submit() {
  if (isSaving.value) return
  isSaving.value = true
  try {
    interface CreateResponse { duplicateNumber?: boolean, suggestedNumber?: string }
    const res = await $fetch<CreateResponse>('/api/service-orders', {
      method: 'POST',
      body: {
        orderData: {
          number: form.number || undefined,
          status: form.status,
          payment_status: 'pending',
          client_id: form.client_id || null,
          vehicle_id: form.vehicle_id || null,
          responsible_employees: form.responsible_employees.map(id => ({ employee_id: id })),
          entry_date: form.entry_date,
          expected_date: form.expected_date || null,
          reported_defect: form.reported_defect || null,
          diagnosis: form.diagnosis || null,
          notes: form.notes || null,
          items: [],
          total_amount: 0,
          discount: 0
        }
      }
    })

    if (res?.duplicateNumber) {
      toast.add({
        title: 'Número já existe',
        description: `Sugestão: ${res.suggestedNumber}`,
        color: 'warning'
      })
      form.number = res.suggestedNumber ?? ''
      return
    }

    toast.add({ title: 'OS criada com sucesso', color: 'success' })
    emit('update:open', false)
    emit('created')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Erro ao criar OS',
      description: err?.data?.statusMessage || 'Tente novamente.',
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
    title="Nova Ordem de Serviço"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div v-if="isLoadingOptions" class="flex items-center justify-center py-8">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <form v-else class="space-y-4" @submit.prevent="submit">
        <!-- Row 1: number + status -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Número da OS">
            <UInput
              v-model="form.number"
              placeholder="Auto (ex: OS4001)"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status">
            <USelectMenu
              v-model="form.status"
              :items="statusOptions"
              value-key="value"
              class="w-full"
              :search-input="false"
            />
          </UFormField>
        </div>

        <!-- Row 2: client -->
        <UFormField label="Cliente">
          <USelectMenu
            v-model="form.client_id"
            :items="[{ label: 'Sem cliente', value: '' }, ...clientOptions]"
            value-key="value"
            class="w-full"
            searchable
          />
        </UFormField>

        <!-- Row 3: vehicle -->
        <UFormField label="Veículo">
          <USelectMenu
            v-model="form.vehicle_id"
            :items="[{ label: 'Sem veículo', value: '' }, ...vehicleOptions]"
            value-key="value"
            class="w-full"
            searchable
          />
        </UFormField>

        <!-- Row 4: responsibles -->
        <UFormField label="Responsáveis">
          <USelectMenu
            v-model="form.responsible_employees"
            :items="employeeOptions"
            value-key="value"
            multiple
            class="w-full"
            searchable
            placeholder="Selecione os responsáveis"
          />
        </UFormField>

        <!-- Row 5: dates -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Data de entrada">
            <UInput
              v-model="form.entry_date"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Data prevista">
            <UInput
              v-model="form.expected_date"
              type="date"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Row 6: reported defect -->
        <UFormField label="Defeito relatado">
          <UTextarea
            v-model="form.reported_defect"
            placeholder="Descreva o defeito relatado pelo cliente..."
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <!-- Row 7: diagnosis -->
        <UFormField label="Diagnóstico">
          <UTextarea
            v-model="form.diagnosis"
            placeholder="Diagnóstico técnico..."
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <!-- Row 8: notes -->
        <UFormField label="Observações">
          <UTextarea
            v-model="form.notes"
            placeholder="Observações internas..."
            :rows="2"
            class="w-full"
          />
        </UFormField>
      </form>
    </template>

    <template #footer>
      <div class="flex items-center justify-end gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        />
        <UButton
          label="Criar OS"
          icon="i-lucide-plus"
          :loading="isSaving"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
