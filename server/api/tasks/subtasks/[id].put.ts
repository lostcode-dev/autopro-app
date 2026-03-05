import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'

const paramsSchema = z.object({
  id: z.string().uuid()
})

const bodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  completed: z.boolean().optional()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id: subtaskId } = paramsSchema.parse(getRouterParams(event))
  const body = await readBody(event)
  const parsed = bodySchema.parse(body)

  const supabase = getSupabaseAdminClient()

  // Verify ownership via task
  const { data: subtask, error: subtaskError } = await supabase
    .from('task_subtasks')
    .select('id, task_id, tasks!inner(user_id)')
    .eq('id', subtaskId)
    .single()

  if (subtaskError || !subtask) {
    throw createError({ statusCode: 404, statusMessage: 'Subtarefa não encontrada' })
  }

  const taskData = (subtask as Record<string, unknown>).tasks as Record<string, unknown>
  if (taskData.user_id !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Acesso negado' })
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.title !== undefined) updateData.title = parsed.title
  if (parsed.completed !== undefined) updateData.completed = parsed.completed

  const { data, error } = await supabase
    .from('task_subtasks')
    .update(updateData)
    .eq('id', subtaskId)
    .select('*')
    .single()

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao atualizar subtarefa', data: error?.message })
  }

  return data
})
