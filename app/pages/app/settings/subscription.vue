<script setup lang="ts">
definePageMeta({
  layout: 'app'
})

const toast = useToast()

type Subscription = {
  status: string
  price_id: string | null
  quantity: number | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  canceled_at: string | null
}

type BillingStatusResponse = {
  hasAccess: boolean
  subscription: Subscription | null
}

const { data, status, refresh } = await useAsyncData(
  'billing-subscription',
  () => $fetch<BillingStatusResponse>('/api/billing/status')
)

async function onRefresh(_event: MouseEvent) {
  await refresh()
}

const isCancelling = ref(false)

async function cancelAtPeriodEnd(_event: MouseEvent) {
  if (isCancelling.value)
    return

  isCancelling.value = true
  try {
    await $fetch('/api/billing/cancel', { method: 'POST' })
    toast.add({ title: 'Assinatura', description: 'Cancelamento agendado para o fim do período.', color: 'success' })

    for (let attempt = 0; attempt < 3; attempt++) {
      await refresh()
      if (data.value?.subscription?.cancel_at_period_end)
        break

      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  catch (error: any) {
    const message = error?.data?.statusMessage || error?.statusMessage || 'Não foi possível cancelar a assinatura'
    toast.add({ title: 'Erro', description: message, color: 'error' })
  }
  finally {
    isCancelling.value = false
  }
}

function formatDate(date: string | null) {
  if (!date)
    return '-'
  try {
    return new Date(date).toLocaleDateString('pt-BR')
  }
  catch {
    return date
  }
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
    title="Assinatura"
    description="Status e detalhes da sua assinatura."
    variant="subtle"
  >
    <template #footer>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <UButton
            label="Gerenciar assinatura"
            color="neutral"
            variant="outline"
            @click="openPortal"
          />

          <UButton
            v-if="data?.subscription && (data.subscription.status === 'active' || data.subscription.status === 'trialing') && !data.subscription.cancel_at_period_end"
            label="Cancelar no fim do período"
            color="neutral"
            variant="ghost"
            :loading="isCancelling"
            @click="cancelAtPeriodEnd"
          />
          <UButton
            label="Ver faturas"
            color="neutral"
            variant="ghost"
            to="/app/settings/billing"
          />
        </div>

        <UButton
          label="Atualizar"
          color="neutral"
          @click="onRefresh"
        />
      </div>
    </template>

    <div v-if="status === 'pending'" class="space-y-3">
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-10 w-full" />
    </div>

    <div v-else class="space-y-4">
      <div v-if="!data?.subscription" class="space-y-3">
        <p class="text-sm text-muted">Você ainda não possui uma assinatura registrada.</p>
        <UButton label="Ver planos" color="neutral" to="/pricing" />
      </div>

      <div v-else class="grid grid-cols-1 gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-muted">Status</span>
          <UBadge
            :color="data.subscription.status === 'active' || data.subscription.status === 'trialing' ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ data.subscription.status }}
          </UBadge>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm text-muted">Plano (price_id)</span>
          <span class="text-sm font-medium">{{ data.subscription.price_id || '-' }}</span>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm text-muted">Quantidade</span>
          <span class="text-sm font-medium">{{ data.subscription.quantity ?? '-' }}</span>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm text-muted">Início do período</span>
          <span class="text-sm font-medium">{{ formatDate(data.subscription.current_period_start) }}</span>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm text-muted">Fim do período</span>
          <span class="text-sm font-medium">{{ formatDate(data.subscription.current_period_end) }}</span>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm text-muted">Cancelar no fim do período</span>
          <span class="text-sm font-medium">{{ data.subscription.cancel_at_period_end ? 'Sim' : 'Não' }}</span>
        </div>

        <div class="flex items-center justify-between" v-if="data.subscription.canceled_at">
          <span class="text-sm text-muted">Cancelada em</span>
          <span class="text-sm font-medium">{{ formatDate(data.subscription.canceled_at) }}</span>
        </div>
      </div>
    </div>
  </UPageCard>
</template>
