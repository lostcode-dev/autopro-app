import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)
  const search = query.search ? String(query.search).trim() : ''
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(500, Math.max(1, Number(query.page_size) || 30))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let dbQuery = supabase
    .from('master_products')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (search) {
    dbQuery = dbQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data: items, count, error } = await dbQuery.range(from, to)

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items: items || [], total: count ?? 0, page, page_size: pageSize }
})
