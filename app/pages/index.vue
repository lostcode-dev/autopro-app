<script setup lang="ts">
import { PostHogEvent } from '~/types/analytics'

const { data: page } = await useAsyncData('index', () => queryCollection('index').first())
const { capture } = usePostHog()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()

const title = page.value?.seo?.title || page.value?.title
const description = page.value?.seo?.description || page.value?.description
const siteUrl = runtimeConfig.public.siteUrl?.replace(/\/$/, '') || 'https://autopro.app'
const canonicalUrl = `${siteUrl}${route.path}`
const ogImage = `${siteUrl}/icons/icon-512x512.png`

const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  'name': 'AutoPro',
  'applicationCategory': 'BusinessApplication',
  'operatingSystem': 'Web',
  'inLanguage': 'pt-BR',
  'description': description,
  'url': canonicalUrl,
  'offers': {
    '@type': 'Offer',
    'price': '0',
    'priceCurrency': 'BRL'
  }
}))

useSeoMeta({
  titleTemplate: '',
  title,
  ogTitle: title,
  description,
  ogDescription: description,
  keywords: 'software para oficina, gestao de oficina, ordens de servico, clientes, veiculos, financeiro, administracao',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  ogType: 'website',
  ogUrl: canonicalUrl,
  ogLocale: 'pt_BR',
  ogImage,
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: ogImage
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: canonicalUrl
    }
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(jsonLd.value)
    }
  ]
})

const heroLinks = computed(() => (page.value?.hero?.links ?? []).map((link: Record<string, unknown>, index: number) => ({
  ...link,
  onClick: () => {
    capture(PostHogEvent.PublicHeroCtaClicked, {
      cta_index: index,
      location: 'hero',
      target: typeof link.to === 'string' ? link.to : undefined,
      target_label: typeof link.label === 'string' ? link.label : undefined
    })
  }
})))

const ctaProps = computed(() => {
  if (!page.value?.cta)
    return undefined

  return {
    ...page.value.cta,
    links: (page.value.cta.links ?? []).map((link: Record<string, unknown>, index: number) => ({
      ...link,
      onClick: () => {
        capture(PostHogEvent.PublicFinalCtaClicked, {
          cta_index: index,
          location: 'page-bottom',
          target: typeof link.to === 'string' ? link.to : undefined,
          target_label: typeof link.label === 'string' ? link.label : undefined
        })
      }
    }))
  }
})
</script>

<template>
  <div v-if="page">
    <UPageHero
      :title="page.title"
      :description="page.description"
      :links="heroLinks"
    >
      <template #top>
        <HeroBackground />
      </template>

      <template #title>
        <MDC
          :value="page.title"
          unwrap="p"
        />
      </template>

      <PromotionalVideo />
    </UPageHero>

    <UPageSection
      v-for="(section, index) in page.sections"
      :key="index"
      :title="section.title"
      :description="section.description"
      :orientation="section.orientation"
      :reverse="section.reverse"
      :features="section.features"
    >
      <ImagePlaceholder />
    </UPageSection>

    <UPageSection
      :title="page.features.title"
      :description="page.features.description"
    >
      <UPageGrid>
        <UPageCard
          v-for="(item, index) in page.features.items"
          :key="index"
          v-bind="item"
          spotlight
        />
      </UPageGrid>
    </UPageSection>

    <UPageSection
      id="testimonials"
      :headline="page.testimonials.headline"
      :title="page.testimonials.title"
      :description="page.testimonials.description"
    >
      <UPageColumns class="xl:columns-4">
        <UPageCard
          v-for="(testimonial, index) in page.testimonials.items"
          :key="index"
          variant="subtle"
          :description="testimonial.quote"
          :ui="{ description: 'before:content-[open-quote] after:content-[close-quote]' }"
        >
          <template #footer>
            <UUser
              v-bind="testimonial.user"
              size="lg"
            />
          </template>
        </UPageCard>
      </UPageColumns>
    </UPageSection>

    <USeparator />

    <UPageCTA
      v-bind="ctaProps"
      variant="naked"
      class="overflow-hidden"
    >
      <LazyStarsBg />
    </UPageCTA>
  </div>
</template>
