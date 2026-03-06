import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const querySchema = z.object({
  weekKey: z.string().regex(/^\d{4}-W\d{2}$/, 'Formato deve ser YYYY-Wnn').optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional()
})

function mapReflection(row: any) {
  if (!row) return row
  return {
    id: row.id,
    userId: row.userId ?? row.user_id,
    weekKey: row.weekKey ?? row.week_key,
    wins: row.wins ?? null,
    improvements: row.improvements ?? null,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at
  }
}

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const query = getQuery(event)
  const params = querySchema.parse(query)

  const supabase = getSupabaseAdminClient()

  if (params.weekKey) {
    // Get specific reflection
    const { data, error } = await supabase
      .from('habit_reflections')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_key', params.weekKey)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw createError({ statusCode: 500, statusMessage: 'Falha ao buscar reflexão', data: error.message })
    }

    return data ? mapReflection(data) : null
  }

  // Get all reflections paginated
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 12
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error } = await supabase
    .from('habit_reflections')
    .select('*')
    .eq('user_id', user.id)
    .order('week_key', { ascending: false })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao buscar reflexões', data: error.message })
  }

  return (data ?? []).map(mapReflection)
})
