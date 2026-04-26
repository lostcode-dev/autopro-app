import { z } from 'zod'
import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { setAuthCookies } from '../../utils/auth-cookies'
import { setAuthUserCookie, toAuthUser } from '../../utils/auth-user'

const schema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1)
})

export default eventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos' })
  }

  const supabase = getSupabaseAnonClient()
  const { data, error } = await supabase.auth.setSession({
    access_token: parsed.data.access_token,
    refresh_token: parsed.data.refresh_token
  })

  if (error || !data.session || !data.user) {
    throw createError({ statusCode: 401, statusMessage: 'Sessão inválida ou expirada' })
  }

  setAuthUserCookie(event, {
    user: toAuthUser(data.user),
    expiresAt: data.session.expires_at ?? null,
    syncedAt: Date.now()
  })
  setAuthCookies(event, data.session)

  return {
    user: toAuthUser(data.user),
    session: { expiresAt: data.session.expires_at ?? null }
  }
})
