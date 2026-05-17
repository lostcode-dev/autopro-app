<script setup lang="ts">
import type { ServiceOrder } from '~/types/service-orders'
import type { SyncStatusResponse } from '~/types/nfse'

const props = defineProps<{
  open: boolean
  order: ServiceOrder | null
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  'issued': [orderId: string]
}>()

const toast = useToast()

// ─── State ──────────────────────────────────────────────────────────────────

const isInitializing = ref(false)
const isSubmitting = ref(false)
const syncError = ref<string | null>(null)
const organizationId = ref<string | null>(null)
const providerTaxId = ref<string | null>(null)

interface NfseIssueForm {
  description: string
  serviceValue: string
  takerName: string
  takerBusinessId: string
}

const form = reactive<NfseIssueForm>({
  description: '',
  serviceValue: '',
  takerName: '',
  takerBusinessId: ''
})

// ─── Init on open ─────────────────────────────────────────────────────────

async function init() {
  if (!props.order) return
  syncError.value = null
  organizationId.value = null
  isInitializing.value = true

  try {
    const syncRes = await $fetch<SyncStatusResponse>('/api/fiscal/company/sync-status')
    if (!syncRes.is_synced) {
      syncError.value = 'Empresa não habilitada para emissão fiscal. Configure a integração fiscal nas configurações de empresa antes de emitir NFS-e.'
      return
    }
    organizationId.value = syncRes.organization_id
    providerTaxId.value = syncRes.sync?.tax_id ?? null

    form.takerName = props.order.client_name ?? ''
    form.serviceValue = String(props.order.total_amount ?? 0)
    form.description = `Ordem de Serviço #${props.order.number ?? ''}`
    form.takerBusinessId = ''

    // Try to enrich description from order items
    try {
      type DetailResponse = {
        data: {
          order: {
            reported_defect: string | null
            items: Array<{ name?: string | null, quantity: number }> | null
          }
        }
      }
      const detailRes = await $fetch<DetailResponse>(`/api/service-orders/${props.order.id}`)
      const items = detailRes.data.order.items
      if (items && items.length > 0) {
        form.description = items.map(item => `${item.name ?? 'Serviço'} (${item.quantity}x)`).join(', ')
      } else if (detailRes.data.order.reported_defect) {
        form.description = detailRes.data.order.reported_defect
      }
    } catch {
      // Non-critical: default description already set
    }
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string } }
    syncError.value = e?.data?.statusMessage ?? 'Erro ao verificar integração fiscal.'
  } finally {
    isInitializing.value = false
  }
}

watch(
  () => props.open,
  (opened) => {
    if (opened) init()
  }
)

// ─── Submit ──────────────────────────────────────────────────────────────────

async function submit() {
  if (!props.order || !organizationId.value || isSubmitting.value) return

  const serviceValue = parseFloat(String(form.serviceValue))
  if (!form.description.trim()) {
    toast.add({ title: 'Descrição obrigatória', color: 'error' })
    return
  }
  if (!serviceValue || serviceValue <= 0) {
    toast.add({ title: 'Valor do serviço deve ser maior que zero', color: 'error' })
    return
  }

  isSubmitting.value = true
  try {
    const reference = `so-${props.order.id}`
    await $fetch('/api/fiscal/nfse', {
      method: 'POST',
      body: {
        reference,
        service_order_id: props.order.id,
        service_order_number: String(props.order.number ?? ''),
        organization_id: organizationId.value,
        issued_at: new Date().toISOString(),
        provider_business_id: providerTaxId.value || undefined,
        service: {
          description: form.description.trim(),
          service_value: serviceValue
        },
        ...(form.takerName || form.takerBusinessId
          ? {
              taker: {
                company_name: form.takerName || undefined,
                business_id: form.takerBusinessId.replace(/\D/g, '') || undefined
              }
            }
          : {})
      }
    })

    // Mark OS as invoiced
    try {
      await $fetch('/api/service-orders', {
        method: 'POST',
        body: { orderId: props.order.id, orderData: { status: 'invoiced' } }
      })
    } catch {
      // Non-critical: NFS-e was issued; status update failure should not block
    }

    toast.add({ title: 'NF-e emitida com sucesso!', color: 'success' })
    emit('issued', props.order.id)
    emit('update:open', false)
  } catch (err: unknown) {
    type ApiErr = { data?: { data?: { error?: string, details?: { message?: string } }, statusMessage?: string } }
    const e = err as ApiErr
    const detail
      = e?.data?.data?.details?.message
        ?? e?.data?.data?.error
        ?? e?.data?.statusMessage
        ?? 'Tente novamente.'
    toast.add({ title: 'Erro ao emitir NF-e', description: detail, color: 'error' })
  } finally {
    isSubmitting.value = false
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number | string | null | undefined) {
  const n = parseFloat(String(value ?? 0))
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UIcon name="i-lucide-file-badge" class="size-5" />
        </div>
        <div>
          <p class="font-semibold text-highlighted">
            Emitir NF-e
          </p>
          <p v-if="order" class="text-xs text-muted">
            OS #{{ order.number ?? order?.id.slice(0, 8) }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <!-- Loading -->
      <div v-if="isInitializing" class="space-y-3 p-4">
        <USkeleton class="h-6 w-1/2" />
        <USkeleton class="h-20 w-full rounded-xl" />
        <USkeleton class="h-10 w-full rounded-xl" />
        <USkeleton class="h-10 w-full rounded-xl" />
      </div>

      <!-- Sync error -->
      <div v-else-if="syncError" class="p-4">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Integração não configurada"
          :description="syncError"
        />
      </div>

      <!-- Form -->
      <div v-else class="space-y-4 p-4">
        <!-- Order summary -->
        <div class="rounded-xl border border-default bg-elevated/40 p-3 text-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted">Ordem de Serviço</span>
            <span class="font-medium text-highlighted">#{{ order?.number }}</span>
          </div>
          <div class="mt-1 flex items-center justify-between gap-2">
            <span class="text-muted">Valor total</span>
            <span class="font-semibold text-highlighted">{{ formatCurrency(order?.total_amount) }}</span>
          </div>
        </div>

        <!-- Description -->
        <UFormField label="Descrição do serviço" required>
          <UTextarea
            v-model="form.description"
            placeholder="Descreva o serviço prestado..."
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <!-- Service value -->
        <UFormField label="Valor do serviço (R$)" required>
          <UInput
            :model-value="form.serviceValue"
            placeholder="0.00"
            class="w-full"
            @update:model-value="form.serviceValue = String($event ?? '')"
          />
        </UFormField>

        <!-- Taker name -->
        <UFormField label="Nome do tomador">
          <UInput
            v-model="form.takerName"
            placeholder="Razão social ou nome do cliente"
            class="w-full"
          />
        </UFormField>

        <!-- Taker CNPJ/CPF -->
        <UFormField label="CNPJ/CPF do tomador">
          <UInput
            v-model="form.takerBusinessId"
            placeholder="00.000.000/0000-00"
            class="w-full"
          />
        </UFormField>

        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="Revise antes de confirmar"
          description="Os dados serão enviados à prefeitura. Certifique-se de que a empresa está habilitada para emissão de NFS-e no município."
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          :disabled="isSubmitting"
          @click="emit('update:open', false)"
        />
        <UButton
          v-if="!syncError && !isInitializing"
          label="Emitir NF-e"
          icon="i-lucide-file-badge"
          color="primary"
          :loading="isSubmitting"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
