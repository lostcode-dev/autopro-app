import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

  const { data: organization, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  if (!organization)
    throw createError({ statusCode: 404, statusMessage: 'Organização não encontrada' })

  return organization
})
