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
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let dbQuery = supabase
    .from('bank_accounts')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.search) {
    const s = String(query.search)
    dbQuery = dbQuery.or(`account_name.ilike.%${s}%,bank_name.ilike.%${s}%`)
  }

  const isActiveParam = query.is_active as string | undefined
  if (isActiveParam === 'true') dbQuery = dbQuery.eq('is_active', true)
  else if (isActiveParam === 'false') dbQuery = dbQuery.eq('is_active', false)

  const ALLOWED_SORT = ['account_name', 'account_type', 'bank_name', 'created_at'] as const
  const sortBy = ALLOWED_SORT.includes(query.sort_by as typeof ALLOWED_SORT[number])
    ? String(query.sort_by)
    : 'account_name'
  const ascending = String(query.sort_order) !== 'desc'

  dbQuery = dbQuery.order(sortBy, { ascending }).range(from, to)

  const { data: items, count, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items, total: count ?? 0, page, page_size: pageSize }
})
