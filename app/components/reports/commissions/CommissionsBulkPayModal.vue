<script setup lang="ts">
export interface BankAccount {
  id: string
  account_name?: string
  bank_name?: string
}

export interface BulkPayItem {
  id: string
  employeeName: string
  osLabel: string | null
  dateLabel: string
  amount: number
}

const props = defineProps<{
  open: boolean
  items: BulkPayItem[]
  total: number
  accounts: BankAccount[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [accountId: string]
}>()

const selectedAccountId = ref('')

watch(() => props.accounts, (accounts) => {
  if (accounts.length > 0 && !selectedAccountId.value) {
    selectedAccountId.value = accounts[0]!.id
  }
}, { immediate: true })

function formatCurrency(v: number) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const accountOptions = computed(() =>
  props.accounts.map(a => ({
    value: a.id,
    label: [a.account_name, a.bank_name].filter(Boolean).join(' — ') || 'Conta'
  }))
)
</script>

<template>
  <UModal
    :open="open"
    title="Pagar comissões selecionadas"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Account selector -->
        <div>
          <p class="text-sm font-medium text-highlighted mb-1.5">
            Conta bancária
          </p>
          <USelect
            v-model="selectedAccountId"
            :items="accountOptions"
            value-key="value"
            label-key="label"
            placeholder="Selecione a conta"
            class="w-full"
          />
        </div>

        <!-- Items list -->
        <div>
          <p class="text-sm font-medium text-highlighted mb-1.5">
            {{ items.length }} comissão{{ items.length !== 1 ? 'ões' : '' }} selecionada{{ items.length !== 1 ? 's' : '' }}
          </p>
          <div class="max-h-52 overflow-y-auto divide-y divide-default rounded-xl border border-default">
            <div
              v-for="item in items"
              :key="item.id"
              class="flex items-center gap-3 px-3 py-2.5 text-sm"
            >
              <div class="flex-1 min-w-0">
                <p class="font-medium text-highlighted truncate">
                  {{ item.employeeName }}
                </p>
                <p class="text-xs text-muted">
                  <span v-if="item.osLabel">{{ item.osLabel }} · </span>{{ item.dateLabel }}
                </p>
              </div>
              <span class="shrink-0 text-sm font-bold text-success">{{ formatCurrency(item.amount) }}</span>
            </div>
          </div>
        </div>

        <!-- Total -->
        <div class="flex items-center justify-between rounded-xl bg-success/10 px-4 py-3">
          <span class="text-sm font-semibold text-highlighted">Total a pagar</span>
          <span class="text-base font-bold text-success">{{ formatCurrency(total) }}</span>
        </div>

        <div class="flex justify-end gap-3">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="ghost"
            :disabled="loading"
            @click="$emit('update:open', false)"
          />
          <UButton
            label="Confirmar pagamento"
            color="success"
            icon="i-lucide-credit-card"
            :loading="loading"
            :disabled="!selectedAccountId || items.length === 0"
            @click="$emit('confirm', selectedAccountId)"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
