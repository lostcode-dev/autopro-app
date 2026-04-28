import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

function extractProductCodeNumber(code: unknown) {
  if (typeof code !== 'string')
    return null

  const trimmed = code.trim()
  if (!trimmed)
    return null

  if (!/^\d+$/.test(trimmed))
    return null

  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id')
    .eq('email', authUser.email!).maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403, statusMessage: 'Usuário não vinculado a uma organização' })

  const organizationId = profile.organization_id as string

  const { data: products, error } = await supabase
    .from('products')
    .select('code')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .range(0, 9999)

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  const maxCode = (products ?? []).reduce((max, product) => {
    const codeNumber = extractProductCodeNumber(product.code)
    return codeNumber && codeNumber > max ? codeNumber : max
  }, 0)

  return { code: String(maxCode + 1) }
})
