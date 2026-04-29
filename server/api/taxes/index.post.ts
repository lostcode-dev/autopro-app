import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = await readBody(event)
  const { name, type, rate } = body

  if (!name || !type || rate === undefined || rate === null)
    throw createError({ statusCode: 400, statusMessage: 'name, type e rate são obrigatórios' })

  const { data: item, error } = await supabase
    .from('taxes')
    .insert({
      organization_id: organizationId,
      name,
      type,
      rate,
      created_by: authUser.email,
      updated_by: authUser.email
    })
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { item }
})
