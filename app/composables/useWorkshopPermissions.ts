import { hasPlanAccess, ACTION_PLAN_REQUIREMENTS, type PlanKey } from '~/composables/usePlans'

export function useWorkshopPermissions() {
  const bootstrap = useWorkshopBootstrap()

  /**
   * Returns true when the current user can perform `actionCode`.
   *
   * Two-layer check (both must pass):
   *   1. Plan gate  — if the action requires a minimum plan tier, the org's
   *                   plan must meet or exceed it.  This applies to everyone,
   *                   including admins, because it is an org-level capability.
   *   2. Role gate  — the user's role must explicitly grant the action.
   *                   Admins bypass the role gate (they have full access).
   */
  function can(actionCode: string): boolean {
    // 1. Plan gate (org-level, no bypass)
    const requiredPlan = ACTION_PLAN_REQUIREMENTS[actionCode]
    if (requiredPlan) {
      if (!hasPlanAccess(bootstrap.planKey.value as PlanKey | null, requiredPlan))
        return false
    }

    // 2. Role gate (bypassed for org admins)
    if (bootstrap.isAdmin.value)
      return true

    return bootstrap.permissions.value[actionCode] === true
  }

  function canAny(actionCodes: string[]): boolean {
    return actionCodes.some(can)
  }

  function canAll(actionCodes: string[]): boolean {
    return actionCodes.every(can)
  }

  return {
    ...bootstrap,
    can,
    canAny,
    canAll
  }
}
