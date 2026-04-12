export default defineNuxtRouteMiddleware((to) => {
  const permission = to.meta.requiredPermission
  const permissions = to.meta.requiredPermissions

  if (!permission && !permissions)
    return

  const access = useWorkshopPermissions()
  const required = [
    ...(typeof permission === 'string' ? [permission] : []),
    ...((Array.isArray(permissions) ? permissions : []) as string[])
  ]

  if (required.length === 0)
    return

  if (access.canAny(required))
    return

  return navigateTo({
    path: '/app/forbidden',
    query: {
      from: to.fullPath
    }
  })
})
