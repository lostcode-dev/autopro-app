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
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 50))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let dbQuery = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.search) {
    const search = query.search as string
    dbQuery = dbQuery.or(`name.ilike.%${search}%,tax_id.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }

  if (query.person_type) {
    dbQuery = dbQuery.eq('person_type', query.person_type as string)
  }

  const ALLOWED_SORT_COLUMNS = ['name', 'person_type', 'tax_id', 'email', 'phone', 'created_at'] as const
  const sortBy = ALLOWED_SORT_COLUMNS.includes(query.sort_by as typeof ALLOWED_SORT_COLUMNS[number])
    ? (query.sort_by as string)
    : 'name'
  const sortAscending = (query.sort_order as string) !== 'desc'

  dbQuery = dbQuery.order(sortBy, { ascending: sortAscending }).range(from, to)

  const { data: items, count, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items, total: count ?? 0, page, page_size: pageSize }
})
