import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { computeNextOsNumber } from '../../utils/service-order-number'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const { data: existingOrders, error } = await supabase
    .from('service_orders')
    .select('number')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    number: computeNextOsNumber(existingOrders || [])
  }
})
