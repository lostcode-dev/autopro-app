import { useAuth } from "~/composables/useAuth"
import { useBilling } from "~/composables/useBilling"

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/app'))
    return

  if (to.path === '/app/subscribe')
    return

  const auth = useAuth()
  await auth.ensureReady()

  if (!auth.isAuthenticated.value)
    return

  const billing = useBilling()

  const shouldRetry = to.query?.checkout === 'success'
  try {
    if (!shouldRetry) {
      await billing.ensureReady()
    }
    else {
      for (let attempt = 0; attempt < 3; attempt++) {
        await billing.fetchStatus()
        if (billing.hasAccess.value)
          return

        await new Promise(resolve => setTimeout(resolve, 1200))
      }
    }
  }
  catch (error: any) {
    const statusCode = error?.statusCode || error?.status
    if (statusCode === 401)
      return navigateTo('/login')
    return navigateTo('/app/subscribe')
  }

  if (!billing.hasAccess.value)
    return navigateTo('/app/subscribe')
})
