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

  const body = await readBody(event)

  const allowedFields = [
    'name',
    'business_type',
    'person_type',
    'tax_id',
    'state_registration',
    'phone',
    'whatsapp',
    'email',
    'website',
    'logo_url',
    'zip_code',
    'street',
    'address_number',
    'address_complement',
    'neighborhood',
    'city',
    'state',
    'municipality_code',
    'initial_service_order_number',
    'notes',
  ]

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  updates.updated_by = authUser.email

  const { data: organization, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', organizationId)
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return organization
})
