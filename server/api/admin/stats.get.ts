import { defineEventHandler } from 'h3'
import { requireOwner } from '../../utils/require-owner'
import { getSupabaseAdminClient } from '../../utils/supabase'

/**
 * GET /api/admin/stats
 * Global system stats for the admin dashboard.
 * Restricted to users with is_owner = true.
 */
export default defineEventHandler(async (event) => {
  await requireOwner(event)

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
