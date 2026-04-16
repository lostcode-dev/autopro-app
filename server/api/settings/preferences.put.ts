import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const DEFAULT_PREFERENCES = {
  primary_color: 'purple',
  neutral_color: 'slate',
  color_mode: 'light',
  timezone: 'UTC'
} as const

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody<Partial<typeof DEFAULT_PREFERENCES>>(event)
  const supabase = getSupabaseAdminClient()

  const payload = {
    user_id: user.id,
    primary_color: body.primary_color || DEFAULT_PREFERENCES.primary_color,
    neutral_color: body.neutral_color || DEFAULT_PREFERENCES.neutral_color,
    color_mode: body.color_mode || DEFAULT_PREFERENCES.color_mode,
    timezone: body.timezone || DEFAULT_PREFERENCES.timezone
  }

  const { error } = await supabase
    .from('user_preferences')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save user preferences'
    })
  }

  return payload
})
