import posthog from 'posthog-js'
import { setPostHogClient, usePostHog } from '~/composables/usePostHog'

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const auth = useAuth()
  const router = useRouter()
  const {
    captureNavigation,
    capturePageView,
    identifyUser,
    lastIdentifiedUserId,
    resetUser,
    setInitialized
  } = usePostHog()

  const isTrackingEnabled = !import.meta.dev
    && runtimeConfig.public.posthogEnabled
    && Boolean(runtimeConfig.public.posthogKey)

  if (!isTrackingEnabled) {
    setPostHogClient(null)
    setInitialized(false)
    return
  }

  posthog.init(runtimeConfig.public.posthogKey, {
    api_host: runtimeConfig.public.posthogHost,
    autocapture: true,
    capture_pageleave: true,
    capture_pageview: false,
    person_profiles: 'identified_only',
    loaded: (client) => {
      client.register({
        app_name: 'kortex',
        app_runtime: 'nuxt-web'
      })
      client.register_for_session({
        deployment_environment: 'production'
      })
    }
  })

  setPostHogClient(posthog)
  setInitialized(true)

  watch(
    () => ({
      ready: auth.ready.value,
      user: auth.user.value
    }),
    ({ ready, user }) => {
      if (!ready)
        return

      if (user) {
        identifyUser(user)
        return
      }

      if (lastIdentifiedUserId.value)
        resetUser()
    },
    { immediate: true }
  )

  router.afterEach((to, from, failure) => {
    if (failure)
      return

    captureNavigation(from, to)
    capturePageView(to, {
      referrer: from.fullPath ? new URL(from.fullPath, window.location.origin).toString() : undefined
    })
  })

  onNuxtReady(() => {
    capturePageView(router.currentRoute.value)
  })
})
