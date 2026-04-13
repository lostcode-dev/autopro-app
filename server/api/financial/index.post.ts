import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/financial
 * Create a new financial transaction.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = await readBody(event)

  if (!body.description) throw createError({ statusCode: 400, statusMessage: 'O campo "description" é obrigatório' })
  if (body.amount == null) throw createError({ statusCode: 400, statusMessage: 'O campo "amount" é obrigatório' })
  if (!body.due_date) throw createError({ statusCode: 400, statusMessage: 'O campo "due_date" é obrigatório' })
  if (!body.type) throw createError({ statusCode: 400, statusMessage: 'O campo "type" é obrigatório' })
  if (!body.category) throw createError({ statusCode: 400, statusMessage: 'O campo "category" é obrigatório' })

  const { data: item, error } = await supabase
    .from('financial_transactions')
    .insert({
      organization_id: organizationId,
      description: body.description,
      amount: body.amount,
      due_date: body.due_date,
      type: body.type,
      status: body.status ?? 'pending',
      category: body.category,
      recurrence: body.recurrence ?? null,
      recurrence_end_date: body.recurrence_end_date ?? null,
      is_installment: body.is_installment ?? false,
      installment_count: body.installment_count ?? null,
      current_installment: body.current_installment ?? null,
      bank_account_id: body.bank_account_id ?? null,
      notes: body.notes ?? null,
      created_by: authUser.email,
      updated_by: authUser.email,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return item
})
