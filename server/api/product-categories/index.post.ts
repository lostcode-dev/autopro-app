import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('email', authUser.email!)
    .maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403, statusMessage: 'Usuário não vinculado a uma organização' })

  const organizationId = profile.organization_id as string

  const body = await readBody(event)

  if (!body.name)
    throw createError({ statusCode: 400, statusMessage: 'O campo "name" é obrigatório' })

  const { data: item, error } = await supabase
    .from('product_categories')
    .insert({
      name: body.name,
      description: body.description ?? null,
      organization_id: organizationId,
      created_by: authUser.email,
      updated_by: authUser.email,
    })
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { item }
})
