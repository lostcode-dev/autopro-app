<script setup lang="ts">
export interface SupplierDetailItem {
  name: string
  total: number
}

export interface SupplierDetailData {
  id: string
  name: string
  tradeName: string | null
  phone: string | null
  email: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  taxId: string | null
  totalPurchased: number
  purchaseCount: number
  itemCount: number
  averagePurchase: number
  lastPurchase: string | null
  topItems: Array<[string, number]>
  daily: SupplierDetailItem[]
}

const props = defineProps<{
  open: boolean
  loading: boolean
  data: SupplierDetailData | null
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

const chartCategories = computed(() =>
  props.data?.daily.map((item) => {
    const [y, m, d] = item.name.split('-')
    return (y && m && d) ? `${d}/${m}/${y}` : item.name
  }) ?? []
)
const chartSeries = computed(() => [
  { name: 'Total comprado', data: props.data?.daily.map(item => item.total) ?? [] }
])
</script>

<template>
  <USlideover
    :open="props.open"
    side="right"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="$emit('update:open', $event)"
  >
    <template #header>
      <div class="flex items-center justify-between gap-3 w-full">
        <div v-if="props.loading" class="space-y-2">
          <USkeleton class="h-5 w-48" />
          <USkeleton class="h-4 w-32" />
        </div>
        <div v-else-if="props.data">
          <h2 class="text-base font-bold text-highlighted">
            {{ props.data.name }}
          </h2>
          <p class="mt-0.5 text-xs text-muted">
            {{ props.data.tradeName || props.data.contactName || 'Detalhes do fornecedor' }}
          </p>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          @click="$emit('update:open', false)"
        />
      </div>
    </template>

    <template #body>
      <div v-if="props.loading" class="space-y-4 p-4">
        <div class="grid grid-cols-2 gap-3">
          <USkeleton class="h-24 rounded-xl" />
          <USkeleton class="h-24 rounded-xl" />
          <USkeleton class="h-24 rounded-xl" />
          <USkeleton class="h-24 rounded-xl" />
        </div>
        <USkeleton class="h-64 rounded-xl" />
        <USkeleton class="h-40 rounded-xl" />
      </div>

      <div v-else-if="props.data" class="space-y-4 p-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <UIcon name="i-lucide-badge-dollar-sign" class="size-4 text-primary" />
            </div>
            <p class="text-sm font-bold text-highlighted">
              {{ formatCurrency(props.data.totalPurchased) }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Total comprado
            </p>
          </div>

          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-info/10">
              <UIcon name="i-lucide-shopping-cart" class="size-4 text-info" />
            </div>
            <p class="text-sm font-bold text-highlighted">
              {{ props.data.purchaseCount }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Compras
            </p>
          </div>

          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-success/10">
              <UIcon name="i-lucide-package" class="size-4 text-success" />
            </div>
            <p class="text-sm font-bold text-highlighted">
              {{ props.data.itemCount }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Itens comprados
            </p>
          </div>

          <div class="rounded-xl border border-default bg-gradient-to-b from-elevated/50 to-default p-3 text-center">
            <div class="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10">
              <UIcon name="i-lucide-receipt-text" class="size-4 text-warning" />
            </div>
            <p class="text-sm font-bold text-highlighted">
              {{ formatCurrency(props.data.averagePurchase) }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Ticket médio
            </p>
          </div>
        </div>

        <UCard :ui="{ body: 'p-4' }">
          <div class="mb-3 flex items-center gap-2">
            <UIcon name="i-lucide-building-2" class="size-4 text-primary" />
            <p class="text-sm font-semibold text-highlighted">
              Informações do fornecedor
            </p>
          </div>

          <div class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p class="text-xs text-muted">
                Última compra
              </p>
              <p class="font-medium text-highlighted">
                {{ formatDate(props.data.lastPurchase) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">
                Documento
              </p>
              <p class="font-medium text-highlighted">
                {{ props.data.taxId || '—' }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">
                Telefone
              </p>
              <p class="font-medium text-highlighted">
                {{ props.data.phone || props.data.contactPhone || '—' }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">
                E-mail
              </p>
              <p class="font-medium break-all text-highlighted">
                {{ props.data.email || props.data.contactEmail || '—' }}
              </p>
            </div>
            <div class="sm:col-span-2">
              <p class="text-xs text-muted">
                Contato
              </p>
              <p class="font-medium text-highlighted">
                {{ props.data.contactName || props.data.tradeName || '—' }}
              </p>
            </div>
          </div>
        </UCard>

        <UCard v-if="props.data.daily.length > 0" :ui="{ body: 'p-4' }">
          <div class="mb-4 flex items-center gap-2">
            <UIcon name="i-lucide-trending-up" class="size-4 text-primary" />
            <p class="text-sm font-semibold text-highlighted">
              Evolução de compras
            </p>
          </div>

          <ChartsLine
            :categories="chartCategories"
            :series="chartSeries"
            :height="260"
            :colors="['#0f766e']"
            :format-value="(value: number) => formatCurrency(value)"
            show-markers
          />
        </UCard>

        <UCard :ui="{ body: 'p-4' }">
          <div class="mb-3 flex items-center gap-2">
            <UIcon name="i-lucide-package-search" class="size-4 text-primary" />
            <p class="text-sm font-semibold text-highlighted">
              Top 5 itens comprados
            </p>
          </div>

          <div v-if="props.data.topItems.length" class="space-y-2">
            <div
              v-for="([description, quantity], index) in props.data.topItems"
              :key="`${description}-${index}`"
              class="flex items-center justify-between gap-3 rounded-lg border border-default/80 bg-elevated/40 px-3 py-2"
            >
              <p class="truncate text-sm text-highlighted">
                {{ description }}
              </p>
              <UBadge color="neutral" variant="soft" size="xs">
                {{ quantity }} un
              </UBadge>
            </div>
          </div>
          <div v-else class="py-6 text-center text-sm text-muted">
            Nenhum item encontrado para este fornecedor nos filtros atuais.
          </div>
        </UCard>
      </div>
    </template>
  </USlideover>
</template>
