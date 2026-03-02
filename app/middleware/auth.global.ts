import { useAuth } from "~/composables/useAuth"

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()
  await auth.ensureReady()

  const isAppRoute = to.path.startsWith('/app')
  const isAuthRoute = to.path === '/login' || to.path === '/signup'

  if (isAppRoute && !auth.isAuthenticated.value)
    return navigateTo('/login')

  if (isAuthRoute && auth.isAuthenticated.value)
    return navigateTo('/app')
})
