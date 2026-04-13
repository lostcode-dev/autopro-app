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

  const query = getQuery(event)
  const isActiveParam = query.is_active as string | undefined

  let dbQuery = supabase
    .from('bank_accounts')
    .select('*')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (isActiveParam === 'true') dbQuery = dbQuery.eq('is_active', true)
  else if (isActiveParam === 'false') dbQuery = dbQuery.eq('is_active', false)

  const { data: items, error } = await dbQuery.order('account_name', { ascending: true })

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { items }
})
