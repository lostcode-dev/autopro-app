<script setup lang="ts">
import BillingPricingPlans from '~/components/billing/BillingPricingPlans.vue'

definePageMeta({
  layout: 'app'
})

const { data: page, status } = await useAsyncData(
  'pricing-embedded',
  () => queryCollection('pricing').first()
)
</script>

<template>
  <UDashboardPanel id="subscribe">
    <template #header>
      <UDashboardNavbar title="Assinatura">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        title="Assinatura necessária"
        description="Você precisa de uma assinatura ativa para acessar o app."
        color="neutral"
        variant="subtle"
        class="mb-6"
      />

      <div v-if="status === 'pending'" class="space-y-3">
        <USkeleton class="h-10 w-full" />
        <USkeleton class="h-10 w-full" />
        <USkeleton class="h-10 w-full" />
      </div>

      <BillingPricingPlans
        v-else-if="page"
        :page="page"
        cancel-path="/app/subscribe?checkout=cancel"
        success-path="/app?checkout=success"
      />
    </template>
  </UDashboardPanel>
</template>
