import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { count: unreadCount, error: unreadCountError } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (unreadCountError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to count notifications'
    })
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update notifications'
    })
  }

  return { ok: true, updated: unreadCount ?? 0 }
})
