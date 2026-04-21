<script setup lang="ts">
import { addMonths, format, parseISO } from 'date-fns'

type Entry = Record<string, unknown>
type BankAccountItem = {
  id: string
  account_name: string
  bank_name?: string | null
}
type CategoryDefault = { name: string; type: 'income' | 'expense' }
type CategoryCustom = { id: string; name: string; type: 'income' | 'expense' }
type CategoryResponse = { defaults: CategoryDefault[]; custom: CategoryCustom[] }

const props = defineProps<{
  open: boolean
  entry: Entry | null
  bankAccountOptions: BankAccountItem[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const isSaving = ref(false)
const showCategoryModal = ref(false)
const showRecurringDialog = ref(false)
const pendingPayload = ref<Record<string, unknown> | null>(null)

const NO_BANK_ACCOUNT = '__none__'
const NO_RECURRENCE = '__none__'

// ── Normalize helpers ──────────────────────────────────────────────────────────

function normalizeStatus(value: unknown) {
  const v = String(value || '').trim().toLowerCase()
  if (v === 'pago') return 'paid'
  if (v === 'pendente') return 'pending'
  return ['paid', 'pending'].includes(v) ? v : 'pending'
}

function normalizeRecurrence(value: unknown) {
  const v = String(value || '').trim().toLowerCase()
  if (!v || ['null', 'none', 'nao_recorrente', NO_RECURRENCE].includes(v)) return NO_RECURRENCE
  if (v === 'mensal') return 'monthly'
  if (v === 'anual') return 'yearly'
  if (v === 'semanal') return 'weekly'
  return ['monthly', 'yearly', 'weekly'].includes(v) ? v : NO_RECURRENCE
}

function recurrenceForApi(value: string) {
  if (value === NO_RECURRENCE) return null
  if (value === 'monthly') return 'mensal'
  if (value === 'yearly') return 'anual'
  if (value === 'weekly') return 'semanal'
  return value
}

// ── Categories ─────────────────────────────────────────────────────────────────

const categoriesLoading = ref(false)
const defaultCategories = ref<CategoryDefault[]>([])
const customCategories = ref<CategoryCustom[]>([])

async function fetchCategories() {
  categoriesLoading.value = true
  try {
    const res = await $fetch<CategoryResponse>('/api/financial/categories')
    defaultCategories.value = res.defaults
    customCategories.value = res.custom
  } catch {
    // keep empty on error
  } finally {
    categoriesLoading.value = false
  }
}

const categoryOptions = computed(() => {
  const currentType = form.type
  const fromDefaults = defaultCategories.value
    .filter(d => d.type === currentType)
    .map(d => ({ label: d.name, value: d.name.toLowerCase() }))
  const fromCustom = customCategories.value
    .filter(c => c.type === currentType)
    .map(c => ({ label: c.name, value: c.name.toLowerCase() }))
  return [...fromDefaults, ...fromCustom]
})

// ── Installments ───────────────────────────────────────────────────────────────

interface Installment {
  number: number
  amount: number
  due_date: string
  status: string
}

const installmentCountOptions = Array.from({ length: 23 }, (_, i) => ({
  label: `${i + 2}x`,
  value: i + 2
}))

function generateInstallments(totalAmount: number, count: number, firstDate: string, firstStatus: string): Installment[] {
  if (!totalAmount || !count || !firstDate) return []
  const base = Math.floor((totalAmount * 100) / count) / 100
  const remainder = Math.round((totalAmount - base * count) * 100) / 100
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    amount: i === 0 ? base + remainder : base,
    due_date: format(addMonths(parseISO(firstDate), i), 'yyyy-MM-dd'),
    status: i === 0 ? firstStatus : 'pending'
  }))
}

// ── Form state ─────────────────────────────────────────────────────────────────

