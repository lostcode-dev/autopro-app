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
  const category = query.category as string | undefined
  const lowStock = query.low_stock as string | undefined

  let dbQuery = supabase
    .from('parts')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (search) {
    dbQuery = dbQuery.or(`description.ilike.%${search}%,code.ilike.%${search}%,brand.ilike.%${search}%`)
  }

  if (category) {
    dbQuery = dbQuery.eq('category', category)
  }

  // PostgREST column-to-column comparison via the generic .filter() with 'lte' and a column ref.
  // The Supabase JS client passes this as: ?stock_quantity=lte.minimum_quantity which
  // PostgREST interprets as a literal value — not a column. The correct approach is to
  // use a Postgres function/view, or fetch all and filter in JS. We filter in JS here for
  // simplicity and to avoid a stored procedure dependency.
  const { data: allItems, error } = await dbQuery.order('description', { ascending: true })

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  const items = lowStock === 'true'
    ? allItems?.filter(p => p.stock_quantity <= p.minimum_quantity) ?? []
    : allItems ?? []

  return { items }
})
