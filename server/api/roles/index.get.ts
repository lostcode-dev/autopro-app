import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

  // Include both org-specific roles and system roles
  const { data: items, error } = await supabase
    .from('roles')
    .select('*')
    .or(`organization_id.eq.${organizationId},is_system_role.eq.true`)
    .is('deleted_at', null)
    .order('display_name', { ascending: true })

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items }
})
