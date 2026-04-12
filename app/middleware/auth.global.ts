import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()
  const isAppRoute = to.path.startsWith('/app')
  const isAdminRoute = to.path.startsWith('/admin')
  const isProtectedRoute = isAppRoute || isAdminRoute
  const isAuthRoute = to.path === '/login' || to.path === '/signup'
  const userCookie = useCookie<string | null>('sb-user')

  const hasSessionHints = (() => {
    if (userCookie.value)
      return true

    if (!import.meta.server)
      return false

    const cookieHeader = useRequestHeaders(['cookie']).cookie
    if (!cookieHeader)
      return false

    return cookieHeader.includes('sb-access-token=') || cookieHeader.includes('sb-refresh-token=')
  })()

  if (!hasSessionHints) {
    auth.setGuestReady()

    if (isProtectedRoute)
      return navigateTo('/login')

    return
  }

  await auth.ensureReady()

  if (isProtectedRoute && !auth.isAuthenticated.value)
    return navigateTo('/login')

  if (isAuthRoute && auth.isAuthenticated.value)
    return navigateTo('/app')
})
