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

// ─── Modal: criar / editar ─────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
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

// ─── Modal: confirmar exclusão ─────────────────────────────
const showConfirm = ref(false)
const isDeleting = ref(false)
const pendingDelete = ref<Employee | null>(null)

function askDelete(emp: Employee) {
  pendingDelete.value = emp
  showConfirm.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value || isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/employees/${pendingDelete.value.id}`, { method: 'DELETE' })
    toast.add({ title: 'Funcionário removido', color: 'success' })
    showConfirm.value = false
    pendingDelete.value = null
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return (parts[0]?.charAt(0) ?? '?').toUpperCase()
  return ((parts[0]?.charAt(0) ?? '') + (parts[parts.length - 1]?.charAt(0) ?? '')).toUpperCase()
}

// ─── Select options ────────────────────────────────────────
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
  { label: 'Percentual (%)', value: 'percentage' },
  { label: 'Valor fixo (R$)', value: 'fixed' }
]

const pixKeyTypeOptions = [
  { label: 'CPF / CNPJ', value: 'cpf_cnpj' },
  { label: 'E-mail', value: 'email' },
  { label: 'Telefone', value: 'phone' },
  { label: 'Chave aleatória', value: 'random' }
]

// ─── Tabela ────────────────────────────────────────────────
const columns = [
  { accessorKey: 'name', header: 'Funcionário', enableSorting: false },
  { accessorKey: 'role', header: 'Cargo', enableSorting: false },
  { accessorKey: 'phone', header: 'Telefone', enableSorting: false },
  { accessorKey: 'email', header: 'E-mail', enableSorting: false },
  { accessorKey: 'is_active', header: 'Status', enableSorting: false },
  { id: 'actions', header: '', enableSorting: false }
]
</script>

<template>
  <div v-if="!canRead" class="rounded-xl border border-default/60 bg-elevated/30 p-6">
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

    <AppDataTable
      v-model:search-term="search"
      :columns="columns"
      :data="(data ?? []) as Record<string, unknown>[]"
      :loading="status === 'pending'"
      :show-footer="false"
      show-search
      search-placeholder="Buscar por nome, e-mail ou cargo..."
      empty-icon="i-lucide-users-round"
      empty-title="Nenhum funcionário encontrado"
      empty-description="Adicione funcionários para gerenciar sua equipe."
    >
      <template #filters>
        <UCheckbox
          v-model="includeTerminated"
          label="Incluir demitidos"
          color="neutral"
        />
      </template>

      <template #name-cell="{ row }">
        <div class="flex items-center gap-3">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <span class="text-xs font-bold text-primary">
              {{ getInitials(String(row.original.name ?? '')) }}
            </span>
          </div>
          <div class="min-w-0">
            <p class="truncate font-medium text-highlighted">
              {{ row.original.name }}
            </p>
            <p v-if="row.original.hire_date" class="text-xs text-muted truncate">
              Desde {{ new Date(row.original.hire_date).toLocaleDateString('pt-BR') }}
            </p>
          </div>
        </div>
      </template>

      <template #role-cell="{ row }">
        <span v-if="row.original.role" class="text-sm">{{ row.original.role }}</span>
        <span v-else class="text-sm text-muted">—</span>
      </template>

      <template #phone-cell="{ row }">
        <span v-if="row.original.phone" class="text-sm font-mono">{{ row.original.phone }}</span>
        <span v-else class="text-sm text-muted">—</span>
      </template>

      <template #email-cell="{ row }">
        <span v-if="row.original.email" class="text-sm">{{ row.original.email }}</span>
        <span v-else class="text-sm text-muted">—</span>
      </template>

      <template #is_active-cell="{ row }">
        <UBadge
          :color="row.original.is_active ? 'success' : 'neutral'"
          variant="subtle"
          size="sm"
        >
          {{ row.original.is_active ? 'Ativo' : 'Inativo' }}
        </UBadge>
      </template>

      <template #actions-cell="{ row }">
        <div class="flex items-center justify-end gap-1">
          <UTooltip v-if="canUpdate" text="Editar">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="openEdit(row.original)"
            />
          </UTooltip>
          <UTooltip v-if="canDelete" text="Remover">
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              @click="askDelete(row.original)"
            />
          </UTooltip>
        </div>
      </template>
    </AppDataTable>
  </template>

  <!-- Modal criar / editar -->
  <UModal
    v-model:open="showModal"
    :title="isEditing ? 'Editar funcionário' : 'Novo funcionário'"
    :description="isEditing ? 'Atualize os dados do funcionário.' : 'Preencha os dados para adicionar um novo membro à equipe.'"
    :ui="{ body: 'overflow-y-auto max-h-[70vh]' }"
  >
    <template #body>
      <div class="space-y-6">
        <!-- Dados pessoais -->
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            Dados pessoais
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Nome completo" required class="sm:col-span-2">
              <UInput v-model="form.name" class="w-full" placeholder="Ex: João da Silva" />
            </UFormField>
            <UFormField label="Cargo">
              <UInput v-model="form.role" class="w-full" placeholder="Ex: Mecânico" />
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
              <UInput v-model="form.tax_id" class="w-full" placeholder="000.000.000-00" />
            </UFormField>
            <UFormField label="Data de nascimento">
              <UInput v-model="form.birth_date" type="date" class="w-full" />
            </UFormField>
          </div>
        </div>

        <USeparator />

        <!-- Contato -->
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            Contato
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Telefone / WhatsApp">
              <UInput v-model="form.phone" class="w-full" placeholder="(00) 90000-0000" />
            </UFormField>
            <UFormField label="E-mail">
              <UInput v-model="form.email" type="email" class="w-full" placeholder="joao@email.com" />
            </UFormField>
          </div>
        </div>

        <USeparator />

        <!-- Admissão e remuneração -->
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            Admissão e remuneração
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Data de admissão">
              <UInput v-model="form.hire_date" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Tipo de salário">
              <USelectMenu
                v-model="form.salary_type"
                :items="salaryTypeOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField v-if="form.salary_type !== 'commission_only'" label="Valor do salário (R$)">
              <UInput
                v-model="form.salary_amount"
                type="number"
                min="0"
                step="0.01"
                class="w-full"
                placeholder="0,00"
              />
            </UFormField>
            <UFormField label="Tipo de comissão">
              <USelectMenu
                v-model="form.commission_type"
                :items="commissionTypeOptions"
                value-key="value"
                class="w-full"
                placeholder="Sem comissão"
              />
            </UFormField>
            <UFormField v-if="form.commission_type" label="Valor da comissão">
              <UInput
                v-model="form.commission_value"
                type="number"
                min="0"
                step="0.01"
                class="w-full"
                placeholder="0,00"
              />
            </UFormField>
          </div>
        </div>

        <USeparator />

        <!-- PIX -->
        <div>
          <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
            PIX
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Tipo de chave">
              <USelectMenu
                v-model="form.pix_key_type"
                :items="pixKeyTypeOptions"
                value-key="value"
                class="w-full"
                placeholder="Sem chave PIX"
              />
            </UFormField>
            <UFormField v-if="form.pix_key_type" label="Chave PIX">
              <UInput v-model="form.pix_key" class="w-full" />
            </UFormField>
          </div>
        </div>

        <USeparator />

        <UCheckbox v-model="form.is_active" label="Funcionário ativo" color="neutral" />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton label="Cancelar" color="neutral" variant="ghost" @click="showModal = false" />
        <UButton
          :label="isEditing ? 'Salvar alterações' : 'Criar funcionário'"
          color="neutral"
          :loading="isSaving"
          :disabled="isSaving || !form.name"
          @click="save"
        />
      </div>
    </template>
  </UModal>

  <!-- Confirmar exclusão -->
  <AppConfirmModal
    :open="showConfirm"
    title="Remover funcionário"
    :description="`Tem certeza que deseja remover ${pendingDelete?.name ?? 'este funcionário'}? Esta ação não pode ser desfeita.`"
    confirm-label="Remover"
    confirm-color="error"
    :loading="isDeleting"
    @update:open="showConfirm = $event"
    @confirm="confirmDelete"
  />
</template>
