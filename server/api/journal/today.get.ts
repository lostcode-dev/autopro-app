import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const today = new Date().toISOString().split('T')[0] ?? ''

  // Try to get today's entry
  const { data: entry } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('entry_date', today)
    .is('archived_at', null)
    .maybeSingle()

  let tags: unknown[] = []
  let metrics: unknown[] = []

  if (entry) {
    const entryObj = entry as Record<string, unknown>
    const entryId = entryObj.id as string

    // Fetch tags
    const { data: tagLinks } = await supabase
      .from('journal_entry_tags')
      .select('tag:journal_tags(*)')
      .eq('entry_id', entryId)

    tags = (tagLinks ?? []).map((l: Record<string, unknown>) => l.tag).filter(Boolean)

    // Fetch metric values
    const { data: metricValues } = await supabase
      .from('metric_values')
      .select('*, definition:metric_definitions(*)')
      .eq('user_id', user.id)
      .eq('entry_date', today)

    metrics = metricValues ?? []
  }

  return {
    entryDate: today,
    entry: entry ? { ...(entry as Record<string, unknown>), tags } : null,
    metrics
  }
})
