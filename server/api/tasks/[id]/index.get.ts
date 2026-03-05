import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'

const paramsSchema = z.object({
  id: z.string().uuid()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id } = paramsSchema.parse(getRouterParams(event))

  const supabase = getSupabaseAdminClient()

  // Fetch task
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*, list:task_lists(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (taskError || !task) {
    throw createError({ statusCode: 404, statusMessage: 'Tarefa não encontrada' })
  }

  // Fetch subtasks
  const { data: subtasks } = await supabase
    .from('task_subtasks')
    .select('*')
    .eq('task_id', id)
    .order('sort_order', { ascending: true })

  // Fetch tags via links
  const { data: tagLinks } = await supabase
    .from('task_tag_links')
    .select('tag_id, tag:task_tags(*)')
    .eq('task_id', id)

  const tags = (tagLinks ?? []).map((link: Record<string, unknown>) => link.tag).filter(Boolean)

  const taskObj = task as Record<string, unknown>

  return {
    ...taskObj,
    subtasks: subtasks ?? [],
    tags
  }
})
