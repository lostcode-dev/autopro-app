import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getSupabaseAdminClient } from '../../../../utils/supabase'
import { requireAuthUser } from '../../../../utils/require-auth'
import { resolveOrganizationId } from '../../../../utils/organization'

/**
 * POST /api/reports/commissions/:id/pay
 * Mark a single employee_financial_record (commission) as paid.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const id = getRouterParam(event, 'id')

  const { data: existing } = await supabase
    .from('employee_financial_records')
    .select('id, status')
    .eq('id', id!)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Comissão não encontrada' })
  if (existing.status === 'paid') throw createError({ statusCode: 400, statusMessage: 'Comissão já está marcada como paga' })

  const today = new Date().toISOString().split('T')[0]

  const { data: item, error } = await supabase
    .from('employee_financial_records')
    .update({ status: 'paid', payment_date: today, updated_at: new Date().toISOString() })
    .eq('id', id!)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { success: true, data: item }
})
