import { readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

/**
 * POST /api/users/get-by-email
 * Returns the user_id for a given email address.
 * Migrated from: supabase/functions/getUserIdByEmail
 */
export default eventHandler(async (event) => {
  await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const body = await readBody(event)
  const { email } = body || {}

  if (!email || typeof email !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'email é obrigatório' })
  }

  const { data: user } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()

  return { user_id: user?.id ?? null }
})
