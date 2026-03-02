import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

type SubscriptionRow = {
  status: string
  price_id: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
}

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, price_id, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .order('current_period_end', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load subscription'
    })
  }

  const status = data?.status ?? null
  const hasAccess = status === 'active' || status === 'trialing'

  return {
    hasAccess,
    subscription: data ?? null
  }
})
