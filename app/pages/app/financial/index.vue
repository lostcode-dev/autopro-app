<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Financeiro' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.FINANCIAL_READ))
const canCreate = computed(() => workshop.can(ActionCode.FINANCIAL_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.FINANCIAL_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.FINANCIAL_DELETE))

interface Entry {
  id: string
  description: string
  amount: string | number
  due_date: string
  type: string
  status: string
  category: string
  bank_account_id?: string | null
  notes?: string | null
  recurrence?: string | null
  [key: string]: unknown
}
type BadgeColor = 'success' | 'error' | 'warning' | 'primary' | 'secondary' | 'info' | 'neutral'

// ─── Filters ─────────────────────────────────────────────────────────────────
const search = ref('')
const statusFilter = ref('all')
const typeFilter = ref('all')
const page = ref(1)
const pageSize = 20

// Default to current month
const now = new Date()
const dateFrom = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const dateTo = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)

const { data, status, refresh } = await useAsyncData(
  () => `financial-${page.value}-${search.value}-${statusFilter.value}-${typeFilter.value}-${dateFrom.value}-${dateTo.value}`,
  () => requestFetch<{ items: Entry[], total: number, page: number, page_size: number }>(
    '/api/financial',
    {
      headers: requestHeaders,
      query: {
        search: search.value || undefined,
        status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
        type: typeFilter.value !== 'all' ? typeFilter.value : undefined,
        date_from: dateFrom.value || undefined,
        date_to: dateTo.value || undefined,
        page: page.value,
        page_size: pageSize
      }
    }
  ),
  { watch: [page, search, statusFilter, typeFilter, dateFrom, dateTo] }
)

// Load bank accounts for form
type BankAccount = { id: string, name: string }
const { data: bankAccountsData } = await useAsyncData('fin-bank-accounts', () =>
  requestFetch<BankAccount[] | { items?: BankAccount[] }>('/api/bank-accounts', { headers: requestHeaders, query: { page_size: 100 } })
)
const bankAccountOptions = computed(() => {
  const raw = bankAccountsData.value
  const arr = Array.isArray(raw) ? raw : ((raw as Record<string, unknown>)?.items as BankAccount[] | undefined) ?? []
  return arr.map(b => ({ label: b.name, value: b.id }))
})

// ─── Totals ───────────────────────────────────────────────────────────────────
const totals = computed(() => {
  const items = data.value?.items ?? []
  const income = items.filter(e => e.type === 'income').reduce((s, e) => s + parseFloat(String(e.amount ?? 0)), 0)
  const expense = items.filter(e => e.type === 'expense').reduce((s, e) => s + parseFloat(String(e.amount ?? 0)), 0)
  return { income, expense, balance: income - expense }
})

