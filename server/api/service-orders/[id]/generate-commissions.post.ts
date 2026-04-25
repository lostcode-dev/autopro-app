import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { resolveOrganizationId } from '../../../utils/organization'
import { generateServiceOrderCommissions } from '../../../utils/service-order-commissions'

/**
 * POST /api/service-orders/:id/generate-commissions
 * Generates/updates commission records from service order items.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId is required' })
  }

  const result = await generateServiceOrderCommissions({
    supabase,
    organizationId,
    orderId,
    userEmail: authUser.email
  })

  return {
    data: result
  }
})
