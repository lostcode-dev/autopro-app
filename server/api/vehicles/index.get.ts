import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.max(1, Number(query.page_size) || 50)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let dbQuery = supabase
    .from('vehicles')
    .select('*, clients!client_id(name)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.search) {
    const search = query.search as string
    dbQuery = dbQuery.or(`license_plate.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%,engine.ilike.%${search}%`)
  }

  if (query.client_id) {
    dbQuery = dbQuery.eq('client_id', query.client_id as string)
  }

  const sortBy = query.sort_by as string | undefined
  const sortOrder = query.sort_order as string | undefined
  const sortableColumns = ['license_plate', 'brand', 'model', 'year', 'color']

  if (sortBy && sortableColumns.includes(sortBy)) {
    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder !== 'desc' })
  } else {
    dbQuery = dbQuery
      .order('brand', { ascending: true })
      .order('model', { ascending: true })
  }

  dbQuery = dbQuery.range(from, to)

  const { data: items, count, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items, total: count ?? 0, page, page_size: pageSize }
})
