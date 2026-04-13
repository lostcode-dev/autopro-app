<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Funcionários' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.EMPLOYEES_READ))
const canCreate = computed(() => workshop.can(ActionCode.EMPLOYEES_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.EMPLOYEES_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.EMPLOYEES_DELETE))

type Employee = Record<string, any>

const search = ref('')
const includeTerminated = ref(false)

const { data, status, refresh } = await useAsyncData(
  'employees-list',
  () => requestFetch<Employee[]>('/api/employees', {
    headers: requestHeaders,
    query: {
      search: search.value || undefined,
      include_terminated: includeTerminated.value || undefined
    }
  })
)

watch([search, includeTerminated], () => refresh())

// ─── Modal state ─────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  name: '',
  role: '',
  person_type: 'PF' as string,
  tax_id: '',
  phone: '',
  email: '',
  birth_date: '',
  hire_date: '',
  salary_type: 'fixed' as string,
  salary_amount: '' as string | number,
  commission_type: '' as string,
  commission_value: '' as string | number,
  pix_key_type: '' as string,
  pix_key: '',
  is_active: true
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(emp: Employee) {
  Object.assign(form, {
    name: emp.name ?? '',
    role: emp.role ?? '',
    person_type: emp.person_type ?? 'PF',
    tax_id: emp.tax_id ?? '',
    phone: emp.phone ?? '',
    email: emp.email ?? '',
    birth_date: emp.birth_date ? emp.birth_date.split('T')[0] : '',
    hire_date: emp.hire_date ? emp.hire_date.split('T')[0] : '',
    salary_type: emp.salary_type ?? 'fixed',
    salary_amount: emp.salary_amount ?? '',
    commission_type: emp.commission_type ?? '',
    commission_value: emp.commission_value ?? '',
    pix_key_type: emp.pix_key_type ?? '',
    pix_key: emp.pix_key ?? '',
    is_active: emp.is_active ?? true
  })
  isEditing.value = true
  selectedId.value = emp.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  isSaving.value = true
  try {
    const body: Record<string, any> = {
      name: form.name,
      role: form.role || null,
      person_type: form.person_type,
      tax_id: form.tax_id || null,
      phone: form.phone || null,
      email: form.email || null,
      birth_date: form.birth_date || null,
      hire_date: form.hire_date || null,
      salary_type: form.salary_type || null,
      salary_amount: form.salary_amount !== '' ? Number(form.salary_amount) : null,
      commission_type: form.commission_type || null,
      commission_value: form.commission_value !== '' ? Number(form.commission_value) : null,
      pix_key_type: form.pix_key_type || null,
      pix_key: form.pix_key || null,
      is_active: form.is_active
    }

    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/employees/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Funcionário atualizado', color: 'success' })
    } else {
      await $fetch('/api/employees', { method: 'POST', body })
      toast.add({ title: 'Funcionário criado', color: 'success' })
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

async function remove(emp: Employee) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
    toast.add({ title: 'Funcionário removido', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

const personTypeOptions = [
  { label: 'Pessoa Física', value: 'PF' },
  { label: 'Pessoa Jurídica', value: 'PJ' }
]

const salaryTypeOptions = [
  { label: 'Fixo', value: 'fixed' },
  { label: 'Por hora', value: 'hourly' },
  { label: 'Só comissão', value: 'commission_only' }
]

const commissionTypeOptions = [
  { label: 'Percentual', value: 'percentage' },
  { label: 'Fixo', value: 'fixed' }
]

const pixKeyTypeOptions = [
  { label: 'CPF/CNPJ', value: 'cpf_cnpj' },
  { label: 'E-mail', value: 'email' },
  { label: 'Telefone', value: 'phone' },
  { label: 'Chave aleatória', value: 'random' }
]

const columns = [
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'role', header: 'Cargo' },
  { accessorKey: 'phone', header: 'Telefone' },
  { accessorKey: 'email', header: 'E-mail' },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }: { row: { original: Employee } }) =>
      row.original.is_active ? 'Ativo' : 'Inativo'
  },
  { id: 'actions', header: '' }
]
</script>

<template>
  <div v-if="!canRead" class="p-6">
    <p class="text-sm text-muted">
      Você não tem permissão para visualizar funcionários.
    </p>
  </div>

  <template v-else>
    <UPageCard
      title="Funcionários"
      description="Gerencie a equipe da oficina."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        v-if="canCreate"
        label="Novo funcionário"
        icon="i-lucide-plus"
        color="neutral"
        class="w-fit lg:ms-auto"
        @click="openCreate"
      />
    </UPageCard>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <UInput
        v-model="search"
        placeholder="Buscar por nome, e-mail ou CPF..."
        icon="i-lucide-search"
        class="w-72"
      />
      <UCheckbox v-model="includeTerminated" label="Incluir demitidos" />
    </div>

    <UPageCard variant="subtle">
      <div v-if="status === 'pending'" class="space-y-3">
        <USkeleton v-for="i in 5" :key="i" class="h-10 w-full" />
      </div>
      <UTable
        v-else
        :columns="columns"
        :data="data || []"
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
    </UPageCard>
  </template>

  <!-- Modal -->
  <UModal v-model:open="showModal" :title="isEditing ? 'Editar funcionário' : 'Novo funcionário'" :ui="{ body: 'overflow-y-auto max-h-[70vh]' }">
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Nome" required>
            <UInput v-model="form.name" class="w-full" />
          </UFormField>
          <UFormField label="Cargo">
            <UInput v-model="form.role" class="w-full" />
          </UFormField>
          <UFormField label="Tipo de pessoa">
            <USelectMenu
              v-model="form.person_type"
              :items="personTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="CPF / CNPJ">
            <UInput v-model="form.tax_id" class="w-full" />
          </UFormField>
          <UFormField label="Telefone">
            <UInput v-model="form.phone" class="w-full" />
          </UFormField>
          <UFormField label="E-mail">
            <UInput v-model="form.email" type="email" class="w-full" />
          </UFormField>
          <UFormField label="Data de nascimento">
            <UInput v-model="form.birth_date" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Data de admissão">
            <UInput v-model="form.hire_date" type="date" class="w-full" />
          </UFormField>
        </div>

        <USeparator label="Remuneração" />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Tipo de salário">
            <USelectMenu
              v-model="form.salary_type"
              :items="salaryTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField v-if="form.salary_type !== 'commission_only'" label="Valor do salário">
            <UInput
              v-model="form.salary_amount"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Tipo de comissão">
            <USelectMenu
              v-model="form.commission_type"
              :items="commissionTypeOptions"
              value-key="value"
              class="w-full"
              placeholder="Nenhuma"
            />
          </UFormField>
          <UFormField v-if="form.commission_type" label="Valor da comissão">
            <UInput
              v-model="form.commission_value"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>
        </div>

        <USeparator label="PIX" />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Tipo de chave PIX">
            <USelectMenu
              v-model="form.pix_key_type"
              :items="pixKeyTypeOptions"
              value-key="value"
              class="w-full"
              placeholder="Nenhum"
            />
          </UFormField>
          <UFormField v-if="form.pix_key_type" label="Chave PIX">
            <UInput v-model="form.pix_key" class="w-full" />
          </UFormField>
        </div>

        <UCheckbox v-model="form.is_active" label="Funcionário ativo" />
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
