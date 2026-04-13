import { defineEventHandler, createError } from 'h3'
import { requireAuthUser } from '../../utils/require-auth'
import { getSupabaseAdminClient } from '../../utils/supabase'

/**
 * GET /api/admin/stats
 * Global system stats for the admin dashboard.
 * Restricted to NUVEM_FISCAL_OWNER_EMAIL (super admin).
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const ownerEmail = process.env.NUVEM_FISCAL_OWNER_EMAIL
  if (!ownerEmail || user.email !== ownerEmail) {
    throw createError({ statusCode: 403, statusMessage: 'Acesso negado' })
  }

  const supabase = getSupabaseAdminClient()

  const [
    orgsResult,
    usersResult,
    subscriptionsResult,
    serviceOrdersResult
  ] = await Promise.all([
    supabase.from('organizations').select('id, created_at', { count: 'exact', head: false }).is('deleted_at', null),
    supabase.from('user_profiles').select('id', { count: 'exact', head: false }).is('deleted_at', null),
    supabase.from('subscriptions').select('id, status', { count: 'exact', head: false }),
    supabase.from('service_orders').select('id', { count: 'exact', head: false }).is('deleted_at', null)
  ])

  const activeSubscriptions = (subscriptionsResult.data || []).filter(
    (s: any) => s.status === 'active' || s.status === 'trialing'
  ).length

  // Recent orgs (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentOrgs = (orgsResult.data || []).filter(
    (o: any) => o.created_at && new Date(o.created_at) >= thirtyDaysAgo
  ).length

  return {
    total_organizations: orgsResult.count ?? (orgsResult.data || []).length,
    total_users: usersResult.count ?? (usersResult.data || []).length,
    total_subscriptions: subscriptionsResult.count ?? (subscriptionsResult.data || []).length,
    active_subscriptions: activeSubscriptions,
    total_service_orders: serviceOrdersResult.count ?? (serviceOrdersResult.data || []).length,
    new_organizations_last_30_days: recentOrgs
  }
})
