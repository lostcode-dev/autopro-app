import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { mapGoals } from '../../utils/goals'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  timeCategory: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'long_term']).optional(),
  lifeCategory: z.enum(['personal', 'career', 'health', 'finance', 'spiritual', 'learning', 'relationships', 'lifestyle']).optional(),
  search: z.string().max(200).optional()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const query = getQuery(event)
  const params = querySchema.parse(query)

  const supabase = getSupabaseAdminClient()

  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  let qb = supabase
    .from('goals')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.status) {
    qb = qb.eq('status', params.status)
  } else {
    // Default: exclude archived
    qb = qb.neq('status', 'archived')
  }

  if (params.timeCategory) {
    qb = qb.eq('time_category', params.timeCategory)
  }

  if (params.lifeCategory) {
    qb = qb.eq('life_category', params.lifeCategory)
  }

  if (params.search) {
    qb = qb.ilike('title', `%${params.search}%`)
  }

  const { data, error, count } = await qb

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao buscar metas', data: error.message })
  }

  return {
    data: mapGoals((data ?? []) as Record<string, unknown>[]),
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize
  }
})
