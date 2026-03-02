import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { error, count } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
    .select('id', { count: 'exact', head: true })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update notifications'
    })
  }

  return { ok: true, updated: count ?? 0 }
})
