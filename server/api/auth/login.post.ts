import { z } from 'zod'
import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { setAuthCookies } from '../../utils/auth-cookies'
import { setAuthUserCookie, toAuthUser } from '../../utils/auth-user'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember: z.boolean().optional().default(true)
})

export default eventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  console.log('[auth/login] start', {
    email: typeof body?.email === 'string' ? body.email : null,
    remember: typeof body?.remember === 'boolean' ? body.remember : true
  })

  if (!parsed.success) {
    console.log('[auth/login] invalid-payload')
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload',
      data: parsed.error.flatten()
    })
  }

  const supabase = getSupabaseAnonClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  })

  if (error || !data.session || !data.user) {
    console.log('[auth/login] failed', {
      status: typeof error?.status === 'number' ? error.status : null,
      message: error?.message ?? null
    })
    throw createError({
      statusCode: 401,
      statusMessage: error?.message || 'Invalid credentials'
    })
  }

  setAuthCookies(event, data.session, { persistent: parsed.data.remember })

  setAuthUserCookie(event, {
    user: toAuthUser(data.user),
    expiresAt: data.session.expires_at ?? null,
    syncedAt: Date.now()
  }, { persistent: parsed.data.remember })

  console.log('[auth/login] success', {
    userId: data.user.id,
    remember: parsed.data.remember,
    expiresAt: data.session.expires_at ?? null
  })

  return {
    user: toAuthUser(data.user),
    session: { expiresAt: data.session.expires_at ?? null }
  }
})
