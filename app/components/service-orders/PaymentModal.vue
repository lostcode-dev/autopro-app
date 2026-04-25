<script setup lang="ts">
import type { ServiceOrder } from '~/types/service-orders'

type PaymentMethod = 'pix' | 'cash' | 'credit_card' | 'debit_card' | 'bank_slip' | 'transfer' | 'check'
type PaymentMethodOption = { label: string, value: PaymentMethod, icon: string }
type BankAccountItem = {
  id: string
  account_name: string
  bank_name: string | null
  preferred_payment_method: string | null
}
type PaymentTerminalItem = {
  id: string
  terminal_name: string
  provider_company: string | null
}
type InstallmentStatus = 'paid' | 'pending'
type InstallmentRow = {
  number: number
  amount: number
  due_date: string
  status: InstallmentStatus
}

const props = defineProps<{
  open: boolean
  order: ServiceOrder | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'paid': []
}>()

const toast = useToast()
const isSaving = ref(false)
const isLoadingOptions = ref(false)
const bankAccounts = ref<BankAccountItem[]>([])
const paymentTerminals = ref<PaymentTerminalItem[]>([])

const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { label: 'Pix', value: 'pix', icon: 'i-lucide-qr-code' },
  { label: 'Dinheiro', value: 'cash', icon: 'i-lucide-banknote' },
  { label: 'Cartão de crédito', value: 'credit_card', icon: 'i-lucide-credit-card' },
  { label: 'Cartão de débito', value: 'debit_card', icon: 'i-lucide-credit-card' },
  { label: 'Boleto', value: 'bank_slip', icon: 'i-lucide-file-text' },
  { label: 'Transferência', value: 'transfer', icon: 'i-lucide-arrow-right-left' },
  { label: 'Cheque', value: 'check', icon: 'i-lucide-scroll-text' }
]
const INSTALLMENT_STATUS_OPTIONS = [
  { label: 'Pago', value: 'paid' },
  { label: 'Pendente', value: 'pending' }
] as const
const INSTALLMENT_COUNT_OPTIONS = Array.from({ length: 11 }, (_, index) => {
  const value = index + 2
  return { label: `${value} parcelas`, value }
})

const today = () => new Date().toISOString().split('T')[0]

const form = reactive({
  paymentMethod: 'pix' as PaymentMethod,
  paymentDate: today(),
  isInstallment: false,
  installmentCount: 2,
  bankAccountId: '',
  paymentTerminalId: ''
})

const installments = ref<InstallmentRow[]>([])

const orderTotalAmount = computed(() => Number(props.order?.total_amount || 0))
const selectedPaymentMethod = computed(() =>
  PAYMENT_METHOD_OPTIONS.find(option => option.value === form.paymentMethod) ?? PAYMENT_METHOD_OPTIONS[0]
)
const selectedBankAccount = computed(() =>
  bankAccounts.value.find(account => account.id === form.bankAccountId) ?? null
)
const showTerminalField = computed(() => ['credit_card', 'debit_card'].includes(form.paymentMethod))
const installmentTotal = computed(() =>
  installments.value.reduce((total, installment) => total + Number(installment.amount || 0), 0)
)
const installmentsMatch = computed(() => Math.abs(installmentTotal.value - orderTotalAmount.value) < 0.01)
const paidInstallmentCount = computed(() => installments.value.filter(installment => installment.status === 'paid').length)
const bankAccountOptions = computed(() =>
  bankAccounts.value.map(account => ({
    label: `${account.account_name}${account.bank_name ? ` — ${account.bank_name}` : ''}`,
    value: account.id
  }))
)
const paymentTerminalOptions = computed(() =>
  paymentTerminals.value.map(terminal => ({
    label: `${terminal.terminal_name}${terminal.provider_company ? ` — ${terminal.provider_company}` : ''}`,
    value: terminal.id
  }))
)

