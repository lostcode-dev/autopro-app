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
    product_id,
    code,
    description,
    stock_quantity = 0,
    sale_price = 0,
    brand,
    category,
    minimum_quantity,
    cost_price,
    supplier_name,
    location,
    notes,
  } = body

  if (!code || !description)
    throw createError({ statusCode: 400, statusMessage: 'code e description são obrigatórios' })

  const { data: item, error } = await supabase
    .from('parts')
    .insert({
      organization_id: organizationId,
      product_id,
      code,
      description,
      stock_quantity,
      sale_price,
      brand,
      category,
      minimum_quantity,
      cost_price,
      supplier_name,
      location,
      notes,
      created_by: authUser.email,
      updated_by: authUser.email,
    })
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return { item }
})
