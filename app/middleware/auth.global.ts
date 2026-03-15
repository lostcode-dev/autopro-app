import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(async (to) => {
  console.log('[auth/middleware] start', {
    env: import.meta.server ? 'server' : 'client',
    path: to.path
  })
  const auth = useAuth()
  await auth.ensureReady()

  const isAppRoute = to.path.startsWith('/app')
  const isAuthRoute = to.path === '/login' || to.path === '/signup'

  console.log('[auth/middleware] resolved', {
    env: import.meta.server ? 'server' : 'client',
    path: to.path,
    isAppRoute,
    isAuthRoute,
    authenticated: auth.isAuthenticated.value
  })

  if (isAppRoute && !auth.isAuthenticated.value)
    return navigateTo('/login')

  if (isAuthRoute && auth.isAuthenticated.value)
    return navigateTo('/app')
})
