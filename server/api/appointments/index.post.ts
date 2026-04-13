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

  if (!body.client_id)
    throw createError({ statusCode: 400, statusMessage: 'O campo "client_id" é obrigatório' })
  if (!body.vehicle_id)
    throw createError({ statusCode: 400, statusMessage: 'O campo "vehicle_id" é obrigatório' })
  if (!body.appointment_date)
    throw createError({ statusCode: 400, statusMessage: 'O campo "appointment_date" é obrigatório' })
  if (!body.time)
    throw createError({ statusCode: 400, statusMessage: 'O campo "time" é obrigatório' })
  if (!body.service_type)
    throw createError({ statusCode: 400, statusMessage: 'O campo "service_type" é obrigatório' })

  const { data: item, error } = await supabase
    .from('appointments')
    .insert({
      organization_id: organizationId,
      client_id: body.client_id,
      vehicle_id: body.vehicle_id,
      appointment_date: body.appointment_date,
      time: body.time,
      service_type: body.service_type,
      priority: body.priority ?? null,
      status: body.status ?? 'scheduled',
      service_order_id: body.service_order_id ?? null,
      notes: body.notes ?? null,
      created_by: authUser.email,
      updated_by: authUser.email
    })
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { item }
})
