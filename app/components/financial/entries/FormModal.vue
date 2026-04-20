<script setup lang="ts">
type Entry = Record<string, unknown>
type BankAccountOption = {
  label: string
  value: string
}

const props = defineProps<{
  open: boolean
  entry: Entry | null
  bankAccountOptions: BankAccountOption[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

const toast = useToast()
const isSaving = ref(false)

const NO_RECURRENCE_VALUE = '__none__'

function normalizeStatusValue(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'pago') return 'paid'
  if (normalized === 'pendente') return 'pending'
  if (normalized === 'paid' || normalized === 'pending') return normalized
  return 'pending'
}

function normalizeStatusForApi(value: string) {
  return value === 'paid' ? 'pago' : 'pendente'
}

function normalizeRecurrenceValue(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase()

  if (!normalized || normalized === 'null' || normalized === 'none' || normalized === 'nao_recorrente')
    return NO_RECURRENCE_VALUE

  if (normalized === 'mensal') return 'monthly'
  if (normalized === 'anual') return 'yearly'
  if (normalized === 'semanal') return 'weekly'
  if (normalized === 'monthly' || normalized === 'yearly' || normalized === 'weekly')
    return normalized

  return NO_RECURRENCE_VALUE
}

function normalizeRecurrenceForApi(value: string) {
  if (value === NO_RECURRENCE_VALUE) return null
  if (value === 'monthly') return 'mensal'
  if (value === 'yearly') return 'anual'
  if (value === 'weekly') return 'semanal'
  return value
}

const isEditing = computed(() => Boolean(props.entry?.id))

const form = reactive({
  description: '',
  amount: '' as string | number,
  due_date: '',
  type: 'expense',
  status: 'pending',
  category: '',
  bank_account_id: '',
  notes: '',
  recurrence: NO_RECURRENCE_VALUE
})

watch(
  () => props.open,
  (open) => {
    if (!open) return

    if (props.entry) {
      Object.assign(form, {
        description: String(props.entry.description ?? ''),
        amount: props.entry.amount == null ? '' : Number(props.entry.amount),
        due_date: String(props.entry.due_date ?? ''),
        type: String(props.entry.type ?? 'expense'),
        status: normalizeStatusValue(props.entry.status),
        category: String(props.entry.category ?? ''),
        bank_account_id: String(props.entry.bank_account_id ?? ''),
        notes: String(props.entry.notes ?? ''),
        recurrence: normalizeRecurrenceValue(props.entry.recurrence)
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
      bank_account_id: '',
      notes: '',
      recurrence: NO_RECURRENCE_VALUE
    })
  },
  { immediate: true }
)

async function save() {
  if (isSaving.value) return

  if (!form.description.trim()) {
    toast.add({ title: 'Descrição obrigatória', color: 'warning' })
    return
  }

  if (form.amount === '' || Number(form.amount) <= 0) {
    toast.add({ title: 'Valor inválido', color: 'warning' })
    return
  }

  if (!form.due_date) {
    toast.add({ title: 'Data de vencimento obrigatória', color: 'warning' })
    return
  }

  if (!form.category.trim()) {
    toast.add({ title: 'Categoria obrigatória', color: 'warning' })
    return
  }

  isSaving.value = true

  try {
    const body = {
      description: form.description.trim(),
      amount: Number(form.amount),
      due_date: form.due_date,
      type: form.type,
      status: normalizeStatusForApi(form.status),
      category: form.category.trim(),
      bank_account_id: form.bank_account_id || null,
      notes: form.notes.trim() || null,
      recurrence: normalizeRecurrenceForApi(form.recurrence)
    }

    if (isEditing.value && props.entry?.id) {
      await $fetch(`/api/financial/${String(props.entry.id)}`, { method: 'PUT', body })
      toast.add({ title: 'Lançamento atualizado', color: 'success' })
    } else {
      await $fetch('/api/financial', { method: 'POST', body })
      toast.add({ title: 'Lançamento criado', color: 'success' })
    }

    emit('update:open', false)
    emit('saved')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro',
      description: err?.data?.statusMessage || err?.statusMessage || 'Não foi possível salvar',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

const typeOptions = [
  { label: 'Receita', value: 'income' },
  { label: 'Despesa', value: 'expense' }
]

const statusOptions = [
  { label: 'Pendente', value: 'pending' },
  { label: 'Pago', value: 'paid' }
]

const recurrenceOptions = [
  { label: 'Sem recorrência', value: NO_RECURRENCE_VALUE },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Mensal', value: 'monthly' },
  { label: 'Anual', value: 'yearly' }
]
</script>

<template>
  <UModal
    :open="open"
    :title="isEditing ? 'Editar lançamento' : 'Novo lançamento'"
    :description="isEditing ? 'Atualize os dados do lançamento financeiro.' : 'Cadastre uma nova receita ou despesa da oficina.'"
    :ui="{ body: 'overflow-y-auto max-h-[70vh]' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Descrição" required>
          <UInput
            v-model="form.description"
            class="w-full"
            placeholder="Ex: Pagamento de fornecedor, entrada de serviço..."
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Tipo" required>
            <USelectMenu
              v-model="form.type"
              :items="typeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Valor" required>
            <UiCurrencyInput v-model="form.amount" />
          </UFormField>

          <UFormField label="Vencimento" required>
            <UiDatePicker
              v-model="form.due_date"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Status">
            <USelectMenu
              v-model="form.status"
              :items="statusOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Categoria" required class="sm:col-span-2">
            <UInput
              v-model="form.category"
              class="w-full"
              placeholder="Ex: Serviços, peças, salários, aluguel..."
            />
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

          <UFormField label="Recorrência">
            <USelectMenu
              v-model="form.recurrence"
              :items="recurrenceOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>

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
          :label="isEditing ? 'Salvar alterações' : 'Criar lançamento'"
          color="neutral"
          :loading="isSaving"
          :disabled="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
