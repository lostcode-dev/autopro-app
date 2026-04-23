<script setup lang="ts">
import type { ServiceOrderRaw } from '~/types/service-orders'
import { formatDate } from '~/utils/service-orders'

defineProps<{ order: ServiceOrderRaw }>()
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-clipboard-list" class="size-4 text-primary" />
        <h3 class="font-semibold text-highlighted">
          Informações da OS
        </h3>
      </div>
    </template>

    <div class="space-y-4 text-sm">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-muted">
            Data de entrada
          </p>
          <p class="font-medium text-highlighted">
            {{ formatDate(order.entry_date) }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Data prevista
          </p>
          <p class="font-medium text-highlighted">
            {{ formatDate(order.expected_date) }}
          </p>
        </div>
      </div>

      <div v-if="order.reported_defect">
        <p class="text-muted mb-1">
          Defeito relatado
        </p>
        <p class="rounded-lg bg-elevated p-3 text-default">
          {{ order.reported_defect }}
        </p>
      </div>

      <div v-if="order.diagnosis">
        <p class="text-muted mb-1">
          Diagnóstico
        </p>
        <p class="rounded-lg bg-elevated p-3 text-default">
          {{ order.diagnosis }}
        </p>
      </div>

      <div v-if="order.notes">
        <p class="text-muted mb-1">
          Observações
        </p>
        <p class="rounded-lg bg-elevated p-3 text-default">
          {{ order.notes }}
        </p>
      </div>
    </div>
  </UCard>
</template>
