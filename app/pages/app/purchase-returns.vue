<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Devoluções' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.RETURNS_READ))
const canCreate = computed(() => workshop.can(ActionCode.RETURNS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.RETURNS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.RETURNS_DELETE))

type PurchaseReturn = Record<string, any>

const search = ref('')
const statusFilter = ref('')
const reasonFilter = ref('')
const page = ref(1)
const pageSize = 30

const { data, status, refresh } = await useAsyncData(
  () => `purchase-returns-${page.value}-${statusFilter.value}-${reasonFilter.value}`,
  () => requestFetch<{ items: PurchaseReturn[], total: number, page: number, page_size: number }>(
    '/api/purchase-returns',
    {
      headers: requestHeaders,
      query: {
        status: statusFilter.value || undefined,
        reason: reasonFilter.value || undefined,
        page: page.value,
        page_size: pageSize
      }
    }
  ),
  { watch: [page, statusFilter, reasonFilter] }
)

// Purchases and suppliers for the form
const { data: purchasesData } = await useAsyncData('returns-purchases', () =>
  requestFetch<{ items: any[] }>('/api/purchases', { headers: requestHeaders, query: { page_size: 200 } })
)

const purchaseOptions = computed(() =>
  (purchasesData.value?.items ?? []).map((p: any) => ({
    label: [p.suppliers?.name, p.invoice_number, p.purchase_date].filter(Boolean).join(' — '),
    value: p.id,
    supplier_id: p.supplier_id
  }))
)

// ─── Form Modal ────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

const emptyForm = () => ({
  purchase_id: '',
  supplier_id: '',
  return_date: new Date().toISOString().split('T')[0],
  reason: 'other' as string,
  status: 'pending' as string,
  total_returned_amount: '' as string | number,
  notes: '',
  returned_items: [] as any[]
})

const form = reactive(emptyForm())
const returnedItemsJson = ref('[]')

watch(() => form.purchase_id, (purchaseId) => {
  const opt = purchaseOptions.value.find((o: any) => o.value === purchaseId)
  if (opt) form.supplier_id = (opt as any).supplier_id ?? ''
})

function openCreate() {
  Object.assign(form, emptyForm())
  returnedItemsJson.value = '[]'
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(ret: PurchaseReturn) {
  Object.assign(form, {
    purchase_id: ret.purchase_id ?? '',
    supplier_id: ret.supplier_id ?? '',
    return_date: ret.return_date ?? '',
    reason: ret.reason ?? 'other',
    status: ret.status ?? 'pending',
    total_returned_amount: ret.total_returned_amount ?? '',
    notes: ret.notes ?? ''
  })
  returnedItemsJson.value = ret.returned_items ? JSON.stringify(ret.returned_items, null, 2) : '[]'
  isEditing.value = true
  selectedId.value = ret.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.purchase_id) { toast.add({ title: 'Compra obrigatória', color: 'warning' }); return }
  if (!form.return_date) { toast.add({ title: 'Data obrigatória', color: 'warning' }); return }
  if (!form.total_returned_amount) { toast.add({ title: 'Valor obrigatório', color: 'warning' }); return }

  let parsedItems: any[] = []
  try { parsedItems = JSON.parse(returnedItemsJson.value) } catch { parsedItems = [] }

  isSaving.value = true
  try {
    const body = {
      purchase_id: form.purchase_id,
      supplier_id: form.supplier_id,
      return_date: form.return_date,
      reason: form.reason,
      status: form.status,
      total_returned_amount: parseFloat(String(form.total_returned_amount)),
      returned_items: parsedItems,
      notes: form.notes || null
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/purchase-returns/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Devolução atualizada', color: 'success' })
    } else {
      await $fetch('/api/purchase-returns', { method: 'POST', body })
      toast.add({ title: 'Devolução registrada', color: 'success' })
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

async function remove(ret: PurchaseReturn) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/purchase-returns/${ret.id}`, { method: 'DELETE' })
    toast.add({ title: 'Devolução removida', color: 'success' })
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

const statusFilterOptions = [
  { label: 'Todos', value: '' },
  { label: 'Pendente', value: 'pending' },
  { label: 'Concluída', value: 'completed' }
]
const statusFormOptions = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Concluída', value: 'completed' }
]
const reasonFilterOptions = [
  { label: 'Todos os motivos', value: '' },
  { label: 'Garantia', value: 'warranty' },
  { label: 'Peça errada', value: 'wrong_part' },
  { label: 'Defeito de fabricação', value: 'manufacturing_defect' },
  { label: 'Produto danificado', value: 'damaged_product' },
  { label: 'Não compatível', value: 'incompatible' },
  { label: 'Outros', value: 'other' }
]
const reasonFormOptions = reasonFilterOptions.slice(1)

const statusColorMap: Record<string, string> = { pending: 'warning', completed: 'success' }
const statusLabelMap: Record<string, string> = { pending: 'Pendente', completed: 'Concluída' }
const reasonLabelMap: Record<string, string> = {
  warranty: 'Garantia',
  wrong_part: 'Peça errada',
  manufacturing_defect: 'Defeito de fabricação',
  damaged_product: 'Produto danificado',
  incompatible: 'Não compatível',
  other: 'Outros'
}

const columns = [
  { accessorKey: 'return_date', header: 'Data' },
  { id: 'supplier', header: 'Fornecedor' },
  { id: 'reason', header: 'Motivo' },
  { id: 'total_returned_amount', header: 'Valor' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: '' }
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <AppPageHeader title="Devoluções">
        <template #right>
          <UButton
            v-if="canCreate"
            label="Nova devolução"
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
          Você não tem permissão para visualizar devoluções.
        </p>
      </div>

      <template v-else>
        <!-- Filters -->
        <div class="flex flex-wrap gap-3 p-4 border-b border-default">
          <USelectMenu
            v-model="statusFilter"
            :items="statusFilterOptions"
            value-key="value"
            class="w-40"
            placeholder="Todos"
            @update:model-value="page = 1"
          />
          <USelectMenu
            v-model="reasonFilter"
            :items="reasonFilterOptions"
            value-key="value"
            class="w-52"
            placeholder="Todos os motivos"
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
          <template #reason-cell="{ row }">
            {{ reasonLabelMap[row.original.reason] ?? row.original.reason }}
          </template>
          <template #total_returned_amount-cell="{ row }">
            {{ formatCurrency(row.original.total_returned_amount) }}
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
    </template>
  </UDashboardPanel>

  <!-- Form Modal -->
  <UModal
    v-model:open="showModal"
    :title="isEditing ? 'Editar devolução' : 'Nova devolução'"
    :ui="{ body: 'overflow-y-auto max-h-[75vh]' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Compra" required class="sm:col-span-2">
            <USelectMenu
              v-model="form.purchase_id"
              :items="purchaseOptions"
              value-key="value"
              placeholder="Selecione a compra"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Data da devolução" required>
            <UInput v-model="form.return_date" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Motivo" required>
            <USelectMenu
              v-model="form.reason"
              :items="reasonFormOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Valor total devolvido" required>
            <UInput
              v-model="form.total_returned_amount"
              type="number"
              min="0"
              step="0.01"
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
