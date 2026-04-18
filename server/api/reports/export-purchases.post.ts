import { defineEventHandler, readBody } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { buildReportDownloadData } from '../../utils/report-export'
import { formatCurrency, formatOptionalDate, getPurchasePaymentStatus, parseDateEnd, parseDateStart, sortFactor, toNumber } from '../../utils/report-helpers'

interface PurchaseRecord {
  supplier_id?: string | null
  purchase_date?: string | null
  total_amount?: number | string | null
  invoice_number?: string | null
  due_date?: string | null
  payment_status?: string | null
  [key: string]: unknown
}

interface SupplierRecord {
  id: string
  name?: string | null
}

interface OrganizationRecord {
  name?: string | null
  tax_id?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  website?: string | null
  city?: string | null
  state?: string | null
}

interface PurchaseReportItem extends PurchaseRecord {
  supplierName: string
  paymentStatus: string
}

const paymentStatusLabelMap: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido'
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(value)
}

function formatPhone(value?: string | null) {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  return value
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const body = (await readBody(event)) || {}

  const dateFrom = parseDateStart(body?.dateFrom)
  const dateTo = parseDateEnd(body?.dateTo)
  const supplierIds = Array.isArray(body?.supplierIds) ? body.supplierIds.map((value: unknown) => String(value)).filter(Boolean) : []
  const statusFilters = Array.isArray(body?.status) ? body.status.map((value: unknown) => String(value)).filter(Boolean) : []
  const searchTerm = String(body?.searchTerm || '').trim().toLowerCase()
  const sortBy = ['purchase_date', 'total_amount', 'supplier', 'invoice_number', 'status'].includes(body?.sortBy) ? body.sortBy : 'purchase_date'
  const sortOrder: 'asc' | 'desc' = body?.sortOrder === 'asc' ? 'asc' : 'desc'
  const format = body?.format === 'pdf' ? 'pdf' : 'csv'

  const [purchasesResult, suppliersResult, organizationResult] = await Promise.all([
    supabase.from('purchases').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('purchase_date', { ascending: false }),
    supabase.from('suppliers').select('*').eq('organization_id', organizationId).is('deleted_at', null),
    supabase
      .from('organizations')
      .select('name, tax_id, phone, whatsapp, email, website, city, state')
      .eq('id', organizationId)
      .maybeSingle()
  ])

  const purchasesRaw = (purchasesResult.data ?? []) as PurchaseRecord[]
  const suppliers = (suppliersResult.data ?? []) as SupplierRecord[]
  const organization = (organizationResult.data ?? null) as OrganizationRecord | null
  const suppliersMap = new Map<string, SupplierRecord>(suppliers.map(supplier => [String(supplier.id), supplier]))

  const items = purchasesRaw
    .map((purchase): PurchaseReportItem => ({
      ...purchase,
      supplierName: suppliersMap.get(String(purchase?.supplier_id || ''))?.name || 'Sem fornecedor',
      paymentStatus: getPurchasePaymentStatus(purchase)
    }))
    .filter((purchase) => {
      if (dateFrom || dateTo) {
        const purchaseDate = purchase?.purchase_date ? new Date(`${purchase.purchase_date}T00:00:00`) : null
        if (!purchaseDate || Number.isNaN(purchaseDate.getTime())) return false
        if (dateFrom && purchaseDate < dateFrom) return false
        if (dateTo && purchaseDate > dateTo) return false
      }
      if (supplierIds.length > 0 && !supplierIds.includes(String(purchase?.supplier_id || ''))) return false
      if (statusFilters.length > 0 && !statusFilters.includes(String(purchase.paymentStatus || ''))) return false
      if (searchTerm) {
        const supplierName = String(purchase.supplierName || '').toLowerCase()
        const invoiceNumber = String(purchase?.invoice_number || '').toLowerCase()
        if (!supplierName.includes(searchTerm) && !invoiceNumber.includes(searchTerm)) return false
      }
      return true
    })

  const factor = sortFactor(sortOrder)
  items.sort((a, b) => {
    if (sortBy === 'total_amount') return (toNumber(a?.total_amount, 0) - toNumber(b?.total_amount, 0)) * factor
    if (sortBy === 'supplier') return String(a.supplierName || '').localeCompare(String(b.supplierName || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'invoice_number') return String(a?.invoice_number || '').localeCompare(String(b?.invoice_number || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'status') return String(a?.paymentStatus || '').localeCompare(String(b?.paymentStatus || ''), 'pt-BR', { sensitivity: 'base' }) * factor
    return String(a?.purchase_date || '').localeCompare(String(b?.purchase_date || '')) * factor
  })

  const totalPurchased = items.reduce((sum: number, purchase) => sum + toNumber(purchase?.total_amount, 0), 0)
  const totalPaid = items
    .filter(purchase => purchase.paymentStatus === 'paid')
    .reduce((sum: number, purchase) => sum + toNumber(purchase?.total_amount, 0), 0)
  const generatedAt = formatDateTime(new Date())
  const companyPrimaryParts = [
    organization?.tax_id || null,
    formatPhone(organization?.phone),
    formatPhone(organization?.whatsapp)
  ].filter(Boolean)
  const companySecondaryParts = [
    organization?.email || null,
    organization?.website || null,
    organization?.city || organization?.state ? [organization?.city, organization?.state].filter(Boolean).join('/') : null
  ].filter(Boolean)

  const data = await buildReportDownloadData({
    format,
    title: 'Relatório de Compras',
    subtitle: `Período: ${body?.dateFrom ? formatOptionalDate(body.dateFrom) : '-'} a ${body?.dateTo ? formatOptionalDate(body.dateTo) : '-'}`,
    fileNameBase: 'relatorio_compras',
    columns: [
      { header: 'FORNECEDOR', widthRatio: 0.28 },
      { header: 'DATA', widthRatio: 0.12 },
      { header: 'Nº NOTA FISCAL', widthRatio: 0.16 },
      { header: 'VENCIMENTO', widthRatio: 0.12 },
      { header: 'VALOR TOTAL', widthRatio: 0.14, align: 'right' as const },
      { header: 'STATUS', widthRatio: 0.12 }
    ],
    rows: items.map(purchase => [
      String(purchase.supplierName || 'Sem fornecedor'),
      formatOptionalDate(purchase.purchase_date),
      String(purchase?.invoice_number || '-'),
      formatOptionalDate(purchase?.due_date),
      formatCurrency(purchase?.total_amount),
      paymentStatusLabelMap[purchase.paymentStatus] ?? String(purchase.paymentStatus || '-')
    ]),
    footerRows: [
      { label: 'Total de Compras', value: String(items.length) },
      { label: 'Total Comprado', value: formatCurrency(totalPurchased) },
      { label: 'Total Pago', value: formatCurrency(totalPaid) },
      { label: 'Total Pendente', value: formatCurrency(totalPurchased - totalPaid) }
    ],
    footerMetaRows: [
      {
        left: `Gerado em: ${generatedAt}`,
        right: organization?.name || ''
      }
    ],
    footerNotes: [
      companyPrimaryParts.join(' | '),
      companySecondaryParts.join(' | ')
    ].filter(Boolean)
  })

  return { success: true, data }
})
