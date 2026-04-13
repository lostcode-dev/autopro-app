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

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID obrigatório' })

  const { data: existing } = await supabase
    .from('products').select('id').eq('id', id).eq('organization_id', organizationId).is('deleted_at', null).maybeSingle()

  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Registro não encontrado' })

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
    group_items
  } = body

  const { data: item, error } = await supabase
    .from('products')
    .update({
      ...(name !== undefined && { name }),
      ...(code !== undefined && { code }),
      ...(type !== undefined && { type }),
      ...(category_id !== undefined && { category_id }),
      ...(track_inventory !== undefined && { track_inventory }),
      ...(initial_stock_quantity !== undefined && { initial_stock_quantity }),
      ...(notes !== undefined && { notes }),
      ...(unit_sale_price !== undefined && { unit_sale_price }),
      ...(unit_cost_price !== undefined && { unit_cost_price }),
      ...(group_items !== undefined && { group_items }),
      updated_by: authUser.email
    })
    .eq('id', id)
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { item }
})
