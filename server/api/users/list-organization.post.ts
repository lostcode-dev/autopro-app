import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/users/list-organization
 * Lists all users in the authenticated user's organization.
 * Migrated from: supabase/functions/listOrganizationUsers
 */
export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, display_name, organization_id, employee_id, role_id, active')
    .eq('organization_id', organizationId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao listar usuários da organização' })
  }

  return {
    users: users || [],
    organization_id: organizationId
  }
})
