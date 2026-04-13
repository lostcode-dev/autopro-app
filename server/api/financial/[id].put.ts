import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * PUT /api/financial/:id
 * Update a financial transaction.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const { data: existing } = await supabase
    .from('financial_transactions')
    .select('id')
    .eq('id', id!)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Lançamento não encontrado' })

  const updates: Record<string, any> = { updated_by: authUser.email }
  const allowed = ['description', 'amount', 'due_date', 'type', 'status', 'category', 'recurrence', 'recurrence_end_date', 'is_installment', 'installment_count', 'current_installment', 'bank_account_id', 'notes']
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data: item, error } = await supabase
    .from('financial_transactions')
    .update(updates)
    .eq('id', id!)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return item
})
