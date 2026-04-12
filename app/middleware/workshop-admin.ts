export default defineNuxtRouteMiddleware(() => {
  const workshop = useWorkshopBootstrap()

  if (workshop.isAdmin.value)
    return

  return navigateTo('/app/forbidden')
})
