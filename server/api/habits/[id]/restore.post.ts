import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { syncHabitLinkedEvent } from '../../../utils/habit-event-sync'

const paramsSchema = z.object({
  id: z.string().uuid()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id } = paramsSchema.parse(getRouterParams(event))

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('habits')
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao restaurar hábito', data: error?.message })
  }

  await syncHabitLinkedEvent(supabase, user.id, data as Record<string, unknown>)

  return { success: true }
})
