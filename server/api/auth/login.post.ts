import { z } from 'zod'
import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { setAuthCookies } from '../../utils/auth-cookies'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default eventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
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
    throw createError({
      statusCode: 401,
      statusMessage: error?.message || 'Invalid credentials'
    })
  }

  setAuthCookies(event, data.session)

  return {
    user: data.user,
    session: { expiresAt: data.session.expires_at }
  }
})
