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
  const pageSize = Math.min(Math.max(1, Number(query.page_size) || 50), 500)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let dbQuery = supabase
    .from('appointments')
    .select('*, clients(id, name), vehicles(id, brand, model, license_plate)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.search) {
    const search = query.search as string
    dbQuery = dbQuery.or(`service_type.ilike.%${search}%,notes.ilike.%${search}%`)
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status as string)
  }

  if (query.client_id) {
    dbQuery = dbQuery.eq('client_id', query.client_id as string)
  }

  if (query.date_from) {
    dbQuery = dbQuery.gte('appointment_date', query.date_from as string)
  }

  if (query.date_to) {
    dbQuery = dbQuery.lte('appointment_date', query.date_to as string)
  }

  dbQuery = dbQuery.order('appointment_date', { ascending: true }).order('time', { ascending: true }).range(from, to)

  const { data: items, count, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items, total: count ?? 0, page, page_size: pageSize }
})
