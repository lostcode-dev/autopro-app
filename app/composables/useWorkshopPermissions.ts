export function useWorkshopPermissions() {
  const bootstrap = useWorkshopBootstrap()

  function can(actionCode: string) {
    if (bootstrap.isAdmin.value)
      return true

    return bootstrap.permissions.value[actionCode] === true
  }

  function canAny(actionCodes: string[]) {
    return actionCodes.some(can)
  }

  function canAll(actionCodes: string[]) {
    return actionCodes.every(can)
  }

  return {
    ...bootstrap,
    can,
    canAny,
    canAll
  }
}
