import { readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/users/update-role
 * Updates a user's role_id. Only allows changes within the same organization.
 * Migrated from: supabase/functions/updateUserRole
 */
export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const body = await readBody(event)
  const { user_id, role_id } = body || {}

  if (!user_id) {
    throw createError({ statusCode: 400, statusMessage: 'user_id é obrigatório' })
  }

  if (!role_id || typeof role_id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'role_id é obrigatório' })
  }

  const currentOrgId = await resolveOrganizationId(event, authUser.id)

  // Verify target user belongs to same organization
  const { data: targetUser, error: targetError } = await supabase
    .from('user_profiles')
    .select('id, organization_id')
    .eq('id', user_id)
    .maybeSingle()

  if (targetError || !targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'Usuário alvo não encontrado' })
  }

  if (targetUser.organization_id !== currentOrgId) {
    throw createError({ statusCode: 403, statusMessage: 'Usuário não pertence à sua organização' })
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ role_id, updated_by: authUser.email })
    .eq('id', user_id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao atualizar role do usuário' })
  }

  return { success: true }
})
