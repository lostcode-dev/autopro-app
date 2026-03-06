import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
  difficulty: z.enum(['tiny', 'normal', 'hard']).optional(),
  identityId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  archived: z
    .preprocess((value) => {
      if (value === undefined) return undefined
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true
        if (['false', '0', 'no', 'off'].includes(normalized)) return false
      }
      return value
    }, z.boolean())
    .default(false)
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const query = getQuery(event)
  const params = querySchema.parse(query)

  const supabase = getSupabaseAdminClient()

  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  let qb = supabase
    .from('habits')
    .select('*, identity:identities(*), streak:habit_streaks(*)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.archived) {
    qb = qb.not('archived_at', 'is', null)
  } else {
    qb = qb.is('archived_at', null)
  }

  if (params.frequency) {
    qb = qb.eq('frequency', params.frequency)
  }

  if (params.difficulty) {
    qb = qb.eq('difficulty', params.difficulty)
  }

  if (params.identityId) {
    qb = qb.eq('identity_id', params.identityId)
  }

  if (params.search) {
    qb = qb.ilike('name', `%${params.search}%`)
  }

  const { data, error, count } = await qb

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch habits', data: error.message })
  }

  return {
    data: data ?? [],
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize
  }
})
