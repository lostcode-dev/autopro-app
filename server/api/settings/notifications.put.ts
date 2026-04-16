import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const DEFAULT_NOTIFICATION_PREFERENCES = {
  channel_in_app: true,
  channel_email: true,
  channel_web_push: false,
  channel_mobile_push: false,
  weekly_digest: false,
  product_updates: true,
  important_updates: true,
  web_push_permission: 'default',
  mobile_push_permission: 'default'
} as const

type NotificationPreferencesPayload = typeof DEFAULT_NOTIFICATION_PREFERENCES & {
  habit_reminders?: boolean
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody<Partial<NotificationPreferencesPayload>>(event)
  const supabase = getSupabaseAdminClient()

  const payload = {
    user_id: user.id,
    channel_in_app: body.channel_in_app ?? DEFAULT_NOTIFICATION_PREFERENCES.channel_in_app,
    channel_email: body.channel_email ?? DEFAULT_NOTIFICATION_PREFERENCES.channel_email,
    channel_web_push: body.channel_web_push ?? DEFAULT_NOTIFICATION_PREFERENCES.channel_web_push,
    channel_mobile_push: body.channel_mobile_push ?? DEFAULT_NOTIFICATION_PREFERENCES.channel_mobile_push,
    weekly_digest: body.weekly_digest ?? DEFAULT_NOTIFICATION_PREFERENCES.weekly_digest,
    product_updates: body.product_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.product_updates,
    important_updates: body.important_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.important_updates,
    web_push_permission: body.web_push_permission ?? DEFAULT_NOTIFICATION_PREFERENCES.web_push_permission,
    mobile_push_permission: body.mobile_push_permission ?? DEFAULT_NOTIFICATION_PREFERENCES.mobile_push_permission
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save notification preferences'
    })
  }

  return {
    ...payload,
    habit_reminders: body.habit_reminders ?? true,
    subscriptions: []
  }
})
