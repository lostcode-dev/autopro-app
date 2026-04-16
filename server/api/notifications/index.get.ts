import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

type NotificationRow = {
  id: number
  user_id: string
  type: string
  body: string
  link_path: string | null
  channels: string[] | null
  category: string | null
  source: string | null
  sender_name: string
  sender_email: string | null
  sender_avatar_src: string | null
  read_at: string | null
  created_at: string
}

type ApiNotification = {
  id: number
  type: 'system' | 'user'
  unread: boolean
  body: string
  date: string
  linkPath: string | null
  channels?: string[]
  category?: string
  source?: string
  sender: {
    name: string
    email?: string
    avatar?: { src: string }
  }
}

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('id,user_id,type,body,link_path,channels,category,source,sender_name,sender_email,sender_avatar_src,read_at,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch notifications'
    })
  }

  const notifications: ApiNotification[] = (data as NotificationRow[]).map(row => ({
    id: row.id,
    type: row.type === 'user' ? 'user' : 'system',
    unread: row.read_at === null,
    body: row.body,
    date: row.created_at,
    linkPath: row.link_path ?? null,
    ...(row.channels ? { channels: row.channels } : {}),
    ...(row.category ? { category: row.category } : {}),
    ...(row.source ? { source: row.source } : {}),
    sender: {
      name: row.sender_name,
      ...(row.sender_email ? { email: row.sender_email } : {}),
      ...(row.sender_avatar_src ? { avatar: { src: row.sender_avatar_src } } : {})
    }
  }))

  return notifications
})
