import { readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

/**
 * POST /api/users/employee-auth-status
 * Checks if an employee has a linked auth user.
 * Migrated from: supabase/functions/getEmployeeAuthStatus
 */
export default eventHandler(async (event) => {
  await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const body = await readBody(event)
  const { employee_id } = body || {}

  if (!employee_id) {
    throw createError({ statusCode: 400, statusMessage: 'employee_id é obrigatório' })
  }

  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, user_id, is_active')
    .eq('employee_id', employee_id)
    .limit(1)

  if (users && users.length > 0) {
    const firstUser = users[0]

    if (!firstUser) {
      return {
        hasAuthUser: false,
        user_id: null,
        active: false
      }
    }

    return {
      hasAuthUser: true,
      user_id: firstUser.user_id,
      active: firstUser.is_active ?? true
    }
  }

  return {
    hasAuthUser: false,
    user_id: null,
    active: false
  }
})
