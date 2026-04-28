import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id')
    .eq('email', authUser.email!).maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403, statusMessage: 'Usuário não vinculado a uma organização' })

  const organizationId = profile.organization_id as string

  const { data: product, error } = await supabase
    .from('products')
    .select('code')
    .eq('organization_id', organizationId)
    .order('code', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  const maxCode = Number(product?.code ?? 0)

  return { code: Number.isSafeInteger(maxCode) ? maxCode + 1 : 1 }
})
