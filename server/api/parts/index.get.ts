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
  const search = query.search ? String(query.search).trim() : ''
  const category = query.category ? String(query.category).trim() : ''
  const lowStock = query.low_stock === 'true'
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize

  const ALLOWED_SORT_COLUMNS = [
    'description',
    'code',
    'stock_quantity',
    'minimum_quantity',
    'sale_price',
    'cost_price',
    'brand',
    'category',
    'created_at'
  ] as const
  const sortBy = ALLOWED_SORT_COLUMNS.includes(query.sort_by as typeof ALLOWED_SORT_COLUMNS[number])
    ? String(query.sort_by)
    : 'description'
  const sortAscending = String(query.sort_order || 'asc') !== 'desc'

  let dbQuery = supabase
    .from('parts')
    .select('*, products(id, name, code, category_id, product_categories(id, name))')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (search) {
    dbQuery = dbQuery.or(`description.ilike.%${search}%,code.ilike.%${search}%,brand.ilike.%${search}%`)
  }

  // PostgREST column-to-column comparison via the generic .filter() with 'lte' and a column ref.
  // The Supabase JS client passes this as: ?stock_quantity=lte.minimum_quantity which
  // PostgREST interprets as a literal value — not a column. The correct approach is to
  // use a Postgres function/view, or fetch all and filter in JS. We filter in JS here for
  // simplicity and to avoid a stored procedure dependency.
  const { data: allItems, error } = await dbQuery.order(sortBy, { ascending: sortAscending, nullsFirst: false })

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  let filteredItems = lowStock
    ? allItems?.filter(p => p.stock_quantity <= p.minimum_quantity) ?? []
    : allItems ?? []

  if (category) {
    filteredItems = filteredItems.filter((item) => item.products?.category_id === category)
  }

  return {
    items: filteredItems.slice(from, to),
    total: filteredItems.length,
    page,
    page_size: pageSize
  }
})
