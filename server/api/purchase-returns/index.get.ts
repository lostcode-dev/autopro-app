import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)
  const query = getQuery(event)

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.page_size) || 30))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const ALLOWED_SORT_COLUMNS = ['return_date', 'reason', 'total_returned_amount', 'status', 'created_at'] as const
  const sortBy = ALLOWED_SORT_COLUMNS.includes(query.sort_by as typeof ALLOWED_SORT_COLUMNS[number])
    ? String(query.sort_by)
    : 'return_date'
  const sortAscending = String(query.sort_order || 'desc') !== 'desc'

  let dbQuery = supabase
    .from('purchase_returns')
    .select('*, suppliers(id, name), purchases(id, purchase_date, invoice_number)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (query.search) {
    const search = String(query.search).trim()

    if (search) {
      const escapedSearch = search.replace(/[%_,()]/g, '')
      const notesFilter = `notes.ilike.%${escapedSearch}%`
      const orFilters = [notesFilter]

      const [{ data: suppliers }, { data: purchases }] = await Promise.all([
        supabase
          .from('suppliers')
          .select('id')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .ilike('name', `%${escapedSearch}%`),
        supabase
          .from('purchases')
          .select('id')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)
          .ilike('invoice_number', `%${escapedSearch}%`)
      ])

      const supplierIds = (suppliers ?? []).map(item => item.id).filter(Boolean)
      const purchaseIds = (purchases ?? []).map(item => item.id).filter(Boolean)

      if (supplierIds.length)
        orFilters.push(`supplier_id.in.(${supplierIds.join(',')})`)

      if (purchaseIds.length)
        orFilters.push(`purchase_id.in.(${purchaseIds.join(',')})`)

      dbQuery = dbQuery.or(orFilters.join(','))
    }
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status as string)
  }

  if (query.reason) {
    dbQuery = dbQuery.eq('reason', query.reason as string)
  }

  if (query.supplier_id) {
    dbQuery = dbQuery.eq('supplier_id', query.supplier_id as string)
  }

  dbQuery = dbQuery
    .order(sortBy, { ascending: sortAscending, nullsFirst: false })
    .range(from, to)

  const { data: items, count, error } = await dbQuery

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items, total: count ?? 0, page, page_size: pageSize }
})
