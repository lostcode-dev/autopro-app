import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

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
