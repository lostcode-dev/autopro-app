import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { mapGoalTask } from '../../../utils/goals'

const paramsSchema = z.object({
  id: z.string().uuid()
})

const bodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  completed: z.boolean().optional()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id: taskId } = paramsSchema.parse(getRouterParams(event))
  const body = await readBody(event)
  const parsed = bodySchema.parse(body)

  const supabase = getSupabaseAdminClient()

  // Verify task ownership via goal
  const { data: task, error: taskError } = await supabase
    .from('goal_tasks')
    .select('id, goal_id, goals!inner(user_id)')
    .eq('id', taskId)
    .single()

  if (taskError || !task) {
    throw createError({ statusCode: 404, statusMessage: 'Tarefa não encontrada' })
  }

  const goalData = (task as Record<string, unknown>).goals as Record<string, unknown>
  if (goalData.user_id !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Acesso negado' })
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (parsed.title !== undefined) updateData.title = parsed.title
  if (parsed.description !== undefined) updateData.description = parsed.description
  if (parsed.completed !== undefined) updateData.completed = parsed.completed

  const { data, error } = await supabase
    .from('goal_tasks')
    .update(updateData)
    .eq('id', taskId)
    .select('*')
    .single()

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao atualizar tarefa', data: error?.message })
  }

  return mapGoalTask(data as Record<string, unknown>)
})
