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

  const query = getQuery(event)
  const search = query.search as string | undefined
  const type = query.type as string | undefined
  const categoryId = query.category_id as string | undefined

  let dbQuery = supabase
    .from('products')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (search) {
    dbQuery = dbQuery.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
  }

  if (type) {
    dbQuery = dbQuery.eq('type', type)
  }

  if (categoryId) {
    dbQuery = dbQuery.eq('category_id', categoryId)
  }

  const { data: items, error } = await dbQuery.order('name', { ascending: true })

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items }
})
