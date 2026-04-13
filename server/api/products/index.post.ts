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
    name,
    code,
    type,
    category_id,
    track_inventory,
    initial_stock_quantity,
    notes,
    unit_sale_price,
    unit_cost_price,
    group_items,
  } = body

  if (!name || !code || !type)
    throw createError({ statusCode: 400, statusMessage: 'name, code e type são obrigatórios' })

  const { data: item, error } = await supabase
    .from('products')
    .insert({
      organization_id: organizationId,
      name,
      code,
      type,
      category_id,
      track_inventory,
      initial_stock_quantity,
      notes,
      unit_sale_price,
      unit_cost_price,
      group_items,
      created_by: authUser.email,
      updated_by: authUser.email,
    })
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { item }
})
