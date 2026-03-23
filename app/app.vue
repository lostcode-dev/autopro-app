<script setup lang="ts">
import { pt_br } from '@nuxt/ui/locale'

const route = useRoute()
const colorMode = useColorMode()
const { state: preferencesState, applyBrandTheme, applyPublicTheme, applyStoredTheme } = useUserPreferences()
const runtimeConfig = useRuntimeConfig()

const color = computed(() => colorMode.value === 'dark' ? '#020618' : 'white')
const isAppRoute = computed(() => route.path.startsWith('/app'))
const siteUrl = runtimeConfig.public.siteUrl?.replace(/\/$/, '') || 'https://kortex.app'
const defaultOgImage = `${siteUrl}/icons/icon-512x512.png`

watch(
  () => [
    route.path,
    preferencesState.value.loaded,
    preferencesState.value.primary_color,
    preferencesState.value.neutral_color,
    preferencesState.value.color_mode
  ],
  () => {
    if (!isAppRoute.value) {
      applyPublicTheme()
      return
    }

    if (!preferencesState.value.loaded) {
      applyBrandTheme()
      return
    }

    applyStoredTheme()
  },
  { immediate: true }
)

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
    { key: 'theme-color', name: 'theme-color', content: color },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Kortex' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'format-detection', content: 'telephone=no' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icons/kortex-icon.svg' },
    { rel: 'alternate icon', type: 'image/png', href: '/icons/icon-192x192.png' },
    { rel: 'shortcut icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
    { rel: 'mask-icon', href: '/icons/kortex-mono.svg', color: '#12E39A' }
  ],
  htmlAttrs: {
    lang: 'pt-BR'
  }
})

useSeoMeta({
  titleTemplate: '%s - Kortex',
  applicationName: 'Kortex',
  appleMobileWebAppTitle: 'Kortex',
  author: 'Kortex',
  ogSiteName: 'Kortex',
  ogImage: defaultOgImage,
  twitterImage: defaultOgImage,
  twitterCard: 'summary_large_image',
  twitterSite: '@kortexapp'
})

const { data: navigation } = await useAsyncData('navigation', () => queryCollectionNavigation('docs'), {
  transform: data => data.find(item => item.path === '/docs')?.children || []
})
const { data: files } = useLazyAsyncData('search', () => queryCollectionSearchSections('docs'), {
  server: false
})

const links = [{
  label: 'Documentação',
  icon: 'i-lucide-book',
  to: '/docs/getting-started'
}, {
  label: 'Planos',
  icon: 'i-lucide-credit-card',
  to: '/pricing'
}, {
  label: 'Blog',
  icon: 'i-lucide-pencil',
  to: '/blog'
}, {
  label: 'Novidades',
  icon: 'i-lucide-history',
  to: '/changelog'
}]

provide('navigation', navigation)
</script>

<template>
  <UApp :locale="pt_br">
    <NuxtLoadingIndicator
      color="linear-gradient(90deg, #12E39A 0%, #5EF2BF 45%, #12E39A 100%)"
      error-color="#fb7185"
      :height="3"
    />

    <ClientOnly>
      <CapacitorInit />
    </ClientOnly>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <ClientOnly>
      <LazyUContentSearch
        :files="files"
        shortcut="meta_k"
        :navigation="navigation"
        :links="links"
        :fuse="{ resultLimit: 42 }"
      />
    </ClientOnly>
  </UApp>
</template>
