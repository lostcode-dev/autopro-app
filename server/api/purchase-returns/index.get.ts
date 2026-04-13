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
  const pageSize = Math.max(1, Number(query.page_size) || 30)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let dbQuery = supabase
    .from('purchase_returns')
    .select('*, suppliers(id, name), purchases(id, purchase_date, invoice_number)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status as string)
  }

  if (query.reason) {
    dbQuery = dbQuery.eq('reason', query.reason as string)
  }

  if (query.supplier_id) {
    dbQuery = dbQuery.eq('supplier_id', query.supplier_id as string)
  }

  dbQuery = dbQuery.order('return_date', { ascending: false }).range(from, to)

  const { data: items, count, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items, total: count ?? 0, page, page_size: pageSize }
})
