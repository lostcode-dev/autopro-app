<script setup lang="ts">
import { z } from 'zod'
import type { Debt, DebtInstallment } from '~/types/financial'

const props = defineProps<{
  open: boolean
  debt: Debt | null
  formatCurrency: (value: number) => string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: []
}>()

const { fetchDebt, addInstallment, toggleInstallmentPaid } = useFinancial()

const loading = ref(false)
const debtDetail = ref<Debt | null>(null)

const installmentSchema = z.object({
  amount: z.number({ error: 'Informe o valor' }).positive('O valor deve ser positivo'),
  dueDate: z.string().min(1, 'Informe a data de vencimento')
})

const installmentState = reactive({
  amount: 0,
  dueDate: ''
})

const addingInstallment = ref(false)
const showAddForm = ref(false)

watch(() => props.open, async (open) => {
  if (open && props.debt) {
    await loadDebt(props.debt.id)
  }
})

async function loadDebt(id: string): Promise<void> {
  loading.value = true
  try {
    debtDetail.value = await fetchDebt(id)
  }
  finally {
    loading.value = false
  }
}

async function onAddInstallment(): Promise<void> {
  if (!debtDetail.value) return
  addingInstallment.value = true
  try {
    const result = await addInstallment(debtDetail.value.id, {
      amount: installmentState.amount,
      dueDate: installmentState.dueDate
    })
    if (result) {
      installmentState.amount = 0
      installmentState.dueDate = ''
      showAddForm.value = false
      await loadDebt(debtDetail.value.id)
      emit('updated')
    }
  }
  finally {
    addingInstallment.value = false
  }
}

async function onTogglePaid(installment: DebtInstallment): Promise<void> {
  const result = await toggleInstallmentPaid(installment.id)
  if (result && debtDetail.value) {
    await loadDebt(debtDetail.value.id)
    emit('updated')
  }
}

function getProgress(): number {
  if (!debtDetail.value || debtDetail.value.totalAmount <= 0) return 0
  return Math.round(((debtDetail.value.totalAmount - debtDetail.value.remainingAmount) / debtDetail.value.totalAmount) * 100)
}
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <h3 class="text-lg font-semibold">
        {{ debtDetail?.name ?? 'Dívida' }}
      </h3>
    </template>

    <template #body>
      <div v-if="loading" class="space-y-4">
        <USkeleton class="h-6 w-40" />
        <USkeleton class="h-4 w-full" />
        <USkeleton v-for="i in 3" :key="i" class="h-12 w-full" />
      </div>

      <div v-else-if="debtDetail" class="space-y-6">
        <!-- Summary -->
        <div class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted">Valor total</span>
            <span class="font-medium">{{ formatCurrency(debtDetail.totalAmount) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted">Restante</span>
            <span class="font-medium text-red-500">{{ formatCurrency(debtDetail.remainingAmount) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted">Pago</span>
            <span class="font-medium text-green-500">{{ formatCurrency(debtDetail.totalAmount - debtDetail.remainingAmount) }}</span>
          </div>
          <UProgress :value="getProgress()" color="primary" size="sm" />
          <p class="text-xs text-muted text-center">{{ getProgress() }}% quitado</p>
        </div>

        <!-- Installments -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-medium">Parcelas</h4>
            <UButton
              icon="i-lucide-plus"
              label="Adicionar"
              size="xs"
              variant="subtle"
              @click="showAddForm = !showAddForm"
            />
          </div>

          <!-- Add installment form -->
          <div v-if="showAddForm" class="rounded-lg border border-default p-3 mb-3 space-y-3">
            <UForm :schema="installmentSchema" :state="installmentState" @submit="onAddInstallment">
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Valor (R$)" name="amount">
                  <UInput v-model.number="installmentState.amount" type="number" step="0.01" min="0" size="sm" class="w-full" />
                </UFormField>
                <UFormField label="Vencimento" name="dueDate">
                  <UInput v-model="installmentState.dueDate" type="date" size="sm" class="w-full" />
                </UFormField>
              </div>
              <div class="flex justify-end gap-2 mt-3">
                <UButton
                  icon="i-lucide-x"
                  label="Cancelar"
                  size="xs"
                  color="neutral"
                  variant="subtle"
                  @click="showAddForm = false"
                />
                <UButton
                  type="submit"
                  icon="i-lucide-check"
                  label="Salvar"
                  size="xs"
                  :loading="addingInstallment"
                />
              </div>
            </UForm>
          </div>

          <!-- Installment list -->
          <div v-if="!debtDetail.installments?.length" class="text-center py-4">
            <p class="text-sm text-muted">Nenhuma parcela cadastrada</p>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="inst in debtDetail.installments"
              :key="inst.id"
              class="flex items-center justify-between rounded-lg border border-default p-3"
              :class="{ 'opacity-60': inst.paid }"
            >
              <div class="flex items-center gap-3">
                <UCheckbox
                  :model-value="inst.paid"
                  @update:model-value="onTogglePaid(inst)"
                  size="sm"
                />
                <div>
                  <p class="text-sm font-medium" :class="{ 'line-through': inst.paid }">
                    {{ formatCurrency(inst.amount) }}
                  </p>
                  <p class="text-xs text-muted">
                    Vence em {{ new Date(inst.dueDate).toLocaleDateString('pt-BR') }}
                  </p>
                </div>
              </div>
              <UBadge v-if="inst.paid" size="xs" color="success" variant="subtle">
                Pago
              </UBadge>
              <UBadge v-else-if="new Date(inst.dueDate) < new Date()" size="xs" color="error" variant="subtle">
                Vencido
              </UBadge>
            </div>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
