import { z } from 'zod'
import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { setAuthCookies } from '../../utils/auth-cookies'

const schema = z.object({
  name: z.string().min(1),
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

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: parsed.data.name
      }
    }
  })

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message
    })
  }

  if (data.session)
    setAuthCookies(event, data.session)

  return {
    user: data.user,
    session: data.session ? { expiresAt: data.session.expires_at } : null
  }
})
