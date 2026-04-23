<script setup lang="ts">
import type { ServiceOrderItem } from '~/types/service-orders'
import { formatCurrency } from '~/utils/service-orders'

defineProps<{ items: ServiceOrderItem[] | null }>()
</script>

<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-package" class="size-4 text-primary" />
        <h3 class="font-semibold text-highlighted">
          Itens da OS
        </h3>
      </div>
    </template>

    <div v-if="!items?.length" class="py-4 text-center text-sm text-muted">
      Nenhum item registrado.
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default">
            <th class="py-2 pr-4 text-left font-semibold text-highlighted">
              Descrição
            </th>
            <th class="py-2 pr-4 text-center font-semibold text-highlighted">
              Qtd
            </th>
            <th class="py-2 pr-4 text-right font-semibold text-highlighted">
              Unit.
            </th>
            <th class="py-2 text-right font-semibold text-highlighted">
              Total
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="(item, i) in items" :key="i">
            <td class="py-2.5 pr-4 text-default">
              {{ item.name || item.description || '—' }}
            </td>
            <td class="py-2.5 pr-4 text-center text-muted">
              {{ item.quantity }}
            </td>
            <td class="py-2.5 pr-4 text-right text-muted">
              {{ formatCurrency(item.unit_price) }}
            </td>
            <td class="py-2.5 text-right font-medium text-highlighted">
              {{ formatCurrency(item.total_price ?? item.unit_price * item.quantity) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
