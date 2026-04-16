import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const DEFAULT_NOTIFICATION_PREFERENCES = {
  channel_in_app: true,
  channel_email: true,
  channel_web_push: false,
  channel_mobile_push: false,
  habit_reminders: true,
  weekly_digest: false,
  product_updates: true,
  important_updates: true,
  web_push_permission: 'default',
  mobile_push_permission: 'default'
} as const

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('channel_in_app, channel_email, channel_web_push, channel_mobile_push, weekly_digest, product_updates, important_updates, web_push_permission, mobile_push_permission')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch notification preferences'
    })
  }

  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(data ?? {}),
    subscriptions: []
  }
})
