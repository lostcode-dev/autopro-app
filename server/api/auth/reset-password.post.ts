import { z } from 'zod'
import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { setAuthCookies } from '../../utils/auth-cookies'
import { setAuthUserCookie, toAuthUser } from '../../utils/auth-user'

const schema = z.object({
  code: z.string().min(1),
  new_password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres')
})

export default eventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados inválidos',
      data: parsed.error.flatten()
    })
  }

  const supabase = getSupabaseAnonClient()

  // Exchange the recovery code for a session
  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(parsed.data.code)

  if (sessionError || !sessionData.session || !sessionData.user) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Link de recuperação inválido ou expirado'
    })
  }

  // Update password using admin client
  const supabaseAdmin = getSupabaseAdminClient()
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    sessionData.user.id,
    { password: parsed.data.new_password }
  )

  if (updateError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Não foi possível redefinir a senha'
    })
  }

  setAuthUserCookie(event, {
    user: toAuthUser(sessionData.user),
    expiresAt: sessionData.session.expires_at ?? null,
    syncedAt: Date.now()
  })

  setAuthCookies(event, sessionData.session)

  return {
    user: toAuthUser(sessionData.user),
    session: { expiresAt: sessionData.session.expires_at ?? null }
  }
})