const form = reactive({
  description: '',
  amount: '' as string | number,
  due_date: '',
  type: 'expense' as 'income' | 'expense',
  status: 'pending',
  category: '',
  bank_account_id: NO_BANK_ACCOUNT,
  notes: '',
  recurrence: NO_RECURRENCE,
  recurrence_end_date: '',
  is_installment: false,
  installment_count: 2,
  is_editing_installment: false
})

const isEditing = computed(() => Boolean(props.entry?.id))

const isEditingRecurring = computed(() => {
  if (!props.entry) return false
  const rec = String(props.entry.recurrence || '').toLowerCase()
  return Boolean(props.entry.parent_recurrence_id) || ['mensal', 'anual', 'monthly', 'yearly'].includes(rec)
})

const previewInstallments = computed<Installment[]>(() => {
  if (!form.is_installment || form.is_editing_installment || isEditing.value) return []
  const amount = Number(form.amount) || 0
  const count = form.installment_count || 2
  if (!amount || !form.due_date) return []
  return generateInstallments(amount, count, form.due_date, form.status)
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    fetchCategories()

    if (props.entry) {
      const e = props.entry
      Object.assign(form, {
        description: String(e.description ?? ''),
        amount: e.amount == null ? '' : Number(e.amount),
        due_date: String(e.due_date ?? ''),
        type: String(e.type ?? 'expense') as 'income' | 'expense',
        status: normalizeStatus(e.status),
        category: String(e.category ?? '').toLowerCase(),
        bank_account_id: e.bank_account_id ? String(e.bank_account_id) : NO_BANK_ACCOUNT,
        notes: String(e.notes ?? ''),
        recurrence: normalizeRecurrence(e.recurrence),
        recurrence_end_date: e.recurrence_end_date ? String(e.recurrence_end_date) : '',
        is_installment: false,
        installment_count: 2,
        is_editing_installment: Boolean(e.is_installment)
      })
      return
    }

    Object.assign(form, {
      description: '',
      amount: '',
      due_date: '',
      type: 'expense',
      status: 'pending',
      category: '',
      bank_account_id: NO_BANK_ACCOUNT,
      notes: '',
      recurrence: NO_RECURRENCE,
      recurrence_end_date: '',
      is_installment: false,
      installment_count: 2,
      is_editing_installment: false
    })
  },
  { immediate: true }
)

// Reset category when type toggles
watch(() => form.type, () => { form.category = '' })

// ── Bank account items ─────────────────────────────────────────────────────────

const bankItems = computed(() => [
  { label: 'Não vincular a uma conta', value: NO_BANK_ACCOUNT },
  ...props.bankAccountOptions.map(a => ({
    label: `${a.account_name}${a.bank_name ? ` — ${a.bank_name}` : ''}`,
    value: a.id
  }))
])

// ── Static options ─────────────────────────────────────────────────────────────

const recurrenceOptions = [
  { label: 'Sem recorrência', value: NO_RECURRENCE },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Mensal', value: 'monthly' },
  { label: 'Anual', value: 'yearly' }
]

const statusOptions = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Pago', value: 'paid' }
]

// ── Save logic ─────────────────────────────────────────────────────────────────

function buildBody() {
  return {
    description: form.description.trim(),
    amount: Number(form.amount),
    due_date: form.due_date,
    type: form.type,
    status: form.status === 'paid' ? 'pago' : 'pendente',
    category: form.category.trim(),
    bank_account_id: form.bank_account_id === NO_BANK_ACCOUNT ? null : form.bank_account_id,
    notes: form.notes.trim() || null,
    recurrence: recurrenceForApi(form.recurrence),
    recurrence_end_date: (form.recurrence !== NO_RECURRENCE && form.recurrence_end_date) ? form.recurrence_end_date : null
  }
}

async function save() {
  if (isSaving.value) return
  if (!form.description.trim()) return toast.add({ title: 'Descrição obrigatória', color: 'warning' })
  if (!form.amount || Number(form.amount) <= 0) return toast.add({ title: 'Valor inválido', color: 'warning' })
  if (!form.due_date) return toast.add({ title: 'Data de vencimento obrigatória', color: 'warning' })
  if (!form.category.trim()) return toast.add({ title: 'Categoria obrigatória', color: 'warning' })

  if (isEditing.value && isEditingRecurring.value) {
    pendingPayload.value = buildBody()
    showRecurringDialog.value = true
    return
  }

  await doSave(buildBody())
}

