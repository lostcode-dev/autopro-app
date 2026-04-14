import { useAuth } from '~/composables/useAuth'
import { useWorkshopBootstrap } from '~/composables/useWorkshopBootstrap'

/**
 * Resolves the post-login destination for an authenticated user based on
 * their bootstrap data:
 *   - isOwner → /admin
 *   - has org + onboarding complete → /app
 *   - has org + onboarding incomplete → /onboarding
 *   - no organization → /subscription
 */
export function resolveAuthenticatedDestination(bootstrap: ReturnType<typeof useWorkshopBootstrap>): string {
  if (bootstrap.isOwner.value) return '/admin'
  if (bootstrap.organizationId.value) {
    return bootstrap.isOnboardingComplete.value ? '/app' : '/onboarding'
  }
  return '/subscription'
}

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()

  const isAppRoute = to.path.startsWith('/app')
  const isAdminRoute = to.path.startsWith('/admin')
  const isSubscriptionRoute = to.path === '/subscription' || to.path.startsWith('/subscription/')
  const isCheckoutRoute = to.path.startsWith('/checkout')
  const isOnboardingRoute = to.path === '/onboarding' || to.path.startsWith('/onboarding/')
  const isProtectedRoute = isAppRoute || isAdminRoute || isSubscriptionRoute || isCheckoutRoute || isOnboardingRoute
  const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(to.path)

  // ── 1. Quick session check via cookie hints (avoids network call) ──────────
  const userCookie = useCookie<string | null>('sb-user')

  const hasSessionHints = (() => {
    if (userCookie.value) return true
    if (!import.meta.server) return false
    const cookieHeader = useRequestHeaders(['cookie']).cookie
    if (!cookieHeader) return false
    return cookieHeader.includes('sb-access-token=') || cookieHeader.includes('sb-refresh-token=')
  })()

  if (!hasSessionHints) {
    auth.setGuestReady()
    if (isProtectedRoute) return navigateTo('/login')
    return
  }

  // ── 2. Ensure auth session is valid ───────────────────────────────────────
  await auth.ensureReady()

  if (!auth.isAuthenticated.value) {
    if (isProtectedRoute) return navigateTo('/login')
    return
  }

  // ── 3. Load bootstrap (cached after first load) ───────────────────────────
  const bootstrap = useWorkshopBootstrap()
  await bootstrap.ensureReady()

  const isOwner = bootstrap.isOwner.value
  const hasOrganization = !!bootstrap.organizationId.value
  const onboardingComplete = bootstrap.isOnboardingComplete.value

  // ── 4. Auth pages: redirect away from login/signup once authenticated ──────
  if (isAuthRoute) {
    return navigateTo(resolveAuthenticatedDestination(bootstrap))
  }

  // ── 5. /admin routes: require isOwner flag ────────────────────────────────
  if (isAdminRoute) {
    if (!isOwner) return navigateTo(hasOrganization ? (onboardingComplete ? '/app' : '/onboarding') : '/subscription')
    return
  }

  // ── 6. /app routes: require org with completed onboarding ─────────────────
  if (isAppRoute) {
    if (!hasOrganization) return navigateTo('/subscription')
    if (!onboardingComplete) return navigateTo('/onboarding')
    return
  }

  // ── 7. /onboarding route: require org, block if already complete ──────────
  if (isOnboardingRoute) {
    if (isOwner) return navigateTo('/admin')
    if (!hasOrganization) return navigateTo('/subscription')
    if (onboardingComplete) return navigateTo('/app')
    return
  }

  // ── 8. /subscription route: block if user already has org or is owner ──────
  if (isSubscriptionRoute) {
    if (isOwner) return navigateTo('/admin')
    if (hasOrganization) return navigateTo(onboardingComplete ? '/app' : '/onboarding')
    return
  }

  // ── 9. /checkout/** routes: auth-only, no org requirement ─────────────────
  // (The success page handles polling for org creation after webhook fires)
  if (isCheckoutRoute) {
    return
  }
})
