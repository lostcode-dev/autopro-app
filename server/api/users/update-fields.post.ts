import { readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

/**
 * POST /api/users/update-fields
 * Updates allowed fields on a user profile (organization_id, role_id, employee_id, email).
 * Migrated from: supabase/functions/updateUserFields
 */
export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const body = await readBody(event)
  const { user_id, organization_id, role_id, employee_id, email } = body || {}

  if (!user_id) {
    throw createError({ statusCode: 400, statusMessage: 'user_id é obrigatório' })
  }

  const updates: Record<string, unknown> = {}
  if (organization_id !== undefined) updates.organization_id = organization_id
  if (role_id !== undefined) updates.role_id = role_id
  if (employee_id !== undefined) updates.employee_id = employee_id
  if (email !== undefined) updates.email = email

  if (Object.keys(updates).length === 0) {
    return { success: true, message: 'Nada a atualizar' }
  }

  updates.updated_by = authUser.email

  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', user_id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao atualizar usuário' })
  }

  return { success: true }
})