// ─── Pay ─────────────────────────────────────────────────────────────────────
const isPaying = ref(false)
async function pay(entry: Entry) {
  if (isPaying.value) return
  isPaying.value = true
  try {
    await $fetch(`/api/financial/${String(entry.id)}/pay`, { method: 'POST' as const })
    toast.add({ title: 'Lançamento marcado como pago', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Falha ao pagar', color: 'error' })
  } finally {
    isPaying.value = false
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
const isDeleting = ref(false)
async function remove(entry: Entry) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/financial/${String(entry.id)}`, { method: 'DELETE' as const })
    toast.add({ title: 'Lançamento removido', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Falha ao remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  description: '',
  amount: '',
  due_date: '',
  type: 'expense',
  status: 'pending',
  category: '',
  bank_account_id: '',
  notes: '',
  recurrence: ''
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(entry: Entry) {
  Object.assign(form, {
    description: String(entry.description ?? ''),
    amount: String(entry.amount ?? ''),
    due_date: String(entry.due_date ?? ''),
    type: String(entry.type ?? 'expense'),
    status: String(entry.status ?? 'pending'),
    category: String(entry.category ?? ''),
    bank_account_id: String(entry.bank_account_id ?? ''),
    notes: String(entry.notes ?? ''),
    recurrence: String(entry.recurrence ?? '')
  })
  isEditing.value = true
  selectedId.value = String(entry.id)
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.description) {
    toast.add({ title: 'Descrição obrigatória', color: 'warning' })
    return
  }
  if (!form.amount || parseFloat(String(form.amount)) <= 0) {
    toast.add({ title: 'Valor inválido', color: 'warning' })
    return
  }
  if (!form.due_date) {
    toast.add({ title: 'Data de vencimento obrigatória', color: 'warning' })
    return
  }
  if (!form.category) {
    toast.add({ title: 'Categoria obrigatória', color: 'warning' })
    return
  }

  isSaving.value = true
  try {
    const body = {
      description: form.description,
      amount: parseFloat(String(form.amount)),
      due_date: form.due_date,
      type: form.type,
      status: form.status,
      category: form.category,
      bank_account_id: form.bank_account_id || null,
      notes: form.notes || null,
      recurrence: form.recurrence || null
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/financial/${selectedId.value}`, { method: 'PUT' as const, body })
      toast.add({ title: 'Lançamento atualizado', color: 'success' })
    } else {
      await $fetch('/api/financial', { method: 'POST', body })
      toast.add({ title: 'Lançamento criado', color: 'success' })
    }
    showModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Falha ao salvar', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

function formatCurrency(value: number | string) {
  return parseFloat(String(value || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

const statusFilterOptions = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendente', value: 'pendente' },
  { label: 'Pago', value: 'pago' }
]
const typeFilterOptions = [
  { label: 'Todos', value: 'all' },
  { label: 'Receita', value: 'income' },
  { label: 'Despesa', value: 'expense' }
]
const typeOptions = [
  { label: 'Receita', value: 'income' },
  { label: 'Despesa', value: 'expense' }
]
const statusOptions = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Pago', value: 'pago' }
]
const recurrenceOptions = [
  { label: 'Sem recorrência', value: '' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Mensal', value: 'monthly' },
  { label: 'Anual', value: 'yearly' }
]

const typeBadgeColor: Record<string, BadgeColor> = { income: 'success', expense: 'error' }
const typeBadgeLabel: Record<string, string> = { income: 'Receita', expense: 'Despesa' }
const statusBadgeColor: Record<string, BadgeColor> = { pago: 'success', paid: 'success', pending: 'warning', pendente: 'warning' }
const statusBadgeLabel: Record<string, string> = { pago: 'Pago', paid: 'Pago', pending: 'Pendente', pendente: 'Pendente' }

const columns = [
  { accessorKey: 'description', header: 'Descrição' },
  { accessorKey: 'category', header: 'Categoria' },
  { accessorKey: 'due_date', header: 'Vencimento' },
  { id: 'type', header: 'Tipo' },
  { id: 'status_col', header: 'Status' },
  { id: 'amount_col', header: 'Valor' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Financeiro">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Novo lançamento"
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
          Você não tem permissão para visualizar lançamentos financeiros.
        </p>
      </div>

      <template v-else>
        <!-- Totals strip -->
        <div v-if="data" class="grid grid-cols-3 divide-x divide-default border-b border-default text-center text-sm py-3">
          <div>
            <p class="text-muted text-xs">
              Receitas
            </p>
            <p class="font-bold text-green-600">
              {{ formatCurrency(totals.income) }}
            </p>
          </div>
          <div>
            <p class="text-muted text-xs">
              Despesas
            </p>
            <p class="font-bold text-red-500">
              {{ formatCurrency(totals.expense) }}
            </p>
          </div>
          <div>
            <p class="text-muted text-xs">
              Saldo
            </p>
            <p
              class="font-bold"
              :class="totals.balance >= 0 ? 'text-green-600' : 'text-red-500'"
            >
              {{ formatCurrency(totals.balance) }}
            </p>
          </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3 p-4 border-b border-default">
          <UInput
            v-model="search"
            placeholder="Buscar por descrição..."
            icon="i-lucide-search"
            class="w-64"
            @update:model-value="page = 1"
          />
          <USelectMenu
            v-model="typeFilter"
            :items="typeFilterOptions"
            value-key="value"
            class="w-36"
            @update:model-value="page = 1"
          />
          <USelectMenu
            v-model="statusFilter"
            :items="statusFilterOptions"
            value-key="value"
            class="w-36"
            @update:model-value="page = 1"
          />
          <UInput
            v-model="dateFrom"
            type="date"
            size="sm"
            class="w-36"
            @update:model-value="page = 1"
          />
          <span class="self-center text-sm text-muted">até</span>
          <UInput
            v-model="dateTo"
            type="date"
            size="sm"
            class="w-36"
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
          <template #due_date-cell="{ row }">
            {{ formatDate(String(row.original.due_date ?? '')) }}
          </template>
          <template #type-cell="{ row }">
            <UBadge
              :color="typeBadgeColor[String(row.original.type)] ?? 'neutral'"
              variant="subtle"
              :label="typeBadgeLabel[String(row.original.type)] ?? String(row.original.type)"
              size="sm"
            />
          </template>
          <template #status_col-cell="{ row }">
            <UBadge
              :color="statusBadgeColor[String(row.original.status)] ?? 'neutral'"
              variant="subtle"
              :label="statusBadgeLabel[String(row.original.status)] ?? String(row.original.status)"
              size="sm"
            />
          </template>
          <template #amount_col-cell="{ row }">
            <span :class="row.original.type === 'income' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'">
              {{ formatCurrency(row.original.amount as string | number) }}
            </span>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-1 justify-end">
              <UButton
                v-if="canUpdate && row.original.status !== 'pago'"
                icon="i-lucide-check-circle"
                color="success"
                variant="ghost"
                size="xs"
                title="Marcar como pago"
                :loading="isPaying"
                @click="pay(row.original)"
              />
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
    </template>
  </UDashboardPanel>

  <!-- Form Modal -->
  <UModal v-model:open="showModal" :title="isEditing ? 'Editar lançamento' : 'Novo lançamento'">
    <template #body>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UFormField label="Descrição" required class="sm:col-span-2">
          <UInput v-model="form.description" class="w-full" />
        </UFormField>
        <UFormField label="Tipo" required>
          <USelectMenu
            v-model="form.type"
            :items="typeOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Valor (R$)" required>
          <UInput
            v-model="form.amount"
            type="number"
            min="0"
            step="0.01"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Vencimento" required>
          <UInput v-model="form.due_date" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Status">
          <USelectMenu
            v-model="form.status"
            :items="statusOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Categoria" required>
          <UInput v-model="form.category" class="w-full" placeholder="Ex: Serviços, Peças, Salários..." />
        </UFormField>
        <UFormField label="Conta bancária">
          <USelectMenu
            v-model="form.bank_account_id"
            :items="bankAccountOptions"
            value-key="value"
            class="w-full"
            placeholder="Selecionar..."
          />
        </UFormField>
        <UFormField label="Recorrência" class="sm:col-span-2">
          <USelectMenu
            v-model="form.recurrence"
            :items="recurrenceOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Observações" class="sm:col-span-2">
          <UTextarea v-model="form.notes" class="w-full" :rows="2" />
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
