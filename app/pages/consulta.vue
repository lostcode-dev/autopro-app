<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Consulta de Funcionário' })

const cpfInput = ref('')
const isLoading = ref(false)
const errorMsg = ref('')
const result = ref<any | null>(null)

function formatCPF(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

function onCpfInput(e: Event) {
  cpfInput.value = formatCPF((e.target as HTMLInputElement).value)
}

async function consultar() {
  const digits = cpfInput.value.replace(/\D/g, '')
  if (digits.length !== 11) {
    errorMsg.value = 'Por favor, digite um CPF válido com 11 dígitos.'
    return
  }

  isLoading.value = true
  errorMsg.value = ''
  result.value = null

  try {
    const res = await $fetch<{ data: any }>('/api/consulta', { query: { cpf: digits } })
    result.value = res.data
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }, statusMessage?: string }
    errorMsg.value = err?.data?.statusMessage || 'Erro ao consultar. Tente novamente.'
  } finally {
    isLoading.value = false
  }
}

function formatCurrency(v: number | string) {
  return parseFloat(String(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(v: string) {
  if (!v) return '—'
  const [y, m, d] = v.split('-')
  return `${d}/${m}/${y}`
}

const typeLabel: Record<string, string> = {
  salary: 'Salário',
  commission: 'Comissão',
  advance: 'Adiantamento',
  bonus: 'Bônus',
  discount: 'Desconto',
  // legacy PT keys
  salario: 'Salário',
  comissao: 'Comissão',
  adiantamento: 'Adiantamento'
}

const statusColor: Record<string, string> = { paid: 'success', pending: 'warning', cancelled: 'error' }
const statusLabel: Record<string, string> = { paid: 'Pago', pending: 'Pendente', cancelled: 'Cancelado' }
</script>

<template>
  <div class="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center px-4 py-12 gap-6">
    <!-- Header -->
    <div class="text-center">
      <h1 class="text-2xl font-bold">
        Consulta de Funcionário
      </h1>
      <p class="text-muted mt-1">
        Digite seu CPF para consultar seus registros financeiros.
      </p>
    </div>

    <!-- Search card -->
    <UPageCard class="w-full max-w-md" variant="subtle">
      <div class="space-y-4">
        <UFormField label="CPF">
          <UInput
            :model-value="cpfInput"
            placeholder="000.000.000-00"
            class="w-full text-center text-lg tracking-widest"
            :disabled="isLoading"
            @input="onCpfInput"
            @keydown.enter="consultar"
          />
        </UFormField>

        <UButton
          label="Consultar"
          icon="i-lucide-search"
          color="neutral"
          class="w-full"
          :loading="isLoading"
          :disabled="isLoading"
          @click="consultar"
        />

        <div v-if="errorMsg" class="flex items-center gap-2 text-sm text-red-500">
          <UIcon name="i-lucide-alert-circle" />
          <span>{{ errorMsg }}</span>
        </div>
      </div>
    </UPageCard>

    <!-- Result -->
    <template v-if="result">
      <!-- Employee info -->
      <UPageCard class="w-full" variant="subtle">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UIcon name="i-lucide-user" class="text-xl text-primary" />
          </div>
          <div>
            <p class="font-semibold text-lg">
              {{ result.employee.name }}
            </p>
            <p class="text-muted text-sm">
              CPF: {{ result.employee.tax_id_masked }}
            </p>
          </div>
        </div>

        <!-- Totals -->
        <div class="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-default text-center text-sm">
          <div>
            <p class="text-muted text-xs">
              Registros
            </p>
            <p class="font-bold">
              {{ result.summary.recordCount }}
            </p>
          </div>
          <div>
            <p class="text-muted text-xs">
              Total pago
            </p>
            <p class="font-bold text-green-600">
              {{ formatCurrency(result.summary.totalPaid) }}
            </p>
          </div>
          <div>
            <p class="text-muted text-xs">
              Total pendente
            </p>
            <p class="font-bold text-yellow-500">
              {{ formatCurrency(result.summary.totalPending) }}
            </p>
          </div>
        </div>
      </UPageCard>

      <!-- Records list -->
      <UPageCard
        v-if="result.records.length"
        class="w-full"
        title="Registros financeiros"
        variant="subtle"
      >
        <ul class="divide-y divide-default">
          <li
            v-for="record in result.records"
            :key="record.id"
            class="py-3 flex items-center justify-between gap-3"
          >
            <div>
              <p class="font-medium text-sm">
                {{ typeLabel[record.type] ?? record.type }}
              </p>
              <p class="text-muted text-xs">
                Ref: {{ formatDate(record.reference_date) }}{{ record.due_date ? ` · Venc: ${formatDate(record.due_date)}` : '' }}
              </p>
              <p v-if="record.notes" class="text-muted text-xs">
                {{ record.notes }}
              </p>
            </div>
            <div class="flex flex-col items-end gap-1">
              <span class="font-semibold">{{ formatCurrency(record.amount) }}</span>
              <UBadge
                :color="statusColor[record.status] ?? 'neutral'"
                variant="subtle"
                :label="statusLabel[record.status] ?? record.status"
                size="xs"
              />
            </div>
          </li>
        </ul>
      </UPageCard>

      <div v-else class="text-center text-muted text-sm">
        Nenhum registro financeiro encontrado.
      </div>
    </template>
  </div>
</template>
