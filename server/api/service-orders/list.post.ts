import { readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/service-orders/list
 * Lists service orders with filters, pagination and search.
 * Migrated from: supabase/functions/listServiceOrders
 */

interface ListRequest {
  cursor?: number
  limit?: number
  searchTerm?: string
  numeroExact?: string
  filters?: {
    status?: string
    client_id?: string
    vehicle_id?: string
    responsible_id?: string
    number?: string
  }
  dateRange?: { from?: string | null; to?: string | null }
  useDateFilter?: boolean
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function safeParseDate(value: unknown) {
  if (!value) return null
  const raw = String(value)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + 'T00:00:00') : new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

export default eventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = (await readBody(event)) as ListRequest

  const cursor = Number.isFinite(body.cursor) ? Number(body.cursor) : 0
  const limitRaw = Number.isFinite(body.limit) ? Number(body.limit) : 20
  const limit = Math.min(Math.max(limitRaw, 5), 50)

  // Fetch base data in parallel
  const [ordersResult, clientsResult, vehiclesResult, employeesResult, masterProductsResult, installmentsResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('vehicles').select('id, brand, model, license_plate').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('employees').select('id, name').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('master_products').select('id, name').eq('organization_id', organizationId).is('deleted_at', null),
    supabase.from('service_order_installments').select('id, service_order_id, status').eq('organization_id', organizationId)
  ])

  const orders = ordersResult.data || []
  const clients = clientsResult.data || []
  const vehicles = vehiclesResult.data || []
  const employees = employeesResult.data || []
  const masterProducts = masterProductsResult.data || []
  const installments = installmentsResult.data || []

  // Build lookup maps
  const clientNameById = new Map(clients.map(c => [c.id, c.name]))
  const vehicleLabelById = new Map(vehicles.map(v => {
    const label = [v.brand, v.model].filter(Boolean).join(' ').trim()
    return [v.id, label ? `${label} - ${v.license_plate || ''}`.trim() : (v.license_plate || '')]
  }))
  const employeeNameById = new Map(employees.map(e => [e.id, e.name]))
  const masterProductNameById = new Map(masterProducts.map(p => [p.id, p.name]))

  const installmentsByOrderId = new Map<string, { paid: number; total: number }>()
  for (const inst of installments) {
    const orderId = inst.service_order_id
    if (!orderId) continue
    const current = installmentsByOrderId.get(orderId) || { paid: 0, total: 0 }
    current.total += 1
    if (String(inst.status).toLowerCase() === 'paid') {
      current.paid += 1
    }
    installmentsByOrderId.set(orderId, current)
  }

  const totalAll = orders.length

  // Apply filters
  const searchTerm = normalizeString(body.searchTerm)
  const numeroExact = body.numeroExact ? String(body.numeroExact).trim() : ''
  const filters = body.filters || {}
  const statusFilter = filters.status || 'all'
  const clientIdFilter = filters.client_id || 'all'
  const vehicleIdFilter = filters.vehicle_id || 'all'
  const responsibleIdFilter = filters.responsible_id || 'all'
  const numberFilter = normalizeString(filters.number)

  const useDateFilter = !!body.useDateFilter
  const dateFrom = safeParseDate(body.dateRange?.from)
  const dateTo = safeParseDate(body.dateRange?.to)

  const filtered = orders.filter((order: any) => {
    if (numeroExact) {
      return normalizeString(order.number) === numeroExact.toLowerCase()
    }

    const number = normalizeString(order.number)
    const clientName = normalizeString(clientNameById.get(order.client_id) || '')

    const searchMatch = !searchTerm || number.includes(searchTerm) || clientName.includes(searchTerm)
    const statusMatch = statusFilter === 'all' || order.status === statusFilter
    const clientMatch = clientIdFilter === 'all' || order.client_id === clientIdFilter
    const vehicleMatch = vehicleIdFilter === 'all' || order.vehicle_id === vehicleIdFilter

    let assigneeMatch = responsibleIdFilter === 'all'
    if (!assigneeMatch) {
      if (Array.isArray(order.responsible_employees)) {
        assigneeMatch = order.responsible_employees.some((a: any) => a?.employee_id === responsibleIdFilter)
      } else if (order.employee_responsible_id) {
        assigneeMatch = order.employee_responsible_id === responsibleIdFilter
      }
    }

    const orderNumberMatch = !numberFilter || number.includes(numberFilter)

    let matchesDate = true
    if (useDateFilter && dateFrom && dateTo) {
      const orderDate = safeParseDate(order.entry_date)
      if (orderDate) {
        const startOfDay = new Date(dateFrom)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(dateTo)
        endOfDay.setHours(23, 59, 59, 999)
        matchesDate = orderDate >= startOfDay && orderDate <= endOfDay
      } else {
        matchesDate = false
      }
    }

    return searchMatch && statusMatch && clientMatch && vehicleMatch && assigneeMatch && orderNumberMatch && matchesDate
  })

  const totalFiltered = filtered.length
  const slice = filtered.slice(cursor, cursor + limit)
  const nextCursor = cursor + slice.length < totalFiltered ? cursor + slice.length : null

  // Check commissions for the current page
  const orderIds = slice.map((o: any) => o.id).filter(Boolean)
  let commissionsMap = new Map<string, boolean>()

  if (orderIds.length > 0) {
    const { data: commissions } = await supabase
      .from('employee_financial_records')
      .select('service_order_id')
      .eq('organization_id', organizationId)
      .eq('record_type', 'commission')
      .in('service_order_id', orderIds)

    const commissionOrderIds = new Set((commissions || []).map(c => c.service_order_id))
    commissionsMap = new Map(orderIds.map(id => [id, commissionOrderIds.has(id)]))
  }

  const items = slice.map((order: any) => {
    const resolvedAssigneeId = order.employee_responsible_id
      || (Array.isArray(order.responsible_employees) && order.responsible_employees.length > 0
        ? order.responsible_employees[0]?.employee_id
        : '')

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      payment_status: order.payment_status,
      is_installment: order.is_installment,
      installment_count: order.installment_count,
      client_id: order.client_id,
      client_name: clientNameById.get(order.client_id) || null,
      vehicle_id: order.vehicle_id,
      vehicle_label: vehicleLabelById.get(order.vehicle_id) || null,
      master_product_id: order.master_product_id,
      master_product_name: masterProductNameById.get(order.master_product_id) || null,
      employee_responsible_id: order.employee_responsible_id,
      responsible_name: resolvedAssigneeId ? employeeNameById.get(resolvedAssigneeId) || null : null,
      responsible_employees: order.responsible_employees || [],
      entry_date: order.entry_date,
      reported_defect: order.reported_defect,
      total_amount: order.total_amount,
      commission_amount: order.commission_amount,
      has_commissions: commissionsMap.get(order.id) || false,
      installments_progress: installmentsByOrderId.get(order.id) || null
    }
  })

  return {
    data: {
      organization_id: organizationId,
      cursor,
      limit,
      nextCursor,
      totalAll,
      totalFiltered,
      items
    }
  }
})
