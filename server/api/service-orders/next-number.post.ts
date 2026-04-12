import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/service-orders/next-number
 * Calculates the next service order number.
 * Migrated from: supabase/functions/getNextOSNumber
 */

const DEFAULT_START_NUMBER = 4000
const VALID_OS_NUMBER_REGEX = /^OS(\d{4,})$/i

function extractOsNumericPart(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  let cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.startsWith('OS')) {
    cleaned = cleaned.slice(2)
  }
  if (!/^\d{4,}$/.test(cleaned)) return null
  const numeric = Number(cleaned)
  return Number.isFinite(numeric) ? numeric : null
}

export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const { data: orders } = await supabase
    .from('service_orders')
    .select('number')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)

  let highest: number | null = null
  for (const order of orders || []) {
    const raw = String(order.number || '').trim()
    const strictMatch = raw.match(VALID_OS_NUMBER_REGEX)
    const numericPart = strictMatch ? Number(strictMatch[1]) : extractOsNumericPart(raw)
    if (!Number.isFinite(numericPart)) continue
    highest = highest === null ? numericPart! : Math.max(highest, numericPart!)
  }

  const nextNumber = highest === null ? DEFAULT_START_NUMBER : highest + 1

  return {
    next_number: nextNumber,
    next_os_number: `OS${nextNumber}`,
    organization_id: organizationId
  }
})
