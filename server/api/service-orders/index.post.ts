import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/service-orders
 * Creates or updates a service order with items and related data.
 */

const DEFAULT_START_OS_NUMBER = 4000
const VALID_OS_NUMBER_REGEX = /^OS(\d{4,})$/i

function normalizeOsNumber(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const match = raw.match(/^\s*(?:OS)?\s*(\d{1,})\s*$/i)
  if (match) return `OS${match[1]}`
  return raw
}

function computeNextOsNumber(orders: { number: string }[]) {
  let highest: number | null = null
  for (const order of orders) {
    const raw = String(order.number || '').trim()
    const match = raw.match(VALID_OS_NUMBER_REGEX)
    if (!match) continue
    const numericPart = Number(match[1])
    if (!Number.isFinite(numericPart)) continue
    highest = highest === null ? numericPart : Math.max(highest, numericPart)
  }
  const next = highest === null ? DEFAULT_START_OS_NUMBER : highest + 1
  return `OS${next}`
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = await readBody(event)
  const orderId = body?.orderId || null
  const orderData = body?.orderData || null
  const appointmentData = body?.appointmentData || null

  if (!orderData) {
    throw createError({ statusCode: 400, statusMessage: 'orderData is required' })
  }

  const warnings: string[] = []
  const isUpdate = !!orderId

  // Normalize OS number
  let osNumber = normalizeOsNumber(orderData.number)

  if (!isUpdate && !osNumber) {
    // Auto-generate number for new orders
    const { data: existingOrders } = await supabase
      .from('service_orders')
      .select('number')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)

    osNumber = computeNextOsNumber(existingOrders || [])
  }

  // Check for duplicate number
  if (osNumber) {
    const duplicateQuery = supabase
      .from('service_orders')
      .select('id, number')
      .eq('organization_id', organizationId)
      .eq('number', osNumber)
      .is('deleted_at', null)

    if (isUpdate) {
      duplicateQuery.neq('id', orderId)
    }

    const { data: duplicates } = await duplicateQuery

    if (duplicates && duplicates.length > 0) {
      const { data: allOrders } = await supabase
        .from('service_orders')
        .select('number')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)

      const suggested = computeNextOsNumber(allOrders || [])
      return {
        duplicateNumber: true,
        currentNumber: osNumber,
        suggestedNumber: suggested
      }
    }
  }

  // Prepare order payload
  const orderPayload: Record<string, unknown> = {
    organization_id: organizationId,
    number: osNumber || orderData.number,
    client_id: orderData.client_id || null,
    vehicle_id: orderData.vehicle_id || null,
    master_product_id: orderData.master_product_id || null,
    employee_responsible_id: orderData.employee_responsible_id || null,
    responsible_employees: orderData.responsible_employees || [],
    appointment_id: orderData.appointment_id || null,
    status: orderData.status || 'open',
    payment_status: orderData.payment_status || 'pending',
    entry_date: orderData.entry_date || new Date().toISOString().split('T')[0],
    expected_date: orderData.expected_date || null,
    expected_payment_date: orderData.expected_payment_date || null,
    completion_date: orderData.completion_date || null,
    reported_defect: orderData.reported_defect || null,
    diagnosis: orderData.diagnosis || null,
    items: orderData.items || [],
    apply_taxes: orderData.apply_taxes || false,
    selected_taxes: orderData.selected_taxes || [],
    total_taxes_amount: orderData.total_taxes_amount || 0,
    total_amount: orderData.total_amount || 0,
    total_cost_amount: orderData.total_cost_amount || 0,
    discount: orderData.discount || 0,
    commission_amount: orderData.commission_amount || 0,
    terminal_fee_amount: orderData.terminal_fee_amount || 0,
    payment_method: orderData.payment_method || null,
    is_installment: orderData.is_installment || false,
    installment_count: orderData.installment_count || 0,
    notes: orderData.notes || null,
    updated_by: authUser.email
  }

  let savedOrder: any

  if (isUpdate) {
    // Update existing order
    const { data, error } = await supabase
      .from('service_orders')
      .update(orderPayload)
      .eq('id', orderId)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Failed to update service order: ${error.message}` })
    }
    savedOrder = data
  } else {
    // Create new order
    orderPayload.created_by = authUser.email

    const { data, error } = await supabase
      .from('service_orders')
      .insert(orderPayload)
      .select()
      .single()

    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Failed to create service order: ${error.message}` })
    }
    savedOrder = data
  }

  // Handle appointment creation if provided
  if (appointmentData && !isUpdate) {
    try {
      const appointmentPayload = {
        organization_id: organizationId,
        client_id: savedOrder.client_id,
        vehicle_id: savedOrder.vehicle_id,
        appointment_date: appointmentData.appointment_date || savedOrder.entry_date,
        time: appointmentData.time || '08:00',
        service_type: appointmentData.service_type || savedOrder.reported_defect || 'Service',
        priority: appointmentData.priority || 'medium',
        status: 'scheduled',
        service_order_id: savedOrder.id,
        notes: appointmentData.notes || null,
        created_by: authUser.email
      }

      const { data: appointment } = await supabase
        .from('appointments')
        .insert(appointmentPayload)
        .select()
        .single()

      if (appointment) {
        // Link appointment to the order
        await supabase
          .from('service_orders')
          .update({ appointment_id: appointment.id })
          .eq('id', savedOrder.id)

        savedOrder.appointment_id = appointment.id
      }
    } catch (err: any) {
      warnings.push(`Failed to create appointment: ${err.message}`)
    }
  }

  return {
    duplicateNumber: false,
    order: savedOrder,
    warnings
  }
})
