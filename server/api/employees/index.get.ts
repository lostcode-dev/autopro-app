import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * GET /api/employees
 * Lists employees with optional search and termination filters.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)
  const search = query.search ? String(query.search).trim() : ''
  const includeTerminated = query.include_terminated === 'true'

  let dbQuery = supabase
    .from('employees')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (!includeTerminated) {
    dbQuery = dbQuery.or('termination_date.is.null,termination_date.gt.now()')
  }

  if (search) {
    dbQuery = dbQuery.or(`name.ilike.%${search}%,tax_id.ilike.%${search}%`)
  }

  dbQuery = dbQuery.order('name', { ascending: true })

  const { data, error } = await dbQuery

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to fetch employees: ${error.message}` })
  }

  return { items: data || [] }
})
