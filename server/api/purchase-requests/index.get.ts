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

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 30))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const ALLOWED_SORT_COLUMNS = ['request_number', 'request_date', 'requester', 'total_request_amount', 'status', 'created_at'] as const
  const sortBy = ALLOWED_SORT_COLUMNS.includes(query.sort_by as typeof ALLOWED_SORT_COLUMNS[number])
    ? String(query.sort_by)
    : 'request_date'
  const sortAscending = String(query.sort_order || 'desc') !== 'desc'

  let dbQuery = supabase
    .from('purchase_requests')
    .select('*, suppliers(id, name)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.search) {
    const search = query.search as string
    dbQuery = dbQuery.or(`request_number.ilike.%${search}%,requester.ilike.%${search}%`)
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status as string)
  }

  if (query.supplier_id) {
    dbQuery = dbQuery.eq('supplier_id', query.supplier_id as string)
  }

  dbQuery = dbQuery
    .order(sortBy, { ascending: sortAscending, nullsFirst: false })
    .range(from, to)

  const { data: items, count, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items, total: count ?? 0, page, page_size: pageSize }
})
