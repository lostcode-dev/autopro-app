import { createError } from 'h3'
import type { H3Event } from 'h3'
import { requireAuthUser } from './require-auth'
import { getSupabaseAdminClient } from './supabase'
import type { AuthUser } from './auth-user'

/**
 * Requires the authenticated user to have `is_owner = true` in their
 * user_profiles row. Throws 403 otherwise.
 */
export async function requireOwner(event: H3Event): Promise<AuthUser> {
  const user = await requireAuthUser(event)

  const supabase = getSupabaseAdminClient()
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('is_owner')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao verificar permissões do usuário' })
  }

  if (!profile?.is_owner) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  return user
}
