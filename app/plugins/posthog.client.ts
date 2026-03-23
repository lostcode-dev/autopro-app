import posthog from 'posthog-js'
import { setPostHogClient, usePostHog } from '~/composables/usePostHog'

const POSTHOG_TOOLBAR_ID = '__POSTHOG_TOOLBAR__'
const POSTHOG_TOOLBAR_CONTAINER_CLASS = 'toolbar-global-fade-container'
const POSTHOG_TOOLBAR_STORAGE_KEY = '_postHogToolbarParams'

function getAuthState(userId: string | null) {
  return userId ? 'authenticated' : 'anonymous'
}

function clearToolbarHashParams() {
  const hash = window.location.hash
  if (!hash.includes('__posthog=') && !hash.includes('state='))
    return

  const hashParams = new URLSearchParams(hash.slice(1))
  const hadPostHog = hashParams.has('__posthog')
  const hadState = hashParams.has('state')
  hashParams.delete('__posthog')
  hashParams.delete('state')

  if (!hadPostHog && !hadState)
    return

  const nextHash = hashParams.toString()
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ''}`
  window.history.replaceState(window.history.state, '', nextUrl)
}

function cleanupPostHogToolbar() {
  window.localStorage.removeItem(POSTHOG_TOOLBAR_STORAGE_KEY)
  clearToolbarHashParams()

  document.getElementById(POSTHOG_TOOLBAR_ID)?.remove()
  document.querySelector(`.${POSTHOG_TOOLBAR_CONTAINER_CLASS}`)?.remove()
}

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

  cleanupPostHogToolbar()

  posthog.init(runtimeConfig.public.posthogKey, {
    advanced_disable_toolbar_metrics: true,
    api_host: runtimeConfig.public.posthogHost,
    autocapture: true,
    capture_pageleave: true,
    capture_pageview: false,
    disable_external_dependency_loading: false,
    person_profiles: 'identified_only',
    loaded: (client) => {
      client.register({
        app_name: 'kortex',
        app_runtime: 'nuxt-web',
        auth_state: getAuthState(auth.user.value?.id ?? null)
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
        posthog.register({
          auth_state: 'authenticated'
        })
        identifyUser(user)
        return
      }

      if (lastIdentifiedUserId.value)
        resetUser()

      posthog.register({
        auth_state: 'anonymous'
      })
    },
    { immediate: true }
  )

  router.afterEach((to, from, failure) => {
    if (failure)
      return

    cleanupPostHogToolbar()

    const authState = getAuthState(lastIdentifiedUserId.value)
    captureNavigation(from, to, authState)
    capturePageView(to, {
      authState,
      referrer: from.fullPath ? new URL(from.fullPath, window.location.origin).toString() : undefined
    })
  })

  onNuxtReady(() => {
    cleanupPostHogToolbar()
    capturePageView(router.currentRoute.value, {
      authState: getAuthState(lastIdentifiedUserId.value)
    })
  })
})
