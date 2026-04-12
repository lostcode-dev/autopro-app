export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/app') && !to.path.startsWith('/admin'))
    return

  const auth = useAuth()
  await auth.ensureReady()

  if (!auth.isAuthenticated.value)
    return

  const bootstrap = useWorkshopBootstrap()
  await bootstrap.ensureReady()
})
