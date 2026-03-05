import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'

const paramsSchema = z.object({
  id: z.string().uuid()
})

const bodySchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200)
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id: taskId } = paramsSchema.parse(getRouterParams(event))
  const body = await readBody(event)
  const parsed = bodySchema.parse(body)

  const supabase = getSupabaseAdminClient()

  // Verify task ownership
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('user_id', user.id)
    .single()

  if (taskError || !task) {
    throw createError({ statusCode: 404, statusMessage: 'Tarefa não encontrada' })
  }

  // Get max sort_order
  const { data: existing } = await supabase
    .from('task_subtasks')
    .select('sort_order')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0
    ? ((existing[0] as unknown as Record<string, unknown>).sort_order as number) + 1
    : 0

  const { data, error } = await supabase
    .from('task_subtasks')
    .insert({
      task_id: taskId,
      title: parsed.title,
      sort_order: nextOrder
    })
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao criar subtarefa', data: error.message })
  }

  return data
})
