<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Contas bancárias' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.BANK_ACCOUNTS_READ))
const canCreate = computed(() => workshop.can(ActionCode.BANK_ACCOUNTS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.BANK_ACCOUNTS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.BANK_ACCOUNTS_DELETE))

type BankAccount = Record<string, any>

const { data, status, refresh } = await useAsyncData(
  'bank-accounts-list',
  () => requestFetch<BankAccount[]>('/api/bank-accounts', { headers: requestHeaders })
)

// ─── Modal ────────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  name: '',
  bank_name: '',
  bank_code: '',
  agency_number: '',
  agency_digit: '',
  account_number: '',
  account_digit: '',
  account_type: 'checking' as string,
  initial_balance: '' as string | number,
  pix_key_type: '',
  pix_key: '',
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

function openEdit(a: BankAccount) {
  Object.assign(form, {
    name: a.name ?? '',
    bank_name: a.bank_name ?? '',
    bank_code: a.bank_code ?? '',
    agency_number: a.agency_number ?? '',
    agency_digit: a.agency_digit ?? '',
    account_number: a.account_number ?? '',
    account_digit: a.account_digit ?? '',
    account_type: a.account_type ?? 'checking',
    initial_balance: a.initial_balance ?? '',
    pix_key_type: a.pix_key_type ?? '',
    pix_key: a.pix_key ?? '',
    is_default: a.is_default ?? false,
    is_active: a.is_active ?? true
  })
  isEditing.value = true
  selectedId.value = a.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.name) { toast.add({ title: 'Nome obrigatório', color: 'warning' }); return }
  isSaving.value = true
  try {
    const body: Record<string, any> = {
      name: form.name,
      bank_name: form.bank_name || null,
      bank_code: form.bank_code || null,
      agency_number: form.agency_number || null,
      agency_digit: form.agency_digit || null,
      account_number: form.account_number || null,
      account_digit: form.account_digit || null,
      account_type: form.account_type || null,
      initial_balance: form.initial_balance !== '' ? Number(form.initial_balance) : null,
      pix_key_type: form.pix_key_type || null,
      pix_key: form.pix_key || null,
      is_default: form.is_default,
      is_active: form.is_active
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/bank-accounts/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Conta atualizada', color: 'success' })
    } else {
      await $fetch('/api/bank-accounts', { method: 'POST', body })
      toast.add({ title: 'Conta criada', color: 'success' })
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

async function remove(a: BankAccount) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/bank-accounts/${a.id}`, { method: 'DELETE' })
    toast.add({ title: 'Conta removida', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

const accountTypeOptions = [
  { label: 'Conta corrente', value: 'checking' },
  { label: 'Poupança', value: 'savings' },
  { label: 'Caixa', value: 'cash' },
  { label: 'Outro', value: 'other' }
]

const pixKeyTypeOptions = [
  { label: 'CPF/CNPJ', value: 'cpf_cnpj' },
  { label: 'E-mail', value: 'email' },
  { label: 'Telefone', value: 'phone' },
  { label: 'Chave aleatória', value: 'random' }
]

const formatCurrency = (val: number | null) =>
  val != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
    : '-'

const columns = [
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'bank_name', header: 'Banco' },
  { accessorKey: 'account_type', header: 'Tipo' },
  {
    accessorKey: 'initial_balance',
    header: 'Saldo inicial',
    cell: ({ row }: { row: { original: BankAccount } }) => formatCurrency(row.original.initial_balance)
  },
  {
    accessorKey: 'is_default',
    header: 'Padrão',
    cell: ({ row }: { row: { original: BankAccount } }) => row.original.is_default ? 'Sim' : 'Não'
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }: { row: { original: BankAccount } }) => row.original.is_active ? 'Ativa' : 'Inativa'
  },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Contas bancárias">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Nova conta"
            icon="i-lucide-plus"
            color="neutral"
            @click="openCreate"
          />
        </template>
      </AppPageHeader>
    </template>

    <template #body>
      <div v-if="!canRead" class="p-6">
        <p class="text-sm text-muted">
          Você não tem permissão para visualizar contas bancárias.
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
    </template>
  </UDashboardPanel>

  <UModal v-model:open="showModal" :title="isEditing ? 'Editar conta' : 'Nova conta'" :ui="{ body: 'overflow-y-auto max-h-[70vh]' }">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Nome da conta" required>
          <UInput v-model="form.name" class="w-full" placeholder="Ex: Conta principal Bradesco" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Banco">
            <UInput v-model="form.bank_name" class="w-full" />
          </UFormField>
          <UFormField label="Código do banco">
            <UInput v-model="form.bank_code" class="w-full" />
          </UFormField>
          <UFormField label="Agência">
            <UInput v-model="form.agency_number" class="w-full" />
          </UFormField>
          <UFormField label="Dígito da agência">
            <UInput v-model="form.agency_digit" class="w-full" maxlength="1" />
          </UFormField>
          <UFormField label="Conta">
            <UInput v-model="form.account_number" class="w-full" />
          </UFormField>
          <UFormField label="Dígito da conta">
            <UInput v-model="form.account_digit" class="w-full" maxlength="1" />
          </UFormField>
          <UFormField label="Tipo de conta">
            <USelectMenu
              v-model="form.account_type"
              :items="accountTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Saldo inicial">
            <UInput
              v-model="form.initial_balance"
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

        <div class="flex gap-4">
          <UCheckbox v-model="form.is_default" label="Conta padrão" />
          <UCheckbox v-model="form.is_active" label="Ativa" />
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
