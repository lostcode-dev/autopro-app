<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Compras' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.PURCHASES_READ))
const canCreate = computed(() => workshop.can(ActionCode.PURCHASES_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.PURCHASES_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.PURCHASES_DELETE))

type Purchase = Record<string, any>

const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 30

// Current month range default
const now = new Date()
const defaultDateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const defaultDateTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

const dateFrom = ref(defaultDateFrom)
const dateTo = ref(defaultDateTo)

const { data, status, refresh } = await useAsyncData(
  () => `purchases-${page.value}-${search.value}-${statusFilter.value}-${dateFrom.value}-${dateTo.value}`,
  () => requestFetch<{ items: Purchase[], total: number, page: number, page_size: number }>(
    '/api/purchases',
    {
      headers: requestHeaders,
      query: {
        search: search.value || undefined,
        payment_status: statusFilter.value || undefined,
        date_from: dateFrom.value || undefined,
        date_to: dateTo.value || undefined,
        page: page.value,
        page_size: pageSize
      }
    }
  ),
  { watch: [page, search, statusFilter, dateFrom, dateTo] }
)

// Suppliers for the form select
const { data: suppliersData } = await useAsyncData('purch-suppliers', () =>
  requestFetch<Purchase[]>('/api/suppliers', { headers: requestHeaders, query: { page_size: 500 } })
)
const { data: bankAccountsData } = await useAsyncData('purch-bank-accounts', () =>
  requestFetch<Purchase[]>('/api/bank-accounts', { headers: requestHeaders, query: { page_size: 200 } })
)

const supplierOptions = computed(() =>
  (Array.isArray(suppliersData.value) ? suppliersData.value : (suppliersData.value as any)?.items ?? [])
    .map((s: any) => ({ label: s.name, value: s.id }))
)
const bankAccountOptions = computed(() =>
  (Array.isArray(bankAccountsData.value) ? bankAccountsData.value : (bankAccountsData.value as any)?.items ?? [])
    .map((a: any) => ({ label: a.name, value: a.id }))
)

// ─── Pay Modal ────────────────────────────────────
const showPayModal = ref(false)
const isPaying = ref(false)
const selectedPurchaseForPay = ref<Purchase | null>(null)
const payDate = ref('')

function openPayModal(purchase: Purchase) {
  selectedPurchaseForPay.value = purchase
  payDate.value = new Date().toISOString().split('T')[0]
  showPayModal.value = true
}

async function confirmPayment() {
  if (isPaying.value || !selectedPurchaseForPay.value) return
  isPaying.value = true
  try {
    await $fetch(`/api/purchases/${selectedPurchaseForPay.value.id}/pay`, {
      method: 'POST',
      body: { payment_date: payDate.value }
    })
    toast.add({ title: 'Pagamento confirmado', color: 'success' })
    showPayModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível confirmar', color: 'error' })
  } finally {
    isPaying.value = false
  }
}

// ─── Form Modal ────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)
const itemsJson = ref('[]')

const emptyForm = () => ({
  supplier_id: '',
  bank_account_id: '',
  purchase_date: new Date().toISOString().split('T')[0],
  total_amount: '' as string | number,
  payment_status: 'pending' as string,
  invoice_number: '',
  due_date: '',
  notes: ''
})

const form = reactive(emptyForm())

