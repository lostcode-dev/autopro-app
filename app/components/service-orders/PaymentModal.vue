<script setup lang="ts">
import type { ServiceOrder } from '~/types/service-orders'

const props = defineProps<{
  open: boolean
  order: ServiceOrder | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  paid: []
}>()

const toast = useToast()
const isSaving = ref(false)

const PAYMENT_METHOD_OPTIONS = [
  { label: 'Pix', value: 'pix' },
  { label: 'Dinheiro', value: 'cash' },
  { label: 'Cartão de crédito', value: 'credit_card' },
  { label: 'Cartão de débito', value: 'debit_card' },
  { label: 'Boleto', value: 'bank_slip' },
  { label: 'Transferência', value: 'transfer' },
  { label: 'Cheque', value: 'check' }
]

const form = reactive({
  paymentMethod: 'pix',
  paymentDate: new Date().toISOString().split('T')[0]
})

watch(() => props.open, (open) => {
  if (!open) return
  form.paymentMethod = 'pix'
  form.paymentDate = new Date().toISOString().split('T')[0]
})

function formatCurrency(value: number | string | null | undefined) {
  return parseFloat(String(value || 0)).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

async function save() {
  if (!props.order || isSaving.value) return
  isSaving.value = true
  try {
    const totalAmount = Number(props.order.total_amount || 0)
    await $fetch(`/api/service-orders/${props.order.id}/process-payment`, {
      method: 'POST',
      body: {
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate,
        installments: [
          {
            amount: totalAmount,
            due_date: form.paymentDate,
            status: 'paid',
            payment_method: form.paymentMethod
          }
        ]
      }
    })
    toast.add({ title: 'Pagamento registrado com sucesso', color: 'success' })
    emit('update:open', false)
    emit('paid')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string }
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
    title="Receber pagamento"
    :description="order ? `OS #${order.number} — ${formatCurrency(order.total_amount)}` : ''"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Forma de pagamento" required>
          <USelectMenu
            v-model="form.paymentMethod"
            :items="PAYMENT_METHOD_OPTIONS"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Data do pagamento" required>
          <UiDatePicker v-model="form.paymentDate" class="w-full" />
        </UFormField>
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
          :disabled="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
