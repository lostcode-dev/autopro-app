import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { parseDateStart, parseDateEnd, toNumber, qArr, paginate, sortFactor, normalizeReportStatus } from '../../utils/report-helpers'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)

  const dateFrom = parseDateStart(query.dateFrom as string)
  const dateTo = parseDateEnd(query.dateTo as string)
  const employeeIds = qArr(query.employeeIds)
  const employeeId = query.employeeId && query.employeeId !== 'all' ? String(query.employeeId) : null
  const status = query.status && query.status !== 'all' ? normalizeReportStatus(query.status) : null
  const orderStatusFilters = qArr(query.orderStatusFilters)
  const paymentStatusFilters = qArr(query.paymentStatusFilters)
  const paymentMethods = qArr(query.paymentMethods)
  const recordType = query.recordType && query.recordType !== 'all' ? String(query.recordType) : null
  const searchTerm = String(query.searchTerm || '').trim().toLowerCase()
  const sortBy = ['employee', 'date', 'amount', 'status'].includes(query.sortBy as string) ? String(query.sortBy) : 'date'
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(query.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(query.pageSize, 10))))

  const [recordsResult, ordersResult, employeesResult] = await Promise.all([
    supabase.from('employee_financial_records').select('*').eq('organization_id', organizationId).order('reference_date', { ascending: false }),
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null)
  ])

  const records = recordsResult.data || []
  const orders = ordersResult.data || []
  const employees = employeesResult.data || []

  const employeesMap = new Map<string, any>(employees.map((e: any) => [String(e.id), e]))
  const ordersMap = new Map<string, any>(orders.map((o: any) => [String(o.id), o]))

  const filteredRecords = records.filter((record: any) => {
    const order = record?.service_order_id ? ordersMap.get(String(record.service_order_id)) : null
    const orderEntryDate = order?.entry_date ? new Date(`${order.entry_date}T00:00:00`) : null

    if (!orderEntryDate || Number.isNaN(orderEntryDate.getTime())) return false
    if (dateFrom && orderEntryDate < dateFrom) return false
    if (dateTo && orderEntryDate > dateTo) return false

    if (employeeIds.length > 0) {
      if (!employeeIds.includes(String(record?.employee_id || ''))) return false
    } else if (employeeId && record?.employee_id !== employeeId) {
      return false
    }

    if (paymentStatusFilters.length > 0) {
      const orderPaymentStatus = normalizeReportStatus(order?.payment_status)
      if (!orderPaymentStatus || !paymentStatusFilters.includes(orderPaymentStatus)) return false
    }

    const recordStatus = normalizeReportStatus(record?.status)
    if (status && recordStatus !== status) return false

    if (orderStatusFilters.length > 0) {
      const orderStatus = String(order?.status || '')
      if (!orderStatus || !orderStatusFilters.includes(orderStatus)) return false
    }

    if (paymentMethods.length > 0) {
      const method = String(order?.payment_method || '') || 'no_payment'
      if (!paymentMethods.includes(method)) return false
    }

    if (recordType && record?.record_type !== recordType) return false

    if (searchTerm) {
      const name = String(employeesMap.get(String(record?.employee_id || ''))?.name || '').toLowerCase()
      if (!name.includes(searchTerm)) return false
    }

    return true
  })

  const normalizedRecords = filteredRecords.map((record: any) => ({
    ...record,
    status: normalizeReportStatus(record?.status)
  }))

  const totalCommissions = normalizedRecords.reduce((sum: number, r: any) => sum + toNumber(r?.amount, 0), 0)
  const paidCommissions = normalizedRecords.filter((r: any) => r?.status === 'paid').reduce((sum: number, r: any) => sum + toNumber(r?.amount, 0), 0)
  const pendingCommissions = normalizedRecords.filter((r: any) => r?.status === 'pending').reduce((sum: number, r: any) => sum + toNumber(r?.amount, 0), 0)

  const summary = {
    total: totalCommissions,
    paid: paidCommissions,
    pending: pendingCommissions,
    count: normalizedRecords.length,
    totalCommissions,
    totalPaid: paidCommissions,
    totalPending: pendingCommissions,
    employeeCount: 0
  }

  // Chart: by employee
  const byEmployee: Record<string, { name: string, total: number, paid: number, pending: number }> = {}
  for (const record of normalizedRecords) {
    const employeeName = String(employeesMap.get(String(record?.employee_id || ''))?.name || 'Unknown')
    if (!byEmployee[employeeName]) byEmployee[employeeName] = { name: employeeName, total: 0, paid: 0, pending: 0 }
    const amount = toNumber(record?.amount, 0)
    byEmployee[employeeName].total += amount
    if (record?.status === 'paid') byEmployee[employeeName].paid += amount
    else byEmployee[employeeName].pending += amount
  }
  const employeeChartData = Object.values(byEmployee).sort((a, b) => b.total - a.total)
  summary.employeeCount = employeeChartData.length

  const statusDistribution = [
    { name: 'Pagas', value: paidCommissions, color: '#22c55e' },
    { name: 'Pendentes', value: pendingCommissions, color: '#f59e0b' }
  ]

  const enrichedRecords = normalizedRecords.map((record: any) => {
    const order = record?.service_order_id ? ordersMap.get(String(record.service_order_id)) : null
    return {
      ...record,
      employee_name: String(employeesMap.get(String(record?.employee_id || ''))?.name || 'Unknown'),
      order_number: order?.number || 'N/A',
      order_status: order?.status || null,
      order_payment_status: order?.payment_status ? normalizeReportStatus(order?.payment_status) : null,
      order_client_name: order?.client_name || null,
      order_entry_date: order?.entry_date || null,
      order_completion_date: order?.completion_date || null,
      order_total_amount: toNumber(order?.total_amount, 0),
      status: normalizeReportStatus(record?.status)
    }
  })

  const factor = sortFactor(sortOrder)
  enrichedRecords.sort((a: any, b: any) => {
    if (sortBy === 'employee') return String(a.employee_name || '').localeCompare(String(b.employee_name || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'amount') return (toNumber(a?.amount, 0) - toNumber(b?.amount, 0)) * factor
    if (sortBy === 'status') return String(a?.status || '').localeCompare(String(b?.status || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    const aDate = String(a?.order_entry_date || a?.reference_date || '')
    const bDate = String(b?.order_entry_date || b?.reference_date || '')
    return aDate.localeCompare(bDate) * factor
  })

  const { data: items, pagination } = paginate(enrichedRecords, page, pageSize)

  return {
    data: {
      items,
      pagination,
      sort: { sortBy, sortOrder },
      summary,
      charts: { byEmployee: employeeChartData, statusDistribution },
      employees
    }
  }
})
