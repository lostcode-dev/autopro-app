import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * GET /api/suppliers
 * Lists suppliers with optional search, category, and is_active filters.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)
  const search = query.search ? String(query.search).trim() : ''
  const category = query.category ? String(query.category).trim() : ''
  const personType = query.person_type ? String(query.person_type).trim() : ''
  const isActiveRaw = query.is_active !== undefined ? String(query.is_active) : ''
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const ALLOWED_SORT_COLUMNS = [
    'name',
    'trade_name',
    'person_type',
    'tax_id',
    'phone',
    'email',
    'city',
    'is_active',
    'created_at'
  ] as const
  const sortBy = ALLOWED_SORT_COLUMNS.includes(query.sort_by as typeof ALLOWED_SORT_COLUMNS[number])
    ? String(query.sort_by)
    : 'name'
  const sortAscending = String(query.sort_order || 'asc') !== 'desc'

  let dbQuery = supabase
    .from('suppliers')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (search) {
    dbQuery = dbQuery.or(`name.ilike.%${search}%,trade_name.ilike.%${search}%,tax_id.ilike.%${search}%`)
  }

  if (category) {
    dbQuery = dbQuery.eq('category', category)
  }

  if (personType) {
    dbQuery = dbQuery.eq('person_type', personType)
  }

  if (isActiveRaw === 'true') {
    dbQuery = dbQuery.eq('is_active', true)
  } else if (isActiveRaw === 'false') {
    dbQuery = dbQuery.eq('is_active', false)
  }

  dbQuery = dbQuery
    .order(sortBy, { ascending: sortAscending, nullsFirst: false })
    .range(from, to)

  const { data, count, error } = await dbQuery

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to fetch suppliers: ${error.message}` })
  }

  return {
    items: data || [],
    total: count ?? 0,
    page,
    page_size: pageSize
  }
})
