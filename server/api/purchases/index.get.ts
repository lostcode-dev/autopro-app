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
  const ALLOWED_SORT_COLUMNS = ['purchase_date', 'invoice_number', 'total_amount', 'payment_status', 'created_at'] as const
  const sortBy = ALLOWED_SORT_COLUMNS.includes(query.sort_by as typeof ALLOWED_SORT_COLUMNS[number])
    ? String(query.sort_by)
    : 'purchase_date'
  const sortAscending = String(query.sort_order || 'desc') !== 'desc'

  let dbQuery = supabase
    .from('purchases')
    .select('*, suppliers(id, name)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.search) {
    const search = query.search as string
    dbQuery = dbQuery.or(`invoice_number.ilike.%${search}%,notes.ilike.%${search}%`)
  }

  if (query.payment_status) {
    dbQuery = dbQuery.eq('payment_status', query.payment_status as string)
  }

  if (query.supplier_id) {
    dbQuery = dbQuery.eq('supplier_id', query.supplier_id as string)
  }

  if (query.date_from) {
    dbQuery = dbQuery.gte('purchase_date', query.date_from as string)
  }

  if (query.date_to) {
    dbQuery = dbQuery.lte('purchase_date', query.date_to as string)
  }

  dbQuery = dbQuery
    .order(sortBy, { ascending: sortAscending, nullsFirst: false })
    .range(from, to)

  const { data: items, count, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items, total: count ?? 0, page, page_size: pageSize }
})
