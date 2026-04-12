import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * GET /api/service-orders/:id
 * Fetches full service order details with related data.
 */
export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const orderId = getRouterParam(event, 'id')

  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'orderId is required' })
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
    throw createError({ statusCode: 404, statusMessage: 'Service order not found' })
  }

  // Fetch related data in parallel
  const [clientResult, vehicleResult, employeesResult, installmentsResult, commissionsResult, editLogsResult] = await Promise.all([
    order.client_id
      ? supabase.from('clients').select('*').eq('id', order.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    order.vehicle_id
      ? supabase.from('vehicles').select('*').eq('id', order.vehicle_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('service_order_installments').select('*').eq('service_order_id', orderId).eq('organization_id', organizationId),
    supabase.from('employee_financial_records').select('*').eq('service_order_id', orderId).eq('organization_id', organizationId).eq('record_type', 'commission'),
    supabase.from('service_order_edit_logs').select('*').eq('service_order_id', orderId).order('created_at', { ascending: false })
  ])

  // Build employee name map
  const employeeNameById = new Map((employeesResult.data || []).map((e: any) => [e.id, e.name]))

  // Resolve responsible employee names
  const responsibleNames = (order.responsible_employees || []).map((r: any) => ({
    employee_id: r.employee_id,
    name: employeeNameById.get(r.employee_id) || null
  }))

  return {
    data: {
      order,
      client: clientResult.data,
      vehicle: vehicleResult.data,
      employees: employeesResult.data || [],
      installments: installmentsResult.data || [],
      commissions: commissionsResult.data || [],
      editLogs: editLogsResult.data || [],
      responsibleNames
    }
  }
})
