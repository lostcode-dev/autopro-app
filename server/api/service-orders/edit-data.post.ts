import { readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/service-orders/edit-data
 * Fetches all data needed for editing a service order.
 * Migrated from: supabase/functions/getServiceOrderEditData
 */
export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = await readBody(event)
  const orderId = body?.orderId

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId é obrigatório' })
  }

  // Fetch order and verify organization
  const { data: order, error: orderError } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (orderError || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Ordem de serviço não encontrada' })
  }

  // Fetch all reference data needed for the edit form
  const [clientsResult, vehiclesResult, employeesResult, productsResult, masterProductsResult, categoriesResult, taxesResult, terminalsResult] = await Promise.all([
    supabase.from('clients').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('name'),
    supabase.from('vehicles').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('name'),
    supabase.from('products').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('name'),
    supabase.from('master_products').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('product_categories').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('taxes').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('payment_terminals').select('*').eq('organization_id', organizationId).is('deleted_at', null)
  ])

  // Filter vehicles for the order's client
  const clientVehicles = order.client_id
    ? (vehiclesResult.data || []).filter((v: any) => v.client_id === order.client_id)
    : vehiclesResult.data || []

  return {
    data: {
      order,
      clients: clientsResult.data || [],
      vehicles: clientVehicles,
      allVehicles: vehiclesResult.data || [],
      employees: employeesResult.data || [],
      products: productsResult.data || [],
      masterProducts: masterProductsResult.data || [],
      categories: categoriesResult.data || [],
      taxes: taxesResult.data || [],
      paymentTerminals: terminalsResult.data || []
    }
  }
})
