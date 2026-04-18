<script setup lang="ts">
import {
  debtorStatusColor,
  debtorStatusIcon,
  formatDebtorStatusLabel,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
  orderStatusColor,
  paymentMethodColor,
  paymentMethodIcon
} from '~/utils/report-debtors'

export interface DebtorPendingItem {
  type: string
  id: string
  orderId?: string | null
  number: string
  amount: number
  dueDate: string | null
  paymentMethod: string | null
  orderStatus: string | null
  daysOverdue: number
  status: string
}

export interface DebtorDetailData {
  mode: 'clients' | 'orders'
  clientId: string
  clientName: string
  phone: string | null
  email: string | null
  status: string
  daysOverdue: number
  totalOwed: number
  earliestDue: string | null
  pendingItems: DebtorPendingItem[]
  orderNumber?: string | null
  orderId?: string | null
}

const props = defineProps<{
  open: boolean
  loading: boolean
  data: DebtorDetailData | null
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

function formatPhone(phone: string | null | undefined) {
  if (!phone) return 'â€”'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  return phone
}

function getInitials(name?: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.charAt(0) ?? '?').toUpperCase()
  return ((parts[0]?.charAt(0) ?? '') + (parts[parts.length - 1]?.charAt(0) ?? '')).toUpperCase()
}

const sortedItems = computed(() =>
  [...(props.data?.pendingItems ?? [])].sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
)
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <template #header>
      <div v-if="loading" class="flex items-center gap-3">
        <USkeleton class="h-10 w-10 rounded-full shrink-0" />
        <div class="space-y-1.5">
          <USkeleton class="h-5 w-40" />
          <USkeleton class="h-3.5 w-24" />
        </div>
      </div>
      <div v-else-if="data" class="flex items-center gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-white shadow-sm">
          {{ getInitials(data.clientName) }}
        </div>
        <div>
          <h2 class="text-base font-bold leading-tight text-highlighted">
            {{ data.mode === 'orders' && data.orderNumber ? `OS #${data.orderNumber}` : data.clientName }}
          </h2>
          <p class="mt-0.5 text-xs text-muted">
            {{ data.mode === 'orders' ? data.clientName : `${data.pendingItems.length} pendência${data.pendingItems.length !== 1 ? 's' : ''}` }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div v-if="loading" class="space-y-4 p-4">
        <USkeleton class="h-28 w-full rounded-xl" />
        <div class="grid grid-cols-3 gap-3">
          <USkeleton class="h-24 w-full rounded-xl" />
          <USkeleton class="h-24 w-full rounded-xl" />
          <USkeleton class="h-24 w-full rounded-xl" />
        </div>
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-28 w-full rounded-xl"
        />
      </div>

      <div v-else-if="data" class="space-y-4 p-4">
        <UCard :ui="{ body: 'p-4' }">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-lucide-contact" class="size-4 text-primary" />
            <p class="text-sm font-semibold text-highlighted">
              Informações
            </p>
          </div>
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 text-sm">
                <UIcon :name="debtorStatusIcon(data.status)" class="size-4 text-muted" />
                <span class="text-muted">Status</span>
              </div>
              <UBadge
                :color="debtorStatusColor(data.status)"
                variant="subtle"
                :label="formatDebtorStatusLabel(data.status)"
                size="xs"
              />
            </div>
            <div v-if="data.phone" class="flex items-center justify-between gap-3 text-sm">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-phone" class="size-4 text-info" />
                <span class="text-muted">Telefone</span>
              </div>
              <span class="font-medium text-highlighted">{{ formatPhone(data.phone) }}</span>
            </div>
            <div v-if="data.email" class="flex items-center justify-between gap-3 text-sm">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-mail" class="size-4 text-primary" />
                <span class="text-muted">E-mail</span>
              </div>
              <span class="font-medium text-highlighted">{{ data.email }}</span>
            </div>
          </div>
        </UCard>

        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-error/10">
              <UIcon name="i-lucide-wallet-cards" class="size-4 text-error" />
            </div>
            <p class="text-sm font-bold leading-tight text-highlighted">
              {{ formatCurrency(data.totalOwed) }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Total devido
            </p>
          </div>
          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10">
              <UIcon name="i-lucide-clock-3" class="size-4 text-warning" />
            </div>
            <p class="text-sm font-bold leading-tight text-highlighted">
              {{ data.daysOverdue }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Dias de atraso
            </p>
          </div>
          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-info/10">
              <UIcon name="i-lucide-calendar-days" class="size-4 text-info" />
            </div>
            <p class="text-sm font-bold leading-tight text-highlighted">
              {{ formatDate(data.earliestDue) }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Primeiro vencimento
            </p>
          </div>
        </div>

        <UCard v-if="sortedItems.length" :ui="{ body: 'p-0' }">
          <div class="flex items-center gap-2 border-b border-default px-4 py-3">
            <UIcon name="i-lucide-history" class="size-4 text-primary" />
            <p class="text-sm font-semibold text-highlighted">
              Pendências
            </p>
            <UBadge
              :label="String(sortedItems.length)"
              color="neutral"
              variant="subtle"
              size="xs"
              class="ml-auto"
            />
          </div>
          <div class="divide-y divide-default/70">
            <div
              v-for="item in sortedItems"
              :key="`${item.type}-${item.id}`"
              class="flex items-start gap-3 px-4 py-3 text-sm hover:bg-elevated/40 transition-colors duration-100"
            >
              <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-error/10">
                <UIcon :name="debtorStatusIcon(item.status)" class="size-3.5 text-error" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-semibold leading-tight text-highlighted">
                    {{ item.number }}
                  </p>
                  <UBadge
                    :color="debtorStatusColor(item.status)"
                    variant="subtle"
                    :label="formatDebtorStatusLabel(item.status)"
                    size="xs"
                  />
                  <UBadge
                    v-if="item.orderStatus"
                    :color="orderStatusColor(item.orderStatus)"
                    variant="soft"
                    size="xs"
                  >
                    {{ formatOrderStatusLabel(item.orderStatus) }}
                  </UBadge>
                </div>
                <div class="mt-1.5 flex flex-wrap items-center gap-3">
                  <span class="flex items-center gap-1 text-xs text-muted">
                    <UIcon name="i-lucide-calendar" class="size-3" />
                    {{ formatDate(item.dueDate) }}
                  </span>
                  <UBadge
                    :color="paymentMethodColor(String(item.paymentMethod || 'no_payment'))"
                    variant="outline"
                    size="xs"
                    class="gap-0.5"
                  >
                    <UIcon :name="paymentMethodIcon(String(item.paymentMethod || 'no_payment'))" class="size-3" />
                    {{ formatPaymentMethodLabel(String(item.paymentMethod || 'no_payment')) }}
                  </UBadge>
                </div>
              </div>

              <div class="shrink-0 text-right">
                <p class="text-sm font-bold text-error">
                  {{ formatCurrency(item.amount) }}
                </p>
                <p v-if="item.daysOverdue > 0" class="text-xs text-muted">
                  {{ item.daysOverdue }} dia(s)
                </p>
              </div>
            </div>
          </div>
        </UCard>

        <p v-else class="py-6 text-center text-sm text-muted">
          Nenhuma pendência encontrada.
        </p>
      </div>
    </template>
  </USlideover>
</template>
