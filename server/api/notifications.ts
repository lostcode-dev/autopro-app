import { z } from 'zod'
import { getQuery } from 'h3'
import { getSupabaseAdminClient } from '../utils/supabase'
import { requireAuthUser } from '../utils/require-auth'

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  unreadOnly: z.preprocess((value) => {
    if (value === undefined) return undefined
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true
      if (['false', '0', 'no', 'off'].includes(normalized)) return false
    }
    return value
  }, z.boolean()).optional()
})

type NotificationRow = {
  id: number
  type: 'user' | 'system'
  sender_name: string | null
  sender_email: string | null
  sender_avatar_url: string | null
  body: string
  link_path: string | null
  read_at: string | null
  created_at: string
}

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)

  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query',
      data: parsed.error.flatten()
    })
  }

  const supabase = getSupabaseAdminClient()
  let builder = supabase
    .from('notifications')
    .select('id,type,sender_name,sender_email,sender_avatar_url,body,link_path,read_at,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.unreadOnly)
    builder = builder.is('read_at', null)

  const { data, error } = await builder.returns<NotificationRow[]>()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load notifications'
    })
  }

  return (data ?? []).map(row => ({
    id: row.id,
    type: row.type,
    unread: !row.read_at,
    body: row.body,
    date: row.created_at,
    linkPath: row.link_path,
    sender: {
      id: 0,
      name: row.sender_name || 'Second Brain',
      email: row.sender_email || '',
      avatar: row.sender_avatar_url ? { src: row.sender_avatar_url } : undefined,
      status: 'subscribed',
      location: ''
    }
  }))
})
