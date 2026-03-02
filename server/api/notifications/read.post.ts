import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const schema = z.object({
  id: z.coerce.number().int().positive()
})

type NotificationRow = {
  id: number
  user_id: string
  read_at: string | null
}

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload',
      data: parsed.error.flatten()
    })
  }

  const supabase = getSupabaseAdminClient()
  const payload = { read_at: new Date().toISOString() } as unknown as never
  const { data, error } = await supabase
    .from('notifications')
    .update(payload)
    .eq('user_id', user.id)
    .eq('id', parsed.data.id)
    .select('id,user_id,read_at')
    .maybeSingle<NotificationRow>()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update notification'
    })
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Notification not found'
    })
  }

  return { ok: true }
})
