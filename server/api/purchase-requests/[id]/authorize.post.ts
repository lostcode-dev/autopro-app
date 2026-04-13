import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'

/**
 * POST /api/purchase-requests/:id/authorize
 * Authorizes a purchase request (status: waiting → authorized).
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('email', authUser.email!)
    .maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403, statusMessage: 'Usuário não vinculado a uma organização' })

  const organizationId = profile.organization_id as string
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID obrigatório' })

  const { data: existing, error: findError } = await supabase
    .from('purchase_requests')
    .select('id, status')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (findError)
    throw createError({ statusCode: 500, statusMessage: findError.message })
  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Solicitação não encontrada' })

  if (existing.status !== 'waiting')
    throw createError({ statusCode: 400, statusMessage: 'Somente solicitações com status "aguardando" podem ser autorizadas' })

  const { data: item, error } = await supabase
    .from('purchase_requests')
    .update({
      status: 'authorized',
      authorization_date: new Date().toISOString(),
      authorized_by: authUser.email,
      updated_by: authUser.email
    })
    .eq('id', id)
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { item }
})
