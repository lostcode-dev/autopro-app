import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

/**
 * POST /api/users/initial-data
 * Bootstrap endpoint for the workshop app.
 * Returns normalized user, organization, role and permissions data.
 * Migrated from: supabase/functions/getInitialUserData
 */
export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle()

  if (profileError || !profile) {
    throw createError({ statusCode: 404, statusMessage: 'Usuario nao encontrado' })
  }

  const organizationId = profile.organization_id ?? null

  const [orgResult, roleResult, employeeResult, rolesResult] = await Promise.all([
    organizationId
      ? supabase.from('organizations').select('*').eq('id', organizationId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role_id
      ? supabase.from('roles').select('*').eq('id', profile.role_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.employee_id
      ? supabase.from('employees').select('*').eq('id', profile.employee_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    organizationId
      ? supabase
          .from('roles')
          .select('*')
          .or(`organization_id.eq.${organizationId},is_system_role.eq.true`)
      : supabase
          .from('roles')
          .select('*')
          .eq('is_system_role', true)
  ])

  const organization = orgResult.data ?? null
  const userRole = roleResult.data ?? null
  const employee = employeeResult.data ?? null
  const roles = rolesResult.data ?? []
  const isOwner = profile.is_owner === true
  const isAdmin = isOwner || userRole?.name === 'admin' || userRole?.is_system_role === true
  const onboardingCompleted = organization ? (organization as Record<string, unknown>).onboarding_completed === true : false

  if (employee?.termination_date) {
    const terminationDate = new Date(employee.termination_date)
    if (terminationDate <= new Date()) {
      return {
        currentUser: profile,
        userRole,
        organization,
        employee,
        roles,
        actions: [],
        roleActions: [],
        permissions: {},
        organizationId,
        isOwner,
        isAdmin,
        terminated: true,
        termination_date: employee.termination_date ?? null,
        termination_reason: employee.termination_reason ?? null,
        onboardingCompleted,
        user: profile,
        role: userRole
      }
    }
  }

  let roleActions: Record<string, any>[] = []
  let actions: Record<string, any>[] = []

  if (profile.role_id) {
    const [roleActionsResult, actionsResult] = await Promise.all([
      supabase.from('role_actions').select('*').eq('role_id', profile.role_id),
      supabase.from('actions').select('*')
    ])

    roleActions = roleActionsResult.data || []
    actions = actionsResult.data || []
  }

  const permissions = roleActions.reduce<Record<string, boolean>>((acc, roleAction) => {
    const action = actions.find(item => item.id === roleAction.action_id)
    if (action?.code)
      acc[action.code] = true
    return acc
  }, {})

  return {
    currentUser: profile,
    userRole,
    organization,
    employee,
    roles,
    actions,
    roleActions,
    permissions,
    organizationId,
    isOwner,
    isAdmin,
    terminated: false,
    termination_date: null,
    termination_reason: null,
    onboardingCompleted,
    user: profile,
    role: userRole
  }
})
