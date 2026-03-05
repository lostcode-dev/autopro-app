import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tag: z.string().optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const query = getQuery(event)
  const params = querySchema.parse(query)

  const supabase = getSupabaseAdminClient()
  const { page, pageSize } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let queryBuilder = supabase
    .from('journal_entries')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .is('archived_at', null)
    .order('entry_date', { ascending: false })

  if (params.from) {
    queryBuilder = queryBuilder.gte('entry_date', params.from)
  }
  if (params.to) {
    queryBuilder = queryBuilder.lte('entry_date', params.to)
  }
  if (params.q) {
    queryBuilder = queryBuilder.or(`title.ilike.%${params.q}%,content.ilike.%${params.q}%`)
  }

  queryBuilder = queryBuilder.range(from, to)

  const { data, count, error } = await queryBuilder

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  // If tag filter, further filter by tag association (entry ids)
  let filtered = data ?? []
  if (params.tag) {
    const entryIds = filtered.map((e: Record<string, unknown>) => e.id as string)
    if (entryIds.length > 0) {
      const { data: tagLinks } = await supabase
        .from('journal_entry_tags')
        .select('entry_id, tag:journal_tags!inner(name)')
        .in('entry_id', entryIds)
        .eq('tag.name', params.tag)

      const matchedIds = new Set(
        (tagLinks ?? []).map((l: Record<string, unknown>) => l.entry_id as string)
      )
      filtered = filtered.filter((e: Record<string, unknown>) => matchedIds.has(e.id as string))
    }
  }

  return {
    data: filtered,
    total: count ?? 0,
    page,
    pageSize
  }
})
