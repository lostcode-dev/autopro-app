import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id')
    .eq('email', authUser.email!).maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403, statusMessage: 'Usuário não vinculado a uma organização' })

  const organizationId = profile.organization_id as string

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID obrigatório' })

  // Verify the role belongs to this org (or is a system role)
  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('id', id)
    .or(`organization_id.eq.${organizationId},is_system_role.eq.true`)
    .is('deleted_at', null)
    .maybeSingle()

  if (!role) throw createError({ statusCode: 404, statusMessage: 'Perfil não encontrado' })

  // Get all system-wide actions
  const { data: actions, error: actionsError } = await supabase
    .from('actions')
    .select('*')
    .order('resource', { ascending: true })

  if (actionsError)
    throw createError({ statusCode: 500, statusMessage: actionsError.message })

  // Get the role's configured permissions
  const { data: role_actions, error: roleActionsError } = await supabase
    .from('role_actions')
    .select('*')
    .eq('role_id', id)

  if (roleActionsError)
    throw createError({ statusCode: 500, statusMessage: roleActionsError.message })

  return { actions, role_actions }
})
