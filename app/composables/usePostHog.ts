import type posthog from 'posthog-js'
import type { FeatureFlagsCallback, JsonType, Properties } from 'posthog-js'
import type { AuthUser } from '~/composables/useAuth'
import { PostHogEvent } from '~/types/analytics'

type PostHogClient = typeof posthog
type PostHogCaptureProperties = Record<string, JsonType | undefined>
type PostHogFeatureFlagValue = boolean | string | undefined
type PostHogRouteLocation = {
  fullPath: string
  hash?: string
  name?: string | symbol | null
  path: string
  query?: Record<string, unknown>
}
type PostHogPageViewOptions = {
  referrer?: string
}

let posthogClient: PostHogClient | null = null

function normalizeStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function sanitizeProperties(properties?: PostHogCaptureProperties): Properties | undefined {
  if (!properties)
    return undefined

  const entries = Object.entries(properties).filter(([, value]) => value !== undefined && value !== null)
  if (!entries.length)
    return undefined

  return Object.fromEntries(entries)
}

function getUserDisplayName(user: AuthUser): string | undefined {
  const metadata = user.user_metadata ?? {}

  return normalizeStringValue(metadata.full_name)
    ?? normalizeStringValue(metadata.name)
    ?? normalizeStringValue(metadata.display_name)
}

export function setPostHogClient(client: PostHogClient | null) {
  posthogClient = client
}

export function usePostHog() {
  const runtimeConfig = useRuntimeConfig()
  const initialized = useState<boolean>('posthog:initialized', () => false)
  const lastTrackedPath = useState<string | null>('posthog:last-tracked-path', () => null)
  const lastIdentifiedUserId = useState<string | null>('posthog:last-identified-user-id', () => null)

  const isEnabled = computed(() => {
    if (import.meta.server)
      return false

    return !import.meta.dev
      && runtimeConfig.public.posthogEnabled
      && Boolean(runtimeConfig.public.posthogKey)
      && Boolean(posthogClient)
      && initialized.value
  })

  function setInitialized(value: boolean) {
    initialized.value = value
  }

  function capture(event: PostHogEvent | string, properties?: PostHogCaptureProperties) {
    if (!isEnabled.value || !posthogClient)
      return

    posthogClient.capture(event, sanitizeProperties(properties))
  }

  function capturePageView(route: PostHogRouteLocation, options: PostHogPageViewOptions = {}) {
    if (!isEnabled.value || !posthogClient)
      return

    if (lastTrackedPath.value === route.fullPath)
      return

    lastTrackedPath.value = route.fullPath

    capture(PostHogEvent.PageViewed, {
      current_url: import.meta.client ? window.location.href : route.fullPath,
      hash: route.hash || undefined,
      path: route.path,
      query_count: route.query ? Object.keys(route.query).length : 0,
      referrer: options.referrer || (import.meta.client ? document.referrer || undefined : undefined),
      route_name: route.name ? String(route.name) : undefined
    })
  }

  function captureNavigation(from: PostHogRouteLocation, to: PostHogRouteLocation) {
    if (!isEnabled.value || !posthogClient)
      return

    if (from.fullPath === to.fullPath)
      return

    capture(PostHogEvent.NavigationTransition, {
      from_path: from.path,
      from_route_name: from.name ? String(from.name) : undefined,
      to_path: to.path,
      to_route_name: to.name ? String(to.name) : undefined
    })
  }

  function identifyUser(user: AuthUser) {
    if (!isEnabled.value || !posthogClient)
      return

    if (lastIdentifiedUserId.value === user.id)
      return

    posthogClient.identify(user.id, sanitizeProperties({
      email: normalizeStringValue(user.email),
      name: getUserDisplayName(user)
    }))

    lastIdentifiedUserId.value = user.id
  }

  function resetUser() {
    if (!isEnabled.value || !posthogClient)
      return

    posthogClient.reset()
    lastIdentifiedUserId.value = null
  }

  function isFeatureEnabled(key: string): boolean {
    if (!isEnabled.value || !posthogClient)
      return false

    return Boolean(posthogClient.isFeatureEnabled(key))
  }

  function getFeatureFlag(key: string): PostHogFeatureFlagValue {
    if (!isEnabled.value || !posthogClient)
      return undefined

    const value = posthogClient.getFeatureFlag(key)
    return typeof value === 'boolean' || typeof value === 'string' ? value : undefined
  }

  function getFeatureFlagPayload<T = JsonType>(key: string): T | null {
    if (!isEnabled.value || !posthogClient)
      return null

    return (posthogClient.getFeatureFlagPayload(key) as T | undefined) ?? null
  }

  function reloadFeatureFlags() {
    if (!isEnabled.value || !posthogClient)
      return

    posthogClient.reloadFeatureFlags()
  }

  function onFeatureFlags(callback: FeatureFlagsCallback): (() => void) | undefined {
    if (!isEnabled.value || !posthogClient)
      return undefined

    return posthogClient.onFeatureFlags(callback)
  }

  return {
    capture,
    captureNavigation,
    capturePageView,
    getFeatureFlag,
    getFeatureFlagPayload,
    identifyUser,
    isEnabled,
    isFeatureEnabled,
    lastIdentifiedUserId,
    onFeatureFlags,
    reloadFeatureFlags,
    resetUser,
    setInitialized
  }
}
