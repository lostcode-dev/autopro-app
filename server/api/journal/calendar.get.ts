import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const query = getQuery(event) as { from?: string, to?: string }

  const supabase = getSupabaseAdminClient()

  let queryBuilder = supabase
    .from('journal_entries')
    .select('entry_date')
    .eq('user_id', user.id)
    .is('archived_at', null)

  if (query.from) {
    queryBuilder = queryBuilder.gte('entry_date', query.from)
  }
  if (query.to) {
    queryBuilder = queryBuilder.lte('entry_date', query.to)
  }

  const { data, error } = await queryBuilder

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  // Return array of dates that have entries
  return (data ?? []).map((e: Record<string, unknown>) => e.entry_date as string)
})
