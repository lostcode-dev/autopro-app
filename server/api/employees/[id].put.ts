import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * PUT /api/employees/:id
 * Updates an existing employee record.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Employee id is required' })
  }

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('employees')
    .select('id')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError || !existing) {
    throw createError({ statusCode: 404, statusMessage: 'Employee not found or access denied' })
  }

  const body = await readBody(event)

  const UPDATABLE_FIELDS = [
    'name', 'person_type', 'tax_id', 'phone', 'email',
    'zip_code', 'street', 'address_number', 'address_complement',
    'neighborhood', 'city', 'state',
    'has_salary', 'salary_amount', 'payment_day', 'salary_installments',
    'has_commission', 'commission_type', 'commission_amount', 'commission_base',
    'commission_categories', 'has_minimum_guarantee', 'minimum_guarantee_amount',
    'minimum_guarantee_installments', 'pix_key_type', 'pix_key',
    'termination_date', 'termination_reason',
  ] as const

  const updates: Record<string, unknown> = { updated_by: authUser.email }

  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: `Failed to update employee: ${error.message}` })
  }

  return { item: data }
})
