import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let dbQuery = supabase
    .from('taxes')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.search) {
    const s = String(query.search)
    dbQuery = dbQuery.or(`name.ilike.%${s}%,type.ilike.%${s}%`)
  }

  const ALLOWED_SORT = ['name', 'type', 'rate', 'created_at'] as const
  const sortBy = ALLOWED_SORT.includes(query.sort_by as typeof ALLOWED_SORT[number])
    ? String(query.sort_by)
    : 'name'
  const ascending = String(query.sort_order) !== 'desc'

  dbQuery = dbQuery.order(sortBy, { ascending }).range(from, to)

  const { data: items, count, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items, total: count ?? 0, page, page_size: pageSize }
})