function addMonthsToDate(value: string, months: number) {
  const baseDate = new Date(`${value}T00:00:00`)
  baseDate.setMonth(baseDate.getMonth() + months)
  return baseDate.toISOString().split('T')[0]
}

function distributeInstallments(count: number, totalAmount: number, paymentDate: string) {
  if (!count || count < 1) return []

  const baseAmount = Math.floor((totalAmount / count) * 100) / 100
  const generated = Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    amount: baseAmount,
    due_date: addMonthsToDate(paymentDate, index),
    status: (index === 0 ? 'paid' : 'pending') as InstallmentStatus
  }))
  const difference = Number((totalAmount - (baseAmount * count)).toFixed(2))

  if (generated.length > 0) {
    generated[0].amount = Number((generated[0].amount + difference).toFixed(2))
  }

  return generated
}

function resetInstallments() {
  installments.value = form.isInstallment
    ? distributeInstallments(form.installmentCount, orderTotalAmount.value, form.paymentDate)
    : [
        {
          number: 1,
          amount: orderTotalAmount.value,
          due_date: form.paymentDate,
          status: 'paid'
        }
      ]
}

function normalizePaymentMethod(value: string | null | undefined): PaymentMethod | null {
  if (!value) return null

  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  const aliasMap: Record<string, PaymentMethod> = {
    pix: 'pix',
    cash: 'cash',
    dinheiro: 'cash',
    credit_card: 'credit_card',
    cartao_credito: 'credit_card',
    debit_card: 'debit_card',
    cartao_debito: 'debit_card',
    bank_slip: 'bank_slip',
    boleto: 'bank_slip',
    transfer: 'transfer',
    transferencia: 'transfer',
    check: 'check',
    cheque: 'check'
  }

  return aliasMap[normalized] ?? null
}

function resetForm() {
  form.paymentMethod = 'pix'
  form.paymentDate = today()
  form.isInstallment = false
  form.installmentCount = 2
  form.bankAccountId = ''
  form.paymentTerminalId = ''
  resetInstallments()
}

async function loadReferenceData() {
  isLoadingOptions.value = true
  try {
    const [accountsResponse, terminalsResponse] = await Promise.all([
      $fetch<{ items: BankAccountItem[] }>('/api/bank-accounts', {
        query: { page_size: 100, is_active: true }
      }),
      $fetch<{ items: PaymentTerminalItem[] }>('/api/payment-terminals', {
        query: { page_size: 100 }
      })
    ])

    bankAccounts.value = accountsResponse.items ?? []
    paymentTerminals.value = terminalsResponse.items ?? []

    const defaultAccount = bankAccounts.value[0] ?? null
    form.bankAccountId = defaultAccount?.id ?? ''

    const preferredPaymentMethod = normalizePaymentMethod(defaultAccount?.preferred_payment_method)
    if (preferredPaymentMethod)
      form.paymentMethod = preferredPaymentMethod
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao carregar dados do pagamento',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isLoadingOptions.value = false
  }
}

watch(() => props.open, async (open) => {
  if (!open) return

  resetForm()
  await loadReferenceData()
  resetInstallments()
})

watch(() => form.paymentDate, () => {
  resetInstallments()
})

watch(() => form.isInstallment, (isInstallment) => {
  if (!isInstallment)
    form.installmentCount = 2

  resetInstallments()
})

watch(() => form.installmentCount, () => {
  if (!form.isInstallment) return
  resetInstallments()
})

watch(() => form.paymentMethod, () => {
  if (!showTerminalField.value)
    form.paymentTerminalId = ''

  installments.value = installments.value.map((installment, index) => ({
    ...installment,
    status: form.isInstallment ? installment.status : 'paid',
    due_date: form.isInstallment ? installment.due_date : form.paymentDate,
    number: index + 1
  }))
})

watch(() => form.bankAccountId, (bankAccountId, previousId) => {
  if (!bankAccountId || bankAccountId === previousId) return

  const preferredPaymentMethod = normalizePaymentMethod(selectedBankAccount.value?.preferred_payment_method)
  if (preferredPaymentMethod)
    form.paymentMethod = preferredPaymentMethod
})

