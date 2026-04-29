<script setup lang="ts">
import type { ServiceOrderCommission, ServiceOrderEmployee } from '~/types/service-orders'
import { formatCurrency, formatDate } from '~/utils/service-orders'

const props = defineProps<{
  commissions: ServiceOrderCommission[]
  employees: ServiceOrderEmployee[]
  canUpdate?: boolean
}>()

const emit = defineEmits<{ paid: [] }>()

const toast = useToast()

const employeeNameById = computed(() =>
  new Map(props.employees.map(e => [e.id, e.name]))
)

function getEmployeeName(employeeId: string | null) {
  if (!employeeId) return 'Funcionário não encontrado'
  return employeeNameById.value.get(employeeId) ?? 'Funcionário não encontrado'
}

function isPending(commission: ServiceOrderCommission) {
  const s = commission.status ?? ''
  return s !== 'pago' && s !== 'paid'
}

const pendingCommissions = computed(() => props.commissions.filter(isPending))

// ─── Pay single ────────────────────────────────────────────────────────────────

const confirmingId = ref<string | null>(null)
const payingId = ref<string | null>(null)

function requestPay(id: string) {
  confirmingId.value = id
}

async function confirmPaySingle() {
  if (!confirmingId.value) return
  const id = confirmingId.value
  payingId.value = id
  confirmingId.value = null

  try {
    await $fetch('/api/financial/pay-commissions-bulk', {
      method: 'POST',
      body: { registroIds: [id] }
    })
    toast.add({ title: 'Comissão paga com sucesso', color: 'success' })
    emit('paid')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Erro ao pagar comissão',
      description: err?.data?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    payingId.value = null
  }
}

// ─── Pay all pending ───────────────────────────────────────────────────────────

const showPayAllConfirm = ref(false)
const isPayingAll = ref(false)

async function confirmPayAll() {
  const ids = pendingCommissions.value.map(c => c.id)
  if (!ids.length) return
  isPayingAll.value = true
  showPayAllConfirm.value = false

  try {
    await $fetch('/api/financial/pay-commissions-bulk', {
      method: 'POST',
      body: { registroIds: ids }
    })
    toast.add({ title: 'Comissões pagas com sucesso', color: 'success' })
    emit('paid')
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } }
    toast.add({
      title: 'Erro ao pagar comissões',
      description: err?.data?.statusMessage || 'Tente novamente.',
      color: 'error'
    })
  } finally {
    isPayingAll.value = false
  }
}
</script>

<template>
  <UCard v-if="commissions.length" variant="subtle">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-wallet-cards" class="size-4 text-primary" />
          <h3 class="font-semibold text-highlighted">
            Comissões ({{ commissions.length }})
          </h3>
        </div>

        <UButton
          v-if="canUpdate && pendingCommissions.length > 1"
          size="xs"
          color="success"
          variant="soft"
          icon="i-lucide-check-check"
          :label="`Pagar todas (${pendingCommissions.length})`"
          :loading="isPayingAll"
          :disabled="!!payingId || isPayingAll"
          @click="showPayAllConfirm = true"
        />
      </div>
    </template>

    <div class="space-y-2">
      <div
        v-for="commission in commissions"
        :key="commission.id"
        class="flex items-center gap-3 rounded-lg border p-3"
        :class="!isPending(commission)
          ? 'border-success/30 bg-success/5'
          : 'border-default bg-elevated'"
      >
        <!-- Status indicator -->
        <div
          class="size-2 shrink-0 rounded-full"
          :class="!isPending(commission) ? 'bg-success' : 'bg-warning'"
        />

        <!-- Info -->
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-highlighted">
            {{ getEmployeeName(commission.employee_id) }}
          </p>
          <p v-if="commission.description" class="truncate text-xs text-muted">
            {{ commission.description }}
          </p>
          <p v-if="commission.payment_date" class="text-xs text-muted">
            Pago em: {{ formatDate(commission.payment_date) }}
          </p>
        </div>

        <!-- Amount + status -->
        <div class="flex shrink-0 flex-col items-end gap-1">
          <span class="text-sm font-semibold text-highlighted">
            {{ formatCurrency(commission.amount) }}
          </span>
          <UBadge
            :color="!isPending(commission) ? 'success' : 'warning'"
            :label="!isPending(commission) ? 'Pago' : 'Pendente'"
            variant="soft"
            size="xs"
          />
        </div>

        <!-- Pay button -->
        <UButton
          v-if="canUpdate && isPending(commission)"
          size="xs"
          color="success"
          variant="soft"
          icon="i-lucide-check"
          :loading="payingId === commission.id"
          :disabled="!!payingId || isPayingAll"
          square
          @click="requestPay(commission.id)"
        />
      </div>
    </div>

    <!-- Summary -->
    <template v-if="commissions.length" #footer>
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted">Total de comissões</span>
        <span class="font-semibold text-highlighted">
          {{ formatCurrency(commissions.reduce((s, c) => s + Number(c.amount ?? 0), 0)) }}
        </span>
      </div>
    </template>
  </UCard>

  <!-- Confirm single pay -->
  <AppConfirmModal
    :open="!!confirmingId"
    title="Confirmar pagamento"
    confirm-label="Pagar comissão"
    confirm-color="success"
    @update:open="confirmingId = null"
    @confirm="confirmPaySingle"
  >
    <template #description>
      <p class="text-sm text-muted">
        Deseja registrar o pagamento desta comissão?
        O valor será debitado da conta bancária ativa da organização.
      </p>
    </template>
  </AppConfirmModal>

  <!-- Confirm pay all -->
  <AppConfirmModal
    :open="showPayAllConfirm"
    title="Pagar todas as comissões pendentes"
    :confirm-label="`Pagar ${pendingCommissions.length} comissões`"
    confirm-color="success"
    @update:open="showPayAllConfirm = false"
    @confirm="confirmPayAll"
  >
    <template #description>
      <p class="text-sm text-muted">
        Deseja pagar
        <strong class="text-highlighted">{{ pendingCommissions.length }} comissões pendentes</strong>
        desta OS? O valor total será debitado da conta bancária ativa.
      </p>
    </template>
  </AppConfirmModal>
</template>
