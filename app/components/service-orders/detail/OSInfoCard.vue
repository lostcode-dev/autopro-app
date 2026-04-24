<script setup lang="ts">
import type { ServiceOrderRaw, ServiceOrderDetailFull } from '~/types/service-orders'
import { formatDate } from '~/utils/service-orders'

defineProps<{
  order: ServiceOrderRaw
  masterProduct?: ServiceOrderDetailFull['masterProduct']
}>()
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
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="rounded-xl bg-elevated/70 p-3">
          <p class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <UIcon name="i-lucide-calendar-clock" class="size-3.5 text-primary" />
            Data de entrada
          </p>
          <p class="mt-1 font-medium text-highlighted">
            {{ formatDate(order.entry_date) }}
          </p>
        </div>
        <div class="rounded-xl bg-elevated/70 p-3">
          <p class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <UIcon name="i-lucide-calendar-range" class="size-3.5 text-primary" />
            Data prevista
          </p>
          <p class="mt-1 font-medium text-highlighted">
            {{ formatDate(order.expected_date) }}
          </p>
        </div>
      </div>

      <div v-if="masterProduct" class="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p class="flex items-center gap-2 text-xs uppercase tracking-wide text-primary/80">
          <UIcon name="i-lucide-box" class="size-3.5" />
          Produto master
        </p>
        <p class="mt-2 font-semibold text-highlighted">
          {{ masterProduct.name }}
        </p>
        <p v-if="masterProduct.description" class="mt-1 text-default">
          {{ masterProduct.description }}
        </p>
        <p v-if="masterProduct.notes" class="mt-2 text-xs text-muted">
          {{ masterProduct.notes }}
        </p>
      </div>

      <div v-if="order.reported_defect">
        <p class="mb-1 flex items-center gap-2 text-muted">
          <UIcon name="i-lucide-wrench" class="size-4 text-primary" />
          Defeito relatado
        </p>
        <p class="rounded-lg bg-elevated p-3 text-default">
          {{ order.reported_defect }}
        </p>
      </div>

      <div v-if="order.diagnosis">
        <p class="mb-1 flex items-center gap-2 text-muted">
          <UIcon name="i-lucide-clipboard-list" class="size-4 text-primary" />
          Diagnóstico
        </p>
        <p class="rounded-lg bg-elevated p-3 text-default">
          {{ order.diagnosis }}
        </p>
      </div>

      <div v-if="order.notes">
        <p class="mb-1 flex items-center gap-2 text-muted">
          <UIcon name="i-lucide-notebook-pen" class="size-4 text-primary" />
          Observações
        </p>
        <p class="rounded-lg bg-elevated p-3 text-default">
          {{ order.notes }}
        </p>
      </div>
    </div>
  </UCard>
</template>
