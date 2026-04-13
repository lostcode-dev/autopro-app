import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { parseDateStart, parseDateEnd, toNumber, qArr, paginate, sortFactor, formatDayLabel, getPurchasePaymentStatus } from '../../utils/report-helpers'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)

  const dateFrom = parseDateStart(query.dateFrom as string)
  const dateTo = parseDateEnd(query.dateTo as string)
  const supplierIds = qArr(query.supplierIds)
  const statusFilter = query.status && query.status !== 'all' ? String(query.status) : null
  const searchTerm = String(query.searchTerm || '').trim().toLowerCase()
  const sortBy = ['purchase_date', 'total_amount', 'supplier', 'invoice_number', 'status'].includes(query.sortBy as string) ? String(query.sortBy) : 'purchase_date'
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(query.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(query.pageSize, 20))))

  const [purchasesResult, suppliersResult] = await Promise.all([
    supabase.from('purchases').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('purchase_date', { ascending: false }),
    supabase.from('suppliers').select('*').eq('organization_id', organizationId).is('deleted_at', null)
  ])

  const purchasesRaw = purchasesResult.data || []
  const suppliers = suppliersResult.data || []
  const suppliersMap = new Map<string, any>(suppliers.map((s: any) => [String(s.id), s]))

  let filteredPurchases = purchasesRaw.map((p: any) => ({
    ...p,
    supplierName: suppliersMap.get(String(p?.supplier_id || ''))?.name || 'Unknown',
    paymentStatus: getPurchasePaymentStatus(p)
  }))

  if (dateFrom || dateTo) {
    filteredPurchases = filteredPurchases.filter((p: any) => {
      const purchaseDate = p?.purchase_date ? new Date(`${p.purchase_date}T00:00:00`) : null
      if (!purchaseDate || Number.isNaN(purchaseDate.getTime())) return false
      if (dateFrom && purchaseDate < dateFrom) return false
      if (dateTo && purchaseDate > dateTo) return false
      return true
    })
  }

  if (supplierIds.length > 0) filteredPurchases = filteredPurchases.filter((p: any) => supplierIds.includes(String(p?.supplier_id || '')))
  if (statusFilter) filteredPurchases = filteredPurchases.filter((p: any) => p.paymentStatus === statusFilter)
  if (searchTerm) {
    filteredPurchases = filteredPurchases.filter((p: any) =>
      p.supplierName.toLowerCase().includes(searchTerm)
      || String(p?.invoice_number || '').toLowerCase().includes(searchTerm)
    )
  }

  const factor = sortFactor(sortOrder)
  filteredPurchases.sort((a: any, b: any) => {
    if (sortBy === 'total_amount') return (toNumber(a?.total_amount, 0) - toNumber(b?.total_amount, 0)) * factor
    if (sortBy === 'supplier') return a.supplierName.localeCompare(b.supplierName, 'pt-BR', { sensitivity: 'base' }) * factor
    if (sortBy === 'invoice_number') return String(a?.invoice_number || '').localeCompare(String(b?.invoice_number || '')) * factor
    if (sortBy === 'status') return a.paymentStatus.localeCompare(b.paymentStatus) * factor
    return String(b?.purchase_date || '').localeCompare(String(a?.purchase_date || '')) * factor * (sortOrder === 'asc' ? -1 : 1)
  })

  const totalPurchased = filteredPurchases.reduce((s: number, p: any) => s + toNumber(p?.total_amount, 0), 0)
  const totalPaid = filteredPurchases.filter((p: any) => p.paymentStatus === 'paid').reduce((s: number, p: any) => s + toNumber(p?.total_amount, 0), 0)

  // Chart: top 10 suppliers by total
  const supplierTotals: Record<string, { name: string, total: number }> = {}
  for (const p of filteredPurchases) {
    const name = p.supplierName
    if (!supplierTotals[name]) supplierTotals[name] = { name, total: 0 }
    supplierTotals[name].total += toNumber(p?.total_amount, 0)
  }
  const bySupplierChart = Object.values(supplierTotals).sort((a, b) => b.total - a.total).slice(0, 10)

  // Chart: daily totals
  const dailyMap: Record<string, number> = {}
  for (const p of filteredPurchases) {
    const d = String(p?.purchase_date || '')
    if (!d) continue
    dailyMap[d] = (dailyMap[d] || 0) + toNumber(p?.total_amount, 0)
  }
  if (dateFrom && dateTo) {
    const cursor = new Date(dateFrom)
    while (cursor <= dateTo) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      if (!dailyMap[key]) dailyMap[key] = 0
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  const byDayChart = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ name: formatDayLabel(date), total }))

  const { data: paginatedItems, pagination } = paginate(filteredPurchases, page, pageSize)

  return {
    data: {
      items: paginatedItems,
      pagination,
      summary: { totalPurchased, totalPaid, totalPending: totalPurchased - totalPaid, count: filteredPurchases.length },
      charts: { bySupplier: bySupplierChart, byDay: byDayChart },
      suppliers: suppliers.sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'))
    }
  }
})
