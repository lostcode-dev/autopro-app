import { useAuth } from '~/composables/useAuth'
import { useBilling } from '~/composables/useBilling'

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/app'))
    return

  const auth = useAuth()

  if (!auth.isAuthenticated.value)
    return

  const billing = useBilling()

  const shouldRetry = to.query?.checkout === 'success'
  try {
    if (!shouldRetry) {
      await billing.ensureReady()
    } else {
      for (let attempt = 0; attempt < 3; attempt++) {
        await billing.fetchStatus()
        if (billing.hasAccess.value)
          return

        await new Promise(resolve => setTimeout(resolve, 1200))
      }
    }
  } catch (error: unknown) {
    const err = error as { statusCode?: number, status?: number }
    const statusCode = err?.statusCode || err?.status
    if (statusCode === 401) {
      const user = await auth.fetchUser()
      if (!user)
        return navigateTo('/login')
      return
    }
    // return navigateTo('/app/subscribe')
  }

  // if (!billing.hasAccess.value)
  //   return navigateTo('/app/subscribe')
})
