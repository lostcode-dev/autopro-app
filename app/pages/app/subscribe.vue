<script setup lang="ts">
import BillingPricingPlans from '~/components/billing/BillingPricingPlans.vue'

definePageMeta({
  layout: 'app'
})

const isOpen = ref(true)

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

        <template #right>
          <NotificationsButton />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UModal
        v-model:open="isOpen"
        :prevent-close="true"
        :ui="{ content: 'sm:max-w-5xl' }"
      >
        <template #content>
          <UCard>
            <template #header>
              Assinatura necessária
            </template>

            <div v-if="status === 'pending'" class="space-y-3">
              <USkeleton class="h-10 w-full" />
              <USkeleton class="h-10 w-full" />
              <USkeleton class="h-10 w-full" />
            </div>

            <BillingPricingPlans
              v-else-if="page"
              embedded
              :page="page"
              cancel-path="/app/subscribe?checkout=cancel"
              success-path="/app?checkout=success"
            />
          </UCard>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
