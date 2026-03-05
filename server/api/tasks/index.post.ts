import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const bodySchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  listId: z.string().uuid().optional(),
  dueDate: z.string().optional()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody(event)
  const parsed = bodySchema.parse(body)

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      title: parsed.title,
      description: parsed.description ?? null,
      priority: parsed.priority,
      list_id: parsed.listId ?? null,
      due_date: parsed.dueDate ?? null,
      status: 'pending'
    })
    .select('*, list:task_lists(*)')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao criar tarefa', data: error.message })
  }

  return data
})
