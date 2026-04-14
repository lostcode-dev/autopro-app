import { z } from 'zod'
import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { getRequestURL } from 'h3'

const schema = z.object({
  email: z.string().email()
})

export default eventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email inválido'
    })
  }

  const origin = getRequestURL(event).origin
  const redirectTo = `${origin}/reset-password`

  const supabase = getSupabaseAnonClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo
  })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Não foi possível enviar o email de recuperação'
    })
  }

  // Always return success to avoid email enumeration
  return { ok: true }
})
