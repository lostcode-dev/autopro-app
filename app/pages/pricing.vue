<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { data: page } = await useAsyncData('pricing', () => queryCollection('pricing').first())

const title = page.value?.seo?.title || page.value?.title
const description = page.value?.seo?.description || page.value?.description

useSeoMeta({
  title,
  ogTitle: title,
  description,
  ogDescription: description
})

defineOgImageComponent('Saas')

const isYearly = ref('0')

const items = ref([
  {
    label: 'Mensal',
    value: '0'
  },
  {
    label: 'Anual',
    value: '1'
  }
])

const toast = useToast()
const auth = useAuth()

async function startCheckout(priceId: string) {
  await auth.ensureReady()

  if (!auth.isAuthenticated.value) {
    await navigateTo('/login')
    return
  }

  try {
    const { url } = await $fetch<{ url: string }>('/api/billing/checkout', {
      method: 'POST',
      body: { priceId }
    })

    await navigateTo(url, { external: true })
  }
  catch (error: any) {
    const message = error?.data?.statusMessage || error?.statusMessage || 'Não foi possível iniciar o checkout'
    toast.add({ title: 'Erro', description: message, color: 'error' })
  }
}

const plansWithActions = computed(() => {
  const plans = (page.value?.plans || []) as any[]

  return plans.map((plan) => {
    const priceId = isYearly.value === '1' ? plan?.stripePriceId?.year : plan?.stripePriceId?.month
    if (!priceId)
      return plan

    return {
      ...plan,
      button: {
        ...(plan.button || {}),
        onClick: () => startCheckout(priceId)
      }
    }
  })
})
</script>

<template>
  <div v-if="page">
    <UPageHero
      :title="page.title"
      :description="page.description"
    >
      <template #links>
        <UTabs
          v-model="isYearly"
          :items="items"
          color="neutral"
          size="xs"
          class="w-48"
          :ui="{
            list: 'ring ring-accented rounded-full',
            indicator: 'rounded-full',
            trigger: 'w-1/2'
          }"
        />
      </template>
    </UPageHero>

    <UContainer>
      <UPricingPlans scale>
        <UPricingPlan
          v-for="(plan, index) in plansWithActions"
          :key="index"
          v-bind="plan"
          :price="isYearly === '1' ? plan.price.year : plan.price.month"
          :billing-cycle="isYearly === '1' ? '/ano' : '/mês'"
        />
      </UPricingPlans>
    </UContainer>

    <UPageSection>
      <UPageLogos>
        <UIcon
          v-for="icon in page.logos.icons"
          :key="icon"
          :name="icon"
          class="w-12 h-12 flex-shrink-0 text-muted"
        />
      </UPageLogos>
    </UPageSection>

    <UPageSection
      :title="page.faq.title"
      :description="page.faq.description"
    >
      <UAccordion
        :items="page.faq.items"
        :unmount-on-hide="false"
        :default-value="['0']"
        type="multiple"
        class="max-w-3xl mx-auto"
        :ui="{
          trigger: 'text-base text-highlighted',
          body: 'text-base text-muted'
        }"
      />
    </UPageSection>
  </div>
</template>
