import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'

const paramsSchema = z.object({
  id: z.string().uuid()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id: subtaskId } = paramsSchema.parse(getRouterParams(event))

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

  const { error } = await supabase
    .from('task_subtasks')
    .delete()
    .eq('id', subtaskId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao excluir subtarefa', data: error.message })
  }

  return { success: true }
})
