<script setup lang="ts">
import {
  formatSalesCostSourceLabel,
  formatSalesOrderStatusLabel,
  formatSalesPaymentMethodLabel,
  formatSalesPaymentStatusLabel,
  salesCostSourceColor,
  salesOrderStatusColor,
  salesPaymentMethodColor,
  salesPaymentStatusColor
} from '~/utils/report-sales-items'

export interface SalesItemsDetailRow {
  id: string
  orderId: string
  orderNumber: string
  itemDescription: string
  categoryName: string
  costSource: string
  quantity: number
  totalCost: number
  commissionCost: number
  totalValue: number
  profit: number
  responsible: string
}

export interface SalesItemsDetailData {
  mode: 'item' | 'os'
  id: string
  orderId: string
  orderNumber: string
  client: string
  responsible: string
  status: string
  paymentStatus: string
  paymentMethod: string
  date: string
  categoryName: string
  costSource: string
  itemDescription: string
  quantity: number
  totalCost: number
  commissionCost: number
  totalCostWithCommission: number
  totalValue: number
  profit: number
  itemCount: number
  items: SalesItemsDetailRow[]
}

const props = defineProps<{
  open: boolean
  loading: boolean
  data: SalesItemsDetailData | null
}>()

defineEmits<{
  'update:open': [value: boolean]
}>()

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(v: string | null) {
  if (!v) return '—'
  const [year, month, day] = v.split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}
</script>

<template>
  <USlideover
    :open="props.open"
    side="right"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <template #header>
      <div v-if="props.loading" class="space-y-2">
        <USkeleton class="h-5 w-40" />
        <USkeleton class="h-4 w-28" />
      </div>
      <div v-else-if="props.data">
        <h2 class="text-base font-bold text-highlighted">
          {{ props.data.mode === 'os' ? `OS #${props.data.orderNumber}` : props.data.itemDescription }}
        </h2>
        <p class="mt-0.5 text-xs text-muted">
          {{ props.data.client }}
        </p>
      </div>
    </template>

    <template #body>
      <div v-if="props.loading" class="space-y-4 p-4">
        <div class="grid grid-cols-2 gap-3">
          <USkeleton
            v-for="index in 4"
            :key="index"
            class="h-24 rounded-xl"
          />
        </div>
        <USkeleton class="h-36 rounded-xl" />
        <USkeleton class="h-64 rounded-xl" />
      </div>

      <div v-else-if="props.data" class="space-y-4 p-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-success/10">
              <UIcon name="i-lucide-badge-dollar-sign" class="size-4 text-success" />
            </div>
            <p class="text-sm font-bold text-highlighted">
              {{ formatCurrency(props.data.totalValue) }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Receita
            </p>
          </div>

          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-error/10">
              <UIcon name="i-lucide-wallet-cards" class="size-4 text-error" />
            </div>
            <p class="text-sm font-bold text-highlighted">
              {{ formatCurrency(props.data.totalCostWithCommission) }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Custo total
            </p>
          </div>

          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <UIcon name="i-lucide-chart-no-axes-combined" class="size-4 text-primary" />
            </div>
            <p class="text-sm font-bold text-highlighted">
              {{ formatCurrency(props.data.profit) }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Lucro
            </p>
          </div>

          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-info/10">
              <UIcon name="i-lucide-package" class="size-4 text-info" />
            </div>
            <p class="text-sm font-bold text-highlighted">
              {{ props.data.mode === 'os' ? props.data.itemCount : props.data.quantity }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              {{ props.data.mode === 'os' ? 'Itens na OS' : 'Quantidade' }}
            </p>
          </div>
        </div>

        <UCard :ui="{ body: 'p-4' }">
          <div class="mb-3 flex items-center gap-2">
            <UIcon name="i-lucide-file-text" class="size-4 text-primary" />
            <p class="text-sm font-semibold text-highlighted">
              Resumo
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p class="text-xs text-muted">
                Data
              </p>
              <p class="font-medium text-highlighted">
                {{ formatDate(props.data.date) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">
                Responsável
              </p>
              <p class="font-medium text-highlighted">
                {{ props.data.responsible || '—' }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">
                Categoria
              </p>
              <p class="font-medium text-highlighted">
                {{ props.data.categoryName || '—' }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">
                Origem do custo
              </p>
              <UBadge
                :color="salesCostSourceColor(props.data.costSource) as any"
                variant="soft"
                size="xs"
              >
                {{ formatSalesCostSourceLabel(props.data.costSource) }}
              </UBadge>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UBadge
              :color="salesOrderStatusColor(props.data.status) as any"
              variant="subtle"
              size="xs"
            >
              {{ formatSalesOrderStatusLabel(props.data.status) }}
            </UBadge>
            <UBadge
              :color="salesPaymentStatusColor(props.data.paymentStatus) as any"
              variant="subtle"
              size="xs"
            >
              {{ formatSalesPaymentStatusLabel(props.data.paymentStatus) }}
            </UBadge>
            <UBadge
              :color="salesPaymentMethodColor(props.data.paymentMethod) as any"
              variant="soft"
              size="xs"
            >
              {{ formatSalesPaymentMethodLabel(props.data.paymentMethod) }}
            </UBadge>
          </div>
        </UCard>

        <UCard v-if="props.data.mode === 'os'" :ui="{ body: 'p-0' }">
          <div class="flex items-center gap-2 border-b border-default px-4 py-3">
            <UIcon name="i-lucide-list" class="size-4 text-primary" />
            <p class="text-sm font-semibold text-highlighted">
              Itens da OS
            </p>
          </div>

          <div class="divide-y divide-default/70">
            <div
              v-for="item in props.data.items"
              :key="item.id"
              class="px-4 py-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-medium text-highlighted">
                    {{ item.itemDescription }}
                  </p>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{{ item.categoryName || 'Sem categoria' }}</span>
                    <span>{{ item.quantity }} un</span>
                    <UBadge
                      :color="salesCostSourceColor(item.costSource) as any"
                      variant="soft"
                      size="xs"
                    >
                      {{ formatSalesCostSourceLabel(item.costSource) }}
                    </UBadge>
                  </div>
                </div>

                <div class="text-right">
                  <p class="font-medium text-highlighted">
                    {{ formatCurrency(item.totalValue) }}
                  </p>
                  <p class="text-xs text-muted">
                    lucro {{ formatCurrency(item.profit) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </USlideover>
</template>
