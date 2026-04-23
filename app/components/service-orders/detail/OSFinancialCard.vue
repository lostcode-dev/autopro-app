<script setup lang="ts">
import type { ServiceOrderRaw } from '~/types/service-orders'
import { formatCurrency, PAYMENT_STATUS_LABEL } from '~/utils/service-orders'

defineProps<{ order: ServiceOrderRaw }>()
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-dollar-sign" class="size-4 text-primary" />
        <h3 class="font-semibold text-highlighted">
          Resumo Financeiro
        </h3>
      </div>
    </template>

    <div class="space-y-4">
      <!-- Main total -->
      <div class="rounded-xl bg-primary/8 p-4 text-center">
        <p class="text-sm text-muted">
          Valor cobrado pelo cliente
        </p>
        <p class="mt-1 text-3xl font-bold text-highlighted">
          {{ formatCurrency(order.total_amount) }}
        </p>
        <p v-if="order.payment_status" class="mt-1 text-xs text-muted">
          {{ PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status }}
          <span v-if="order.payment_method"> · {{ order.payment_method }}</span>
        </p>
      </div>

      <!-- Grid of financial metrics -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div v-if="order.discount" class="rounded-lg bg-elevated p-3 text-center">
          <p class="text-xs text-muted">
            Desconto
          </p>
          <p class="font-semibold text-error">
            {{ formatCurrency(order.discount) }}
          </p>
        </div>

        <div v-if="order.commission_amount" class="rounded-lg bg-elevated p-3 text-center">
          <p class="text-xs text-muted">
            Comissão
          </p>
          <p class="font-semibold text-warning">
            {{ formatCurrency(order.commission_amount) }}
          </p>
        </div>

        <div v-if="order.is_installment && order.installment_count" class="rounded-lg bg-elevated p-3 text-center">
          <p class="text-xs text-muted">
            Parcelas
          </p>
          <p class="font-semibold text-info">
            {{ order.installment_count }}x
          </p>
        </div>
      </div>
    </div>
  </UCard>
</template>
