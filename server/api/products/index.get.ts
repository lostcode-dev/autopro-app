import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)
  const search = query.search ? String(query.search).trim() : ''
  const type = query.type ? String(query.type).trim() : ''
  const categoryId = query.category_id ? String(query.category_id).trim() : ''
  const trackInventoryRaw = query.track_inventory !== undefined ? String(query.track_inventory) : ''
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const ALLOWED_SORT_COLUMNS = [
    'name',
    'code',
    'type',
    'track_inventory',
    'unit_sale_price',
    'unit_cost_price',
    'created_at'
  ] as const
  const sortBy = ALLOWED_SORT_COLUMNS.includes(query.sort_by as typeof ALLOWED_SORT_COLUMNS[number])
    ? String(query.sort_by)
    : 'name'
  const sortAscending = String(query.sort_order || 'asc') !== 'desc'

  let dbQuery = supabase
    .from('products')
    .select('*, product_categories(id, name)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (search) {
    const numericSearch = Number(search)
    dbQuery = Number.isSafeInteger(numericSearch) && numericSearch > 0
      ? dbQuery.or(`name.ilike.%${search}%,code.eq.${numericSearch}`)
      : dbQuery.ilike('name', `%${search}%`)
  }

  if (type) {
    dbQuery = dbQuery.eq('type', type)
  }

  if (categoryId) {
    dbQuery = dbQuery.eq('category_id', categoryId)
  }

  if (trackInventoryRaw === 'true') {
    dbQuery = dbQuery.eq('track_inventory', true)
  } else if (trackInventoryRaw === 'false') {
    dbQuery = dbQuery.eq('track_inventory', false)
  }

  const { data: items, count, error } = await dbQuery
    .order(sortBy, { ascending: sortAscending, nullsFirst: false })
    .range(from, to)

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items: items ?? [], total: count ?? 0, page, page_size: pageSize }
})