function formatCurrency(value: number | string | null | undefined) {
  return parseFloat(String(value || 0)).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function formatInstallmentLabel(count: number) {
  return count === 1 ? 'À vista' : `${count} parcelas`
}

async function save() {
  if (!props.order || isSaving.value) return
  if (!form.bankAccountId) {
    toast.add({ title: 'Selecione a conta bancária', color: 'warning' })
    return
  }
  if (form.isInstallment && !installmentsMatch.value) {
    toast.add({ title: 'O total das parcelas precisa bater com o valor da OS', color: 'warning' })
    return
  }

  isSaving.value = true
  try {
    const body = {
      paymentMethod: form.paymentMethod,
      paymentDate: form.paymentDate,
      bankAccountId: form.bankAccountId,
      paymentTerminalId: form.paymentTerminalId || null,
      installments: form.isInstallment
        ? installments.value.map(installment => ({
            amount: Number(installment.amount || 0),
            due_date: installment.due_date,
            status: installment.status,
            payment_method: form.paymentMethod,
            bank_account_id: form.bankAccountId,
            payment_terminal_id: form.paymentTerminalId || null
          }))
        : undefined
    }

    await $fetch(`/api/service-orders/${props.order.id}/process-payment`, {
      method: 'POST',
      body
    })
    toast.add({ title: 'Pagamento registrado com sucesso', color: 'success' })
    emit('update:open', false)
    emit('paid')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    toast.add({
      title: 'Erro ao registrar pagamento',
      description: err?.data?.statusMessage || err?.statusMessage || 'Tente novamente.',
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
    title="Processar pagamento"
    :description="order ? `OS #${order.number}` : ''"
    :ui="{ content: 'sm:max-w-5xl lg:max-w-6xl', body: 'overflow-y-auto max-h-[82vh]' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-5">
        <div class="rounded-2xl border border-success/20 bg-gradient-to-br from-success/10 via-success/5 to-transparent p-4">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="space-y-1">
              <div class="flex items-center gap-2 text-sm font-medium text-success">
                <UIcon name="i-lucide-wallet-cards" class="size-4" />
                Configuração do Pagamento
              </div>
              <p class="text-xl font-semibold text-highlighted">
                {{ formatCurrency(order?.total_amount) }}
              </p>
              <p class="text-sm text-muted">
                {{ order?.client_name || 'Cliente não informado' }}
              </p>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs sm:min-w-[220px]">
              <div class="rounded-xl border border-default bg-default px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted">
                  Método
                </p>
                <p class="mt-1 font-medium text-highlighted">
                  {{ selectedPaymentMethod.label }}
                </p>
              </div>
              <div class="rounded-xl border border-default bg-default px-3 py-2">
                <p class="text-[11px] uppercase tracking-wide text-muted">
                  Condição
                </p>
                <p class="mt-1 font-medium text-highlighted">
                  {{ formatInstallmentLabel(form.isInstallment ? form.installmentCount : 1) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="isLoadingOptions" class="flex items-center gap-2 rounded-xl border border-default px-4 py-3 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
          Carregando contas e maquininhas...
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <UFormField label="Conta bancária" required>
            <USelectMenu
              v-model="form.bankAccountId"
              :items="bankAccountOptions"
              value-key="value"
              placeholder="Selecione a conta bancária"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="form.isInstallment ? '1º vencimento' : 'Data do pagamento'" required>
            <UiDatePicker v-model="form.paymentDate" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Forma de pagamento" required>
          <USelectMenu
            v-model="form.paymentMethod"
            :items="PAYMENT_METHOD_OPTIONS"
            value-key="value"
            label-key="label"
            class="w-full"
            :ui="{ base: 'min-h-14 rounded-xl ps-14' }"
          >
            <template #leading>
              <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UIcon :name="selectedPaymentMethod.icon" class="size-4" />
              </div>
            </template>
          </USelectMenu>
        </UFormField>

        <div class="rounded-xl border border-default p-4 space-y-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-medium text-highlighted">
                Condição de pagamento
              </p>
              <p class="text-xs text-muted">
                Igual ao fluxo do legado: à vista ou parcelado com parcelas editáveis.
              </p>
            </div>

            <div class="flex w-full overflow-hidden rounded-lg border border-default sm:w-auto">
              <button
                type="button"
                class="flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
                :class="!form.isInstallment ? 'bg-success/10 text-success' : 'text-muted hover:bg-elevated'"
                @click="form.isInstallment = false"
              >
                <UIcon name="i-lucide-badge-check" class="size-4" />
                À vista
              </button>
              <div class="w-px bg-border" />
              <button
                type="button"
                class="flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
                :class="form.isInstallment ? 'bg-warning/10 text-warning' : 'text-muted hover:bg-elevated'"
                @click="form.isInstallment = true"
              >
                <UIcon name="i-lucide-split" class="size-4" />
                Parcelado
              </button>
            </div>
          </div>

          <div v-if="form.isInstallment" class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Número de parcelas" required>
              <USelectMenu
                v-model="form.installmentCount"
                :items="INSTALLMENT_COUNT_OPTIONS"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <UFormField v-if="showTerminalField" label="Maquininha">
              <USelectMenu
                v-model="form.paymentTerminalId"
                :items="paymentTerminalOptions"
                value-key="value"
                placeholder="Selecionar maquininha"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField v-else-if="showTerminalField" label="Maquininha">
            <USelectMenu
              v-model="form.paymentTerminalId"
              :items="paymentTerminalOptions"
              value-key="value"
              placeholder="Selecionar maquininha"
              class="w-full"
            />
          </UFormField>

          <div
            v-if="form.isInstallment"
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
            :class="installmentsMatch ? 'border-success/30 bg-success/5' : 'border-error/30 bg-error/5'"
          >
            <div class="flex flex-wrap items-center gap-4">
              <span class="text-muted">Valor da OS: <strong class="text-highlighted">{{ formatCurrency(orderTotalAmount) }}</strong></span>
              <span class="text-muted">Total das parcelas: <strong :class="installmentsMatch ? 'text-success' : 'text-error'">{{ formatCurrency(installmentTotal) }}</strong></span>
              <span class="text-muted">Parcelas pagas agora: <strong class="text-highlighted">{{ paidInstallmentCount }}</strong></span>
            </div>
            <UIcon
              :name="installmentsMatch ? 'i-lucide-circle-check-big' : 'i-lucide-circle-alert'"
              class="size-4 shrink-0"
              :class="installmentsMatch ? 'text-success' : 'text-error'"
            />
          </div>

          <div v-if="form.isInstallment" class="space-y-2">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              Parcelas do cliente
            </p>
            <div class="overflow-hidden rounded-xl border border-default">
              <div
                v-for="installment in installments"
                :key="installment.number"
                class="grid grid-cols-1 gap-2 border-b border-default px-3 py-3 last:border-b-0 md:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_160px]"
              >
                <div class="flex items-center gap-2 text-sm font-medium text-highlighted">
                  <UIcon name="i-lucide-hash" class="size-4 text-primary" />
                  {{ installment.number }}ª
                </div>

                <UiCurrencyInput v-model="installment.amount" class="w-full" />

                <UiDatePicker v-model="installment.due_date" class="w-full" />

                <USelectMenu
                  v-model="installment.status"
                  :items="INSTALLMENT_STATUS_OPTIONS"
                  value-key="value"
                  class="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          :disabled="isSaving"
          @click="emit('update:open', false)"
        />
        <UButton
          label="Registrar pagamento"
          color="success"
          :loading="isSaving"
          :disabled="isSaving || isLoadingOptions"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
