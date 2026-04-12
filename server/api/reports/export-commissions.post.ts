import { defineEventHandler, readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { buildReportDownloadData } from '../../utils/report-export'
import { parseDateStart, parseDateEnd, toNumber, sortFactor, formatOptionalDate, formatCurrency, formatStatusLabel } from '../../utils/report-helpers'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = (await readBody(event)) || {}

  const dateFrom = parseDateStart(body?.dateFrom)
  const dateTo = parseDateEnd(body?.dateTo)
  const employeeIds = Array.isArray(body?.employeeIds) ? body.employeeIds.map((v: unknown) => String(v)).filter(Boolean) : []
  const employeeId = body?.employeeId && body.employeeId !== 'all' ? String(body.employeeId) : null
  const status = body?.status && body.status !== 'all' ? String(body.status) : null
  const orderStatusFilters = Array.isArray(body?.orderStatusFilters) ? body.orderStatusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const paymentStatusFilters = Array.isArray(body?.paymentStatusFilters) ? body.paymentStatusFilters.map((v: unknown) => String(v)).filter(Boolean) : []
  const paymentMethods = Array.isArray(body?.paymentMethods) ? body.paymentMethods.map((v: unknown) => String(v)).filter(Boolean) : []
  const recordType = body?.recordType && body.recordType !== 'all' ? String(body.recordType) : null
  const searchTerm = String(body?.searchTerm || '').trim().toLowerCase()
  const sortBy = ['employee', 'date', 'amount', 'status'].includes(body?.sortBy) ? body.sortBy : 'date'
  const sortOrder: 'asc' | 'desc' = body?.sortOrder === 'asc' ? 'asc' : 'desc'
  const format = body?.format === 'pdf' ? 'pdf' : 'csv'

  const [recordsResult, ordersResult, employeesResult] = await Promise.all([
    supabase.from('employee_financial_records').select('*').eq('organization_id', organizationId).order('reference_date', { ascending: false }),
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('employees').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const records = recordsResult.data || []
  const orders = ordersResult.data || []
  const employees = employeesResult.data || []

  const employeesMap = new Map(employees.map((e: any) => [String(e.id), e]))
  const ordersMap = new Map(orders.map((o: any) => [String(o.id), o]))

  const items = records
    .filter((record: any) => {
      const order = record?.service_order_id ? ordersMap.get(String(record.service_order_id)) : null
      const orderEntryDate = order?.entry_date ? new Date(`${order.entry_date}T00:00:00`) : null
      if (!orderEntryDate || Number.isNaN(orderEntryDate.getTime())) return false
      if (dateFrom && orderEntryDate < dateFrom) return false
      if (dateTo && orderEntryDate > dateTo) return false
      if (employeeIds.length > 0 && !employeeIds.includes(String(record?.employee_id || ''))) return false
      if (employeeIds.length === 0 && employeeId && String(record?.employee_id) !== employeeId) return false
      if (status && record?.status !== status) return false
      if (recordType && record?.record_type !== recordType) return false
      if (paymentStatusFilters.length > 0) {
        const s = String(order?.payment_status || '')
        if (!s || !paymentStatusFilters.includes(s)) return false
      }
      if (orderStatusFilters.length > 0) {
        const s = String(order?.status || '')
        if (!s || !orderStatusFilters.includes(s)) return false
      }
      if (paymentMethods.length > 0) {
        const pm = String(order?.payment_method || '')
        if (!paymentMethods.includes(pm || 'no_payment_method')) return false
      }
      if (searchTerm) {
        const name = String(employeesMap.get(String(record?.employee_id || ''))?.name || '').toLowerCase()
        if (!name.includes(searchTerm)) return false
      }
      return true
    })
    .map((record: any) => {
      const order = record?.service_order_id ? ordersMap.get(String(record.service_order_id)) : null
      return {
        ...record,
        employee_name: String(employeesMap.get(String(record?.employee_id || ''))?.name || 'Unknown'),
        order_number: order?.number || 'N/A',
        order_status: order?.status || null,
        order_payment_status: order?.payment_status || null,
        order_entry_date: order?.entry_date || null,
      }
    })

  const factor = sortFactor(sortOrder)
  items.sort((a: any, b: any) => {
    if (sortBy === 'employee') return String(a.employee_name || '').localeCompare(String(b.employee_name || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'amount') return (toNumber(a?.amount, 0) - toNumber(b?.amount, 0)) * factor
    if (sortBy === 'status') return String(a?.status || '').localeCompare(String(b?.status || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    return String(a?.order_entry_date || a?.reference_date || '').localeCompare(String(b?.order_entry_date || b?.reference_date || '')) * factor
  })

  const totalRows = items.length
  const totalCommission = items.reduce((sum: number, r: any) => sum + toNumber(r?.amount, 0), 0)

  const columns = [
    { header: 'FUNCIONÁRIO', widthRatio: 0.18 }, { header: 'OS', widthRatio: 0.06 },
    { header: 'REFERÊNCIA PAGAMENTO', widthRatio: 0.12 }, { header: 'STATUS OS', widthRatio: 0.1 },
    { header: 'ENTRADA OS', widthRatio: 0.1 }, { header: 'VALOR', widthRatio: 0.1, align: 'right' as const },
    { header: 'PAGAMENTO OS', widthRatio: 0.1 }, { header: 'STATUS COMISSÃO', widthRatio: 0.12 },
    { header: 'DATA PAGAMENTO COMISSÃO', widthRatio: 0.12 },
  ]

  const dataRows = items.map((record: any) => [
    String(record.employee_name || 'Unknown'),
    String(record.service_order_id ? `#${record.order_number || 'N/A'}` : '-'),
    formatOptionalDate(record.reference_date),
    formatStatusLabel(record.order_status),
    formatOptionalDate(record.order_entry_date || record.reference_date),
    formatCurrency(record.amount),
    formatStatusLabel(record.order_payment_status),
    formatStatusLabel(record.status),
    formatOptionalDate(record.payment_date),
  ])

  const data = await buildReportDownloadData({
    format,
    title: 'Relatório de Comissões',
    subtitle: `Período: ${body?.dateFrom ? formatOptionalDate(body.dateFrom) : '-'} a ${body?.dateTo ? formatOptionalDate(body.dateTo) : '-'}`,
    fileNameBase: 'relatorio_comissoes',
    columns,
    rows: dataRows,
    footerRows: [
      { label: 'Total de Linhas', value: String(totalRows) },
      { label: 'Total da Comissão', value: formatCurrency(totalCommission) },
    ],
  })

  return { success: true, data }
})
