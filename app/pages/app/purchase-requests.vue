<script setup lang="ts">
import { ActionCode } from '~/constants/action-codes'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Autorizações de Compra' })

const toast = useToast()
const workshop = useWorkshopPermissions()
const requestFetch = useRequestFetch()
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const canRead = computed(() => workshop.can(ActionCode.AUTHORIZATIONS_READ))
const canCreate = computed(() => workshop.can(ActionCode.AUTHORIZATIONS_CREATE))
const canUpdate = computed(() => workshop.can(ActionCode.AUTHORIZATIONS_UPDATE))
const canDelete = computed(() => workshop.can(ActionCode.AUTHORIZATIONS_DELETE))
const canApprove = computed(() => workshop.can(ActionCode.AUTHORIZATIONS_APPROVE))

type PurchaseRequest = Record<string, any>

const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 30

const { data, status, refresh } = await useAsyncData(
  () => `purchase-requests-${page.value}-${search.value}-${statusFilter.value}`,
  () => requestFetch<{ items: PurchaseRequest[]; total: number; page: number; page_size: number }>(
    '/api/purchase-requests',
    {
      headers: requestHeaders,
      query: {
        search: search.value || undefined,
        status: statusFilter.value || undefined,
        page: page.value,
        page_size: pageSize,
      }
    }
  ),
  { watch: [page, search, statusFilter] }
)

// Suppliers for the form
const { data: suppliersData } = await useAsyncData('pr-suppliers', () =>
  requestFetch<any[]>('/api/suppliers', { headers: requestHeaders, query: { page_size: 500 } })
)
const supplierOptions = computed(() =>
  (Array.isArray(suppliersData.value) ? suppliersData.value : (suppliersData.value as any)?.items ?? [])
    .map((s: any) => ({ label: s.name, value: s.id }))
)

// ─── Reject Modal ─────────────────────────────────
const showRejectModal = ref(false)
const isRejecting = ref(false)
const selectedForAction = ref<PurchaseRequest | null>(null)
const rejectionReason = ref('')

