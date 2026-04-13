import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id')
    .eq('email', authUser.email!).maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403, statusMessage: 'Usuário não vinculado a uma organização' })

  const organizationId = profile.organization_id as string

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
