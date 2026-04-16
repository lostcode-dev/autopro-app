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
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('user_preferences')
    .select('primary_color, neutral_color, color_mode, timezone')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch user preferences'
    })
  }

  return {
    ...DEFAULT_PREFERENCES,
    ...(data ?? {})
  }
})
