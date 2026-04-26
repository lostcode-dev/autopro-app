import { z } from 'zod'
import { getSupabaseAnonClient } from '../../utils/supabase-anon'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { setAuthCookies } from '../../utils/auth-cookies'
import { setAuthUserCookie, toAuthUser } from '../../utils/auth-user'

const schema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
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
  const { data, error } = await supabase.auth.setSession({
    access_token: parsed.data.access_token,
    refresh_token: parsed.data.refresh_token
  })

  if (error || !data.session || !data.user) {
    throw createError({ statusCode: 401, statusMessage: 'Link de recuperação inválido ou expirado' })
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    data.user.id,
    { password: parsed.data.new_password }
  )

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível redefinir a senha' })
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
