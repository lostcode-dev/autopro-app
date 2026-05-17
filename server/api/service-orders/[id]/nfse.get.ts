import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { resolveOrganizationId } from '../../../utils/organization'

/**
 * GET /api/service-orders/:id/nfse
 * Returns NFS-e records for a specific service order (scoped to org).
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const orderId = getRouterParam(event, 'id')
  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId is required' })
  }

  // Verify the service order belongs to this org
  const { data: order, error: orderError } = await supabase
    .from('service_orders')
    .select('id')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .maybeSingle()

  if (orderError || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Service order not found' })
  }

  const { data, error } = await supabase
    .from('service_order_nfse')
    .select(
      'id, service_order_id, organization_id, status, service_order_number, provider_nfse_id, provider_status, nfse_number, verification_code, issued_at, environment, provider_reference, dps_series, dps_number, document_url, last_error_message, last_error_at, created_at, updated_at'
    )
    .eq('service_order_id', orderId)
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Erro ao buscar NFSe' })
  }

  return { success: true, data: data ?? [] }
})
