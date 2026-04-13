import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * DELETE /api/financial/:id
 * Soft-delete a financial transaction.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const id = getRouterParam(event, 'id')

  const { data: existing } = await supabase
    .from('financial_transactions')
    .select('id')
    .eq('id', id!)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Lançamento não encontrado' })

  const { error } = await supabase
    .from('financial_transactions')
    .update({ deleted_at: new Date().toISOString(), deleted_by: authUser.email })
    .eq('id', id!)
    .eq('organization_id', organizationId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { success: true }
})
