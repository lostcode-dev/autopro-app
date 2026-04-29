import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const organizationId = await resolveOrganizationId(event, authUser.id)

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