function openCreate() {
  Object.assign(form, emptyForm())
  itemsJson.value = '[]'
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(purchase: Purchase) {
  Object.assign(form, {
    supplier_id: purchase.supplier_id ?? '',
    bank_account_id: purchase.bank_account_id ?? '',
    purchase_date: purchase.purchase_date ?? '',
    total_amount: purchase.total_amount ?? '',
    payment_status: purchase.payment_status ?? 'pending',
    invoice_number: purchase.invoice_number ?? '',
    due_date: purchase.due_date ?? '',
    notes: purchase.notes ?? ''
  })
  itemsJson.value = purchase.items ? JSON.stringify(purchase.items, null, 2) : '[]'
  isEditing.value = true
  selectedId.value = purchase.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.supplier_id) { toast.add({ title: 'Fornecedor obrigatório', color: 'warning' }); return }
  if (!form.bank_account_id) { toast.add({ title: 'Conta bancária obrigatória', color: 'warning' }); return }
  if (!form.purchase_date) { toast.add({ title: 'Data obrigatória', color: 'warning' }); return }
  if (!form.total_amount) { toast.add({ title: 'Valor total obrigatório', color: 'warning' }); return }

  let parsedItems: any[] = []
  try { parsedItems = JSON.parse(itemsJson.value) } catch { parsedItems = [] }

  isSaving.value = true
  try {
    const body = {
      supplier_id: form.supplier_id,
      bank_account_id: form.bank_account_id,
      purchase_date: form.purchase_date,
      total_amount: parseFloat(String(form.total_amount)),
      payment_status: form.payment_status,
      invoice_number: form.invoice_number || null,
      due_date: form.due_date || null,
      notes: form.notes || null,
      items: parsedItems.length ? parsedItems : null
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/purchases/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Compra atualizada', color: 'success' })
    } else {
      await $fetch('/api/purchases', { method: 'POST', body })
      toast.add({ title: 'Compra criada', color: 'success' })
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

async function remove(purchase: Purchase) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/purchases/${purchase.id}`, { method: 'DELETE' })
    toast.add({ title: 'Compra removida', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

function formatCurrency(value: number | string) {
  return parseFloat(String(value || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const paymentStatusOptions = [
  { label: 'Todos', value: '' },
  { label: 'Pendente', value: 'pending' },
  { label: 'Pago', value: 'paid' }
]

const paymentStatusFormOptions = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Pago', value: 'paid' }
]

const statusColorMap: Record<string, string> = { pending: 'warning', paid: 'success' }
const statusLabelMap: Record<string, string> = { pending: 'Pendente', paid: 'Pago' }

const columns = [
  { accessorKey: 'purchase_date', header: 'Data' },
  { id: 'supplier', header: 'Fornecedor' },
  { accessorKey: 'invoice_number', header: 'Nota Fiscal' },
  { id: 'total_amount', header: 'Total' },
  { id: 'payment_status', header: 'Status' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Compras">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Nova compra"
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
          Você não tem permissão para visualizar compras.
        </p>
      </div>

      <template v-else>
        <!-- Filters -->
        <div class="flex flex-wrap gap-3 p-4 border-b border-default">
          <UInput
            v-model="search"
            placeholder="Buscar por nota fiscal..."
            icon="i-lucide-search"
            class="w-64"
            @update:model-value="page = 1"
          />
          <USelectMenu
            v-model="statusFilter"
            :items="paymentStatusOptions"
            value-key="value"
            class="w-40"
            placeholder="Todos"
            @update:model-value="page = 1"
          />
          <UInput
            v-model="dateFrom"
            type="date"
            class="w-40"
            @update:model-value="page = 1"
          />
          <UInput
            v-model="dateTo"
            type="date"
            class="w-40"
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
          <template #supplier-cell="{ row }">
            {{ row.original.suppliers?.name ?? '—' }}
          </template>
          <template #total_amount-cell="{ row }">
            {{ formatCurrency(row.original.total_amount) }}
          </template>
          <template #payment_status-cell="{ row }">
            <UBadge
              :color="statusColorMap[row.original.payment_status] ?? 'neutral'"
              variant="subtle"
              :label="statusLabelMap[row.original.payment_status] ?? row.original.payment_status"
            />
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2 justify-end">
              <UButton
                v-if="canUpdate && row.original.payment_status === 'pending'"
                icon="i-lucide-check-circle"
                color="success"
                variant="ghost"
                size="xs"
                @click="openPayModal(row.original)"
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

  <!-- Pay Confirmation Modal -->
  <UModal v-model:open="showPayModal" title="Confirmar Pagamento">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Confirme o pagamento de <strong>{{ formatCurrency(selectedPurchaseForPay?.total_amount) }}</strong> para
          <strong>{{ selectedPurchaseForPay?.suppliers?.name ?? 'fornecedor' }}</strong>.
        </p>
        <UFormField label="Data de pagamento">
          <UInput v-model="payDate" type="date" class="w-full" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="showPayModal = false"
        />
        <UButton
          label="Confirmar pagamento"
          color="success"
          :loading="isPaying"
          :disabled="isPaying"
          @click="confirmPayment"
        />
      </div>
    </template>
  </UModal>

  <!-- Form Modal -->
  <UModal
    v-model:open="showModal"
    :title="isEditing ? 'Editar compra' : 'Nova compra'"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Fornecedor" required class="sm:col-span-2">
            <USelectMenu
              v-model="form.supplier_id"
              :items="supplierOptions"
              value-key="value"
              placeholder="Selecione o fornecedor"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Conta bancária" required class="sm:col-span-2">
            <USelectMenu
              v-model="form.bank_account_id"
              :items="bankAccountOptions"
              value-key="value"
              placeholder="Selecione a conta"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Data da compra" required>
            <UInput v-model="form.purchase_date" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Vencimento">
            <UInput v-model="form.due_date" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Valor total" required>
            <UInput
              v-model="form.total_amount"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status">
            <USelectMenu
              v-model="form.payment_status"
              :items="paymentStatusFormOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Nota fiscal" class="sm:col-span-2">
            <UInput v-model="form.invoice_number" class="w-full" />
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
