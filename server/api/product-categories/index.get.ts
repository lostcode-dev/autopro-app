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

  const query = getQuery(event)

  let dbQuery = supabase
    .from('product_categories')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.search) {
    dbQuery = dbQuery.ilike('name', `%${query.search}%`)
  }

  dbQuery = dbQuery.order('name', { ascending: true })

  const { data: items, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items }
})
