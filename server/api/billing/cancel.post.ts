import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { getStripe } from '../../utils/stripe'

type SubscriptionRow = {
  stripe_subscription_id: string
  status: string
  cancel_at_period_end: boolean
}

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id,status,cancel_at_period_end')
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

  if (!data?.stripe_subscription_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Subscription not found'
    })
  }

  const hasActive = data.status === 'active' || data.status === 'trialing'
  if (!hasActive) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Subscription is not active'
    })
  }

  if (data.cancel_at_period_end) {
    return { ok: true, cancelAtPeriodEnd: true }
  }

  const stripe = getStripe()
  const updatedResponse = await stripe.subscriptions.update(data.stripe_subscription_id, {
    cancel_at_period_end: true
  })

  const updated = (updatedResponse as any).data ?? updatedResponse

  await (supabase as any)
    .from('subscriptions')
    .update({ cancel_at_period_end: true } as any)
    .eq('stripe_subscription_id', updated.id)

  return { ok: true, cancelAtPeriodEnd: Boolean(updated.cancel_at_period_end) }
})
