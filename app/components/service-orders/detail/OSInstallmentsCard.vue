<script setup lang="ts">
import type { ServiceOrderInstallment } from '~/types/service-orders'
import { formatCurrency, formatDate } from '~/utils/service-orders'

defineProps<{ installments: ServiceOrderInstallment[] }>()

const installmentStatusColor: Record<string, string> = {
  paid: 'success',
  pending: 'warning',
  overdue: 'error'
}

const installmentStatusLabel: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Atrasado'
}
</script>

<template>
  <UCard v-if="installments.length" variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-credit-card" class="size-4 text-primary" />
        <h3 class="font-semibold text-highlighted">
          Parcelas ({{ installments.length }})
        </h3>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="installment in installments"
        :key="installment.id"
        class="rounded-lg border p-3"
        :class="installment.status === 'paid'
          ? 'border-success/30 bg-success/5'
          : installment.status === 'overdue'
            ? 'border-error/30 bg-error/5'
            : 'border-default bg-elevated'"
      >
        <div class="flex items-center justify-between gap-2">
          <UBadge
            :color="installmentStatusColor[installment.status] ?? 'neutral'"
            :label="installmentStatusLabel[installment.status] ?? installment.status"
            variant="soft"
            size="xs"
          />
          <span class="font-semibold text-highlighted">
            {{ formatCurrency(installment.amount) }}
          </span>
        </div>
        <div class="mt-2 space-y-1 text-xs text-muted">
          <p>Venc.: {{ formatDate(installment.due_date) }}</p>
          <p v-if="installment.payment_date">
            Pago: {{ formatDate(installment.payment_date) }}
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
