<script setup lang="ts">
definePageMeta({
  layout: 'app'
})

const toast = useToast()

const page = ref(1)
const pageSize = 20

type InvoiceItem = {
  stripe_invoice_id: string
  status: string | null
  currency: string | null
  total: number | null
  amount_paid: number | null
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  invoice_number: string | null
  created: string | null
  period_start: string | null
  period_end: string | null
}

type InvoicesResponse = {
  items: InvoiceItem[]
  page: number
  pageSize: number
  total: number
}

const { data, status, refresh } = await useAsyncData(
  () => `billing-invoices-${page.value}`,
  () => $fetch<InvoicesResponse>('/api/billing/invoices', { query: { page: page.value, pageSize } }),
  { watch: [page] }
)

const columns = [
  { key: 'invoice_number', label: 'Invoice' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total' },
  { key: 'created', label: 'Criada em' },
  { key: 'actions', label: '' }
]

function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null)
    return '-'

  const value = amount / 100
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: (currency || 'brl').toUpperCase()
    }).format(value)
  }
  catch {
    return `${value}`
  }
}

async function openInvoice(url: string | null) {
  if (!url) {
    toast.add({ title: 'Erro', description: 'Link da invoice indisponível', color: 'error' })
    return
  }

  await navigateTo(url, { external: true })
}

async function openPortal() {
  try {
    const { url } = await $fetch<{ url: string }>('/api/billing/portal', { method: 'POST' })
    await navigateTo(url, { external: true })
  }
  catch (error: any) {
    const message = error?.data?.statusMessage || error?.statusMessage || 'Não foi possível abrir o portal'
    toast.add({ title: 'Erro', description: message, color: 'error' })
  }
}
</script>

<template>
  <UPageCard
    title="Faturas"
    description="Histórico de invoices da sua assinatura."
    variant="subtle"
  >
    <template #footer>
      <div class="flex items-center justify-between w-full">
        <UButton
          label="Gerenciar assinatura"
          color="neutral"
          variant="outline"
          @click="openPortal"
        />
        <UButton
          label="Atualizar"
          color="neutral"
          @click="refresh"
        />
      </div>
    </template>

    <div v-if="status === 'pending'" class="space-y-3">
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-10 w-full" />
    </div>

    <UTable
      v-else
      :columns="columns"
      :rows="data?.items || []"
    >
      <template #invoice_number-data="{ row }">
        <span class="font-medium">{{ row.invoice_number || row.stripe_invoice_id }}</span>
      </template>

      <template #total-data="{ row }">
        {{ formatMoney(row.total, row.currency) }}
      </template>

      <template #created-data="{ row }">
        <span v-if="row.created">{{ new Date(row.created).toLocaleDateString('pt-BR') }}</span>
        <span v-else>-</span>
      </template>

      <template #actions-data="{ row }">
        <div class="flex justify-end">
          <UButton
            label="Abrir"
            color="neutral"
            variant="ghost"
            @click="openInvoice(row.invoice_pdf || row.hosted_invoice_url)"
          />
        </div>
      </template>
    </UTable>

    <div class="flex justify-center pt-4" v-if="(data?.total || 0) > pageSize">
      <UPagination
        v-model="page"
        :page-count="pageSize"
        :total="data?.total || 0"
      />
    </div>
  </UPageCard>
</template>
