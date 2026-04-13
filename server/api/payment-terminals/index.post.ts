import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id')
    .eq('email', authUser.email!).maybeSingle()

  if (!profile?.organization_id)
    throw createError({ statusCode: 403, statusMessage: 'Usuário não vinculado a uma organização' })

  const organizationId = profile.organization_id as string

  const body = await readBody(event)
  const {
    terminal_name,
    provider_company,
    bank_account_id,
    payment_receipt_days,
    is_active,
    rates
  } = body

  if (!terminal_name)
    throw createError({ statusCode: 400, statusMessage: 'terminal_name é obrigatório' })

  const { data: item, error } = await supabase
    .from('payment_terminals')
    .insert({
      organization_id: organizationId,
      terminal_name,
      provider_company,
      bank_account_id,
      payment_receipt_days,
      is_active,
      rates,
      created_by: authUser.email,
      updated_by: authUser.email
    })
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { item }
})
