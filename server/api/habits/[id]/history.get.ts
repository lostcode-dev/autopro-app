import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'

const paramsSchema = z.object({
  id: z.string().uuid()
})

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
})

function mapHistory(row: Record<string, unknown>) {
  return {
    id: row.id,
    habitId: row.habitId ?? row.habit_id,
    userId: row.userId ?? row.user_id,
    field: row.field,
    oldValue: row.oldValue ?? row.old_value ?? null,
    newValue: row.newValue ?? row.new_value ?? null,
    createdAt: row.createdAt ?? row.created_at
  }
}

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id } = paramsSchema.parse(getRouterParams(event))
  const query = getQuery(event)
  const params = querySchema.parse(query)

  const supabase = getSupabaseAdminClient()

  const from = (params.page - 1) * params.pageSize
  const to = from + params.pageSize - 1

  const { data, error } = await supabase
    .from('habit_change_history')
    .select('*', { count: 'exact' })
    .eq('habit_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao buscar histórico', data: error.message })
  }

  return (data ?? []).map(mapHistory)
})
