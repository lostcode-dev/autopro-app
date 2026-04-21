import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { resolveOrganizationId } from '../../../utils/organization'

/**
 * POST /api/financial/categories
 * Create a custom financial category.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = await readBody(event)

  const name = String(body?.name || '').trim()
  const type = String(body?.type || '').trim()

  if (!name) throw createError({ statusCode: 400, statusMessage: 'O campo "name" é obrigatório' })
  if (!['income', 'expense'].includes(type)) throw createError({ statusCode: 400, statusMessage: 'O campo "type" deve ser "income" ou "expense"' })

  const { data: existing } = await supabase
    .from('financial_categories')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', name)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) throw createError({ statusCode: 409, statusMessage: 'Categoria já existe' })

  const { data: category, error } = await supabase
    .from('financial_categories')
    .insert({
      organization_id: organizationId,
      name,
      type,
      created_by: authUser.email
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return category
})
