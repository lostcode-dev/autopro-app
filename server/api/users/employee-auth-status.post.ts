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
    .select('id, active')
    .eq('employee_id', employee_id)
    .limit(1)

  if (users && users.length > 0) {
    return {
      hasAuthUser: true,
      user_id: users[0].id,
      active: users[0].active ?? true
    }
  }

  return {
    hasAuthUser: false,
    user_id: null,
    active: false
  }
})
