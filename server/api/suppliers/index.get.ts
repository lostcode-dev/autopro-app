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
  const isActiveRaw = query.is_active !== undefined ? String(query.is_active) : ''

  let dbQuery = supabase
    .from('suppliers')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (search) {
    dbQuery = dbQuery.or(`name.ilike.%${search}%,trade_name.ilike.%${search}%,tax_id.ilike.%${search}%`)
  }

  if (category) {
    dbQuery = dbQuery.eq('category', category)
  }

  if (isActiveRaw === 'true') {
    dbQuery = dbQuery.eq('is_active', true)
  } else if (isActiveRaw === 'false') {
    dbQuery = dbQuery.eq('is_active', false)
  }

  dbQuery = dbQuery.order('name', { ascending: true })

  const { data, error } = await dbQuery

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to fetch suppliers: ${error.message}` })
  }

  return { items: data || [] }
})
