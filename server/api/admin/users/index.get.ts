import { defineEventHandler, getQuery } from 'h3'
import { requireOwner } from '../../../utils/require-owner'
import { getSupabaseAdminClient } from '../../../utils/supabase'

/**
 * GET /api/admin/users
 * Lists all user profiles for platform-owner view.
 * Restricted to users with is_owner = true.
 *
 * Query params:
 *   page      — page number (1-based, default 1)
 *   page_size — items per page (default 30, max 100)
 *   search    — filter by display_name or email
 *   is_active — filter by active status ("true" | "false")
 */
export default defineEventHandler(async (event) => {
  await requireOwner(event)

  const supabase = getSupabaseAdminClient()
  const query = getQuery(event)

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.max(1, Math.min(Number(query.page_size) || 30, 100))
  const offset = (page - 1) * pageSize
  const search = String(query.search || '').trim()
  const isActiveFilter = query.is_active !== undefined ? query.is_active === 'true' : null

  let dbQuery = supabase
    .from('user_profiles')
    .select('id, user_id, email, display_name, organization_id, is_active, is_owner, created_at', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (isActiveFilter !== null) {
    dbQuery = dbQuery.eq('is_active', isActiveFilter)
  }

  if (search) {
    dbQuery = dbQuery.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
  }

  const { data, error, count } = await dbQuery

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao listar usuários' })
  }

  const orgIds = [...new Set((data || []).map((u: { organization_id: string | null }) => u.organization_id).filter(Boolean))]
  const orgNameMap: Record<string, string> = {}

  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds)

    for (const org of orgs || []) {
      orgNameMap[org.id] = org.name || '—'
    }
  }

  const items = (data || []).map((u: Record<string, unknown>) => ({
    ...u,
    organization_name: u.organization_id ? (orgNameMap[u.organization_id as string] ?? '—') : '—'
  }))

  return { items, total: count ?? items.length, page, page_size: pageSize }
})
