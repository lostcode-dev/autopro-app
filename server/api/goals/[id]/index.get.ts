import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { mapGoal } from '../../../utils/goals'

const paramsSchema = z.object({
  id: z.string().uuid()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id } = paramsSchema.parse(getRouterParams(event))

  const supabase = getSupabaseAdminClient()

  // Fetch goal
  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (goalError || !goal) {
    throw createError({ statusCode: 404, statusMessage: 'Meta não encontrada' })
  }

  // Fetch tasks
  const { data: tasks } = await supabase
    .from('goal_tasks')
    .select('*')
    .eq('goal_id', id)
    .order('sort_order', { ascending: true })

  // Fetch habit links with habit names
  const { data: habitLinks } = await supabase
    .from('goal_habits')
    .select('*, habit:habits(name)')
    .eq('goal_id', id)

  return mapGoal({
    ...goal,
    tasks: tasks ?? [],
    habitLinks: (habitLinks ?? []).map((link: Record<string, unknown>) => ({
      ...link,
      habitName: (link.habit as Record<string, unknown> | null)?.name ?? null
    }))
  } as Record<string, unknown>)
})