async function authorize(req: PurchaseRequest) {
  try {
    await $fetch(`/api/purchase-requests/${req.id}/authorize`, { method: 'POST' })
    toast.add({ title: 'Solicitação autorizada', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Não foi possível autorizar', color: 'error' })
  }
}

function openReject(req: PurchaseRequest) {
  selectedForAction.value = req
  rejectionReason.value = ''
  showRejectModal.value = true
}

async function confirmReject() {
  if (isRejecting.value || !selectedForAction.value) return
  isRejecting.value = true
  try {
    await $fetch(`/api/purchase-requests/${selectedForAction.value.id}/reject`, {
      method: 'POST',
      body: { rejection_reason: rejectionReason.value || null },
    })
    toast.add({ title: 'Solicitação recusada', color: 'success' })
    showRejectModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Não foi possível recusar', color: 'error' })
  } finally {
    isRejecting.value = false
  }
}

// ─── Form Modal ────────────────────────────────────
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const selectedId = ref<string | null>(null)

type RequestItem = { description: string; quantity: number; estimated_unit_price: number; estimated_total_price: number; notes: string }

const emptyItem = (): RequestItem => ({ description: '', quantity: 1, estimated_unit_price: 0, estimated_total_price: 0, notes: '' })

const emptyForm = () => ({
  supplier_id: '',
  justification: '',
  notes: '',
})

const form = reactive(emptyForm())
const items = ref<RequestItem[]>([emptyItem()])

function addItem() { items.value.push(emptyItem()) }
function removeItem(i: number) { if (items.value.length > 1) items.value.splice(i, 1) }

function recalcItem(item: RequestItem) {
  item.estimated_total_price = parseFloat(String(item.quantity || 0)) * parseFloat(String(item.estimated_unit_price || 0))
}

const totalAmount = computed(() => items.value.reduce((sum, i) => sum + (parseFloat(String(i.estimated_total_price)) || 0), 0))

function openCreate() {
  Object.assign(form, emptyForm())
  items.value = [emptyItem()]
  isEditing.value = false
  selectedId.value = null
  showModal.value = true
}

function openEdit(req: PurchaseRequest) {
  Object.assign(form, {
    supplier_id: req.supplier_id ?? '',
    justification: req.justification ?? '',
    notes: req.notes ?? '',
  })
  items.value = Array.isArray(req.items) && req.items.length ? req.items.map((i: any) => ({ ...i })) : [emptyItem()]
  isEditing.value = true
  selectedId.value = req.id
  showModal.value = true
}

async function save() {
  if (isSaving.value) return
  if (!form.supplier_id) { toast.add({ title: 'Fornecedor obrigatório', color: 'warning' }); return }
  if (items.value.some(i => !i.description)) { toast.add({ title: 'Todos os itens precisam de descrição', color: 'warning' }); return }

  isSaving.value = true
  try {
    const body = {
      supplier_id: form.supplier_id,
      items: items.value,
      total_request_amount: totalAmount.value,
      justification: form.justification || null,
      notes: form.notes || null,
    }
    if (isEditing.value && selectedId.value) {
      await $fetch(`/api/purchase-requests/${selectedId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Solicitação atualizada', color: 'success' })
    } else {
      await $fetch('/api/purchase-requests', { method: 'POST', body })
      toast.add({ title: 'Solicitação criada', color: 'success' })
    }
    showModal.value = false
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Não foi possível salvar', color: 'error' })
  } finally {
    isSaving.value = false
  }
}

async function remove(req: PurchaseRequest) {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await $fetch(`/api/purchase-requests/${req.id}`, { method: 'DELETE' })
    toast.add({ title: 'Solicitação removida', color: 'success' })
    await refresh()
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({ title: 'Erro', description: err?.data?.statusMessage || 'Não foi possível remover', color: 'error' })
  } finally {
    isDeleting.value = false
  }
}

function formatCurrency(value: number | string) {
  return parseFloat(String(value || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const statusFilterOptions = [
  { label: 'Todos', value: '' },
  { label: 'Aguardando', value: 'waiting' },
  { label: 'Autorizado', value: 'authorized' },
  { label: 'Recusado', value: 'rejected' },
  { label: 'Comprado', value: 'purchased' },
]

const statusColorMap: Record<string, string> = {
  waiting: 'warning',
  authorized: 'success',
  rejected: 'error',
  purchased: 'info',
}
const statusLabelMap: Record<string, string> = {
  waiting: 'Aguardando',
  authorized: 'Autorizado',
  rejected: 'Recusado',
  purchased: 'Comprado',
}

const columns = [
  { accessorKey: 'request_number', header: 'Número' },
  { accessorKey: 'request_date', header: 'Data' },
  { id: 'supplier', header: 'Fornecedor' },
  { accessorKey: 'requester', header: 'Solicitante' },
  { id: 'total_request_amount', header: 'Total estimado' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: '' },
]
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Autorizações de Compra">
        <template #leading>
          <AppSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="canCreate"
            label="Nova solicitação"
            icon="i-lucide-plus"
            color="neutral"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <div v-if="!canRead" class="p-6">
      <p class="text-sm text-muted">Você não tem permissão para visualizar solicitações de compra.</p>
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="flex flex-wrap gap-3 p-4 border-b border-default">
        <UInput
          v-model="search"
          placeholder="Buscar por número ou solicitante..."
          icon="i-lucide-search"
          class="w-72"
          @update:model-value="page = 1"
        />
        <USelectMenu
          v-model="statusFilter"
          :items="statusFilterOptions"
          value-key="value"
          class="w-44"
          placeholder="Todos"
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
        <template #total_request_amount-cell="{ row }">
          {{ formatCurrency(row.original.total_request_amount) }}
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
            <template v-if="canApprove && row.original.status === 'waiting'">
              <UButton
                icon="i-lucide-check"
                color="success"
                variant="ghost"
                size="xs"
                title="Autorizar"
                @click="authorize(row.original)"
              />
              <UButton
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="xs"
                title="Recusar"
                @click="openReject(row.original)"
              />
            </template>
            <UButton
              v-if="canUpdate && row.original.status === 'waiting'"
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

  <!-- Reject Modal -->
  <UModal v-model:open="showRejectModal" title="Recusar solicitação">
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-muted">
          Solicitação <strong>{{ selectedForAction?.request_number }}</strong> de
          <strong>{{ selectedForAction?.suppliers?.name ?? selectedForAction?.supplier_id }}</strong>
        </p>
        <UFormField label="Motivo da recusa">
          <UTextarea v-model="rejectionReason" class="w-full" :rows="3" placeholder="Opcional..." />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Cancelar" color="neutral" variant="ghost" @click="showRejectModal = false" />
        <UButton label="Recusar" color="error" :loading="isRejecting" :disabled="isRejecting" @click="confirmReject" />
      </div>
    </template>
  </UModal>

  <!-- Form Modal -->
  <UModal
    v-model:open="showModal"
    :title="isEditing ? 'Editar solicitação' : 'Nova solicitação de compra'"
    :ui="{ body: 'overflow-y-auto max-h-[80vh]' }"
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
          <UFormField label="Justificativa" class="sm:col-span-2">
            <UTextarea v-model="form.justification" class="w-full" :rows="2" />
          </UFormField>
        </div>

        <USeparator label="Itens" />

        <div v-for="(item, i) in items" :key="i" class="border border-default rounded-lg p-3 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-muted">Item {{ i + 1 }}</span>
            <UButton
              v-if="items.length > 1"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              @click="removeItem(i)"
            />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UFormField label="Descrição" required class="sm:col-span-2">
              <UInput v-model="item.description" class="w-full" />
            </UFormField>
            <UFormField label="Quantidade">
              <UInput v-model="item.quantity" type="number" min="1" class="w-full" @update:model-value="recalcItem(item)" />
            </UFormField>
            <UFormField label="Preço unitário estimado">
              <UInput v-model="item.estimated_unit_price" type="number" min="0" step="0.01" class="w-full" @update:model-value="recalcItem(item)" />
            </UFormField>
            <UFormField label="Total estimado" class="sm:col-span-2">
              <UInput :model-value="formatCurrency(item.estimated_total_price)" disabled class="w-full" />
            </UFormField>
          </div>
        </div>

        <UButton
          label="Adicionar item"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="addItem"
        />

        <div class="text-right text-sm font-semibold">
          Total: {{ formatCurrency(totalAmount) }}
        </div>

        <UFormField label="Observações">
          <UTextarea v-model="form.notes" class="w-full" :rows="2" />
        </UFormField>
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
