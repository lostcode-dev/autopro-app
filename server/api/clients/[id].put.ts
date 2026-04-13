import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

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
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (findError)
    throw createError({ statusCode: 500, statusMessage: findError.message })

  if (!existing)
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado' })

  const body = await readBody(event)

  const updates: Record<string, unknown> = {
    updated_by: authUser.email,
  }

  const updatableFields = [
    'name', 'phone', 'person_type', 'tax_id', 'email',
    'zip_code', 'street', 'address_number', 'address_complement',
    'neighborhood', 'city', 'state', 'responsible_employees', 'notes',
  ]

  for (const field of updatableFields) {
    if (body[field] !== undefined)
      updates[field] = body[field]
  }

  if (updates.person_type && !['pf', 'pj'].includes(updates.person_type as string))
    throw createError({ statusCode: 400, statusMessage: 'O campo "person_type" deve ser "pf" ou "pj"' })

  const { data: item, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { item }
})