async function doSave(body: Record<string, unknown>, recurringScope?: 'single' | 'future') {
  isSaving.value = true
  try {
    if (isEditing.value && props.entry?.id) {
      const entryId = String(props.entry.id)
      if (recurringScope === 'future') {
        await $fetch('/api/financial/update-recurring', {
          method: 'POST',
          body: { originalEntryId: entryId, updateData: body }
        })
      } else {
        await $fetch(`/api/financial/${entryId}`, { method: 'PUT', body })
      }
      toast.add({ title: 'Lançamento atualizado', color: 'success' })
    } else {
      if (form.is_installment && previewInstallments.value.length > 1) {
        await $fetch('/api/financial', {
          method: 'POST',
          body: {
            ...body,
            is_installment: true,
            installment_count: previewInstallments.value.length,
            installments: previewInstallments.value
          }
        })
      } else {
        await $fetch('/api/financial', { method: 'POST', body })
      }
      toast.add({ title: 'Lançamento criado', color: 'success' })
    }
    emit('update:open', false)
    emit('saved')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

async function confirmRecurringSingle() {
  showRecurringDialog.value = false
  if (!pendingPayload.value) return
  const payload = pendingPayload.value
  pendingPayload.value = null
  await doSave(payload, 'single')
}

async function confirmRecurringFuture() {
  showRecurringDialog.value = false
  if (!pendingPayload.value) return
  const payload = pendingPayload.value
  pendingPayload.value = null
  await doSave(payload, 'future')
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

<template>
  <UModal
    :open="open"
    :title="isEditing ? 'Editar lançamento' : 'Novo lançamento'"
    :description="isEditing ? 'Atualize os dados do lançamento financeiro.' : 'Cadastre uma nova receita ou despesa da oficina.'"
    :ui="{ body: 'overflow-y-auto max-h-[72vh]' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Descrição -->
        <UFormField label="Descrição" required>
          <UInput
            v-model="form.description"
            class="w-full"
            placeholder="Ex: Pagamento de fornecedor, entrada de serviço..."
          />
        </UFormField>

        <!-- Tipo toggle -->
        <UFormField label="Tipo" required>
          <div class="flex w-full overflow-hidden rounded-lg border border-default">
            <button
              type="button"
              class="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors focus:outline-none"
              :class="form.type === 'income'
                ? 'bg-success/10 text-success'
                : 'text-muted hover:bg-elevated'"
              @click="form.type = 'income'"
            >
              <UIcon name="i-lucide-trending-up" class="size-4" />
              Entrada
            </button>
            <div class="w-px bg-border" />
            <button
              type="button"
              class="flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors focus:outline-none"
              :class="form.type === 'expense'
                ? 'bg-error/10 text-error'
                : 'text-muted hover:bg-elevated'"
              @click="form.type = 'expense'"
            >
              <UIcon name="i-lucide-trending-down" class="size-4" />
              Saída
            </button>
          </div>
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- Valor -->
          <UFormField label="Valor total" required>
            <UiCurrencyInput v-model="form.amount" class="w-full" />
          </UFormField>

          <!-- Status -->
          <UFormField label="Status">
            <USelectMenu
              v-model="form.status"
              :items="statusOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <!-- Vencimento -->
          <UFormField label="1º Vencimento" required>
            <UiDatePicker v-model="form.due_date" class="w-full" />
          </UFormField>

          <!-- Conta bancária -->
          <UFormField label="Conta bancária">
            <USelectMenu
              v-model="form.bank_account_id"
              :items="bankItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <!-- Categoria + botão gerenciar -->
          <UFormField label="Categoria" required class="sm:col-span-2">
            <div class="flex gap-2">
              <USelectMenu
                v-model="form.category"
                :items="categoryOptions"
                value-key="value"
                placeholder="Selecionar categoria..."
                :loading="categoriesLoading"
                class="flex-1"
              />
              <UTooltip text="Gerenciar categorias">
                <UButton
                  icon="i-lucide-settings-2"
                  color="neutral"
                  variant="outline"
                  @click="showCategoryModal = true"
                />
              </UTooltip>
            </div>
          </UFormField>

          <!-- Recorrência -->
          <UFormField label="Recorrência">
            <USelectMenu
              v-model="form.recurrence"
              :items="recurrenceOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <!-- Data encerramento recorrência -->
          <UFormField
            v-if="form.recurrence !== NO_RECURRENCE"
            label="Encerrar recorrência em"
          >
            <UiDatePicker v-model="form.recurrence_end_date" class="w-full" />
          </UFormField>
        </div>

        <!-- Parcelamento (apenas criação) -->
        <template v-if="!isEditing">
          <div class="rounded-lg border border-default bg-elevated p-4 space-y-3">
            <UCheckbox
              v-model="form.is_installment"
              label="Lançamento parcelado?"
            />

            <template v-if="form.is_installment">
              <UFormField label="Número de parcelas">
                <USelectMenu
                  v-model="form.installment_count"
                  :items="installmentCountOptions"
                  value-key="value"
                  class="w-40"
                />
              </UFormField>

              <template v-if="previewInstallments.length > 0">
                <p class="text-xs font-medium text-muted">Prévia das parcelas</p>
                <div class="max-h-44 overflow-y-auto rounded-md border border-default divide-y divide-default">
                  <div
                    v-for="inst in previewInstallments"
                    :key="inst.number"
                    class="flex items-center justify-between px-3 py-1.5 text-sm"
                  >
                    <span class="text-muted">
                      {{ inst.number }}ª parcela — {{ inst.due_date.split('-').reverse().join('/') }}
                    </span>
                    <span class="font-medium tabular-nums">{{ formatCurrency(inst.amount) }}</span>
                  </div>
                </div>
              </template>
            </template>
          </div>
        </template>

        <!-- Aviso: editando parcela existente -->
        <UAlert
          v-if="isEditing && form.is_editing_installment"
          icon="i-lucide-info"
          color="info"
          variant="soft"
          title="Este lançamento faz parte de um parcelamento"
          description="Você está editando apenas esta parcela. Para alterar as demais, edite-as individualmente."
        />

        <!-- Observações -->
        <UFormField label="Observações">
          <UTextarea
            v-model="form.notes"
            class="w-full"
            :rows="3"
            placeholder="Use este campo para contexto adicional do lançamento."
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          @click="emit('update:open', false)"
        />
        <UButton
          :label="isEditing ? 'Salvar alterações' : (form.is_installment ? `Criar ${form.installment_count} parcelas` : 'Criar lançamento')"
          color="neutral"
          :loading="isSaving"
          :disabled="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>

  <!-- Dialog: edição de recorrência -->
  <UModal
    v-model:open="showRecurringDialog"
    title="Lançamento recorrente"
    description="Este lançamento faz parte de uma série recorrente. O que deseja alterar?"
  >
    <template #footer>
      <div class="flex flex-col gap-2 w-full sm:flex-row sm:justify-end">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          :disabled="isSaving"
          @click="showRecurringDialog = false"
        />
        <UButton
          label="Somente este"
          color="neutral"
          variant="outline"
          :loading="isSaving"
          @click="confirmRecurringSingle"
        />
        <UButton
          label="Este e os próximos"
          color="neutral"
          :loading="isSaving"
          @click="confirmRecurringFuture"
        />
      </div>
    </template>
  </UModal>

  <!-- Modal: gerenciar categorias -->
  <FinancialEntriesCategoryModal
    v-model:open="showCategoryModal"
    :current-type="form.type"
    :custom-categories="customCategories"
    @updated="fetchCategories"
  />
</template>
