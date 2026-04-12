import { defineEventHandler, getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'
import { parseDateStart, parseDateEnd, toNumber, qArr, paginate, sortFactor } from '../../utils/report-helpers'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const query = getQuery(event)

  const dateFrom = parseDateStart(query.dateFrom as string)
  const dateTo = parseDateEnd(query.dateTo as string)
  const supplierIds = qArr(query.supplierIds)
  const selectedSupplierId = query.selectedSupplierId ? String(query.selectedSupplierId) : null
  const sortBy = ['name', 'totalPurchased', 'purchaseCount', 'itemCount', 'avgPerPurchase', 'lastPurchase'].includes(query.sortBy as string) ? String(query.sortBy) : 'name'
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Math.floor(toNumber(query.page, 1)))
  const pageSize = Math.min(100, Math.max(1, Math.floor(toNumber(query.pageSize, 10))))

  const [purchasesResult, suppliersResult] = await Promise.all([
    supabase.from('purchases').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('purchase_date', { ascending: false }),
    supabase.from('suppliers').select('*').eq('organization_id', organizationId).is('deleted_at', null),
  ])

  const allPurchases = purchasesResult.data || []
  const suppliers = suppliersResult.data || []
  const suppliersMap = new Map<string, any>(suppliers.map((s: any) => [String(s.id), s]))

  let filteredPurchases = allPurchases
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

  // Group by supplier
  const supplierStats: Record<string, { totalPurchased: number; purchaseCount: number; itemCount: number; lastPurchase: string | null; topItemsMap: Record<string, number> }> = {}

  for (const p of filteredPurchases) {
    const supplierId = String(p?.supplier_id || '')
    if (!supplierId) continue
    if (!supplierStats[supplierId]) supplierStats[supplierId] = { totalPurchased: 0, purchaseCount: 0, itemCount: 0, lastPurchase: null, topItemsMap: {} }
    const s = supplierStats[supplierId]
    s.totalPurchased += toNumber(p?.total_amount, 0)
    s.purchaseCount += 1
    const items = Array.isArray(p?.items) ? p.items : []
    s.itemCount += items.length
    const purchaseDate = String(p?.purchase_date || '')
    if (purchaseDate && (!s.lastPurchase || purchaseDate > s.lastPurchase)) s.lastPurchase = purchaseDate
    for (const item of items) {
      const desc = String(item?.description || 'No description')
      s.topItemsMap[desc] = (s.topItemsMap[desc] || 0) + (Number(item?.quantity) || 1)
    }
  }

  let supplierItems = Object.entries(supplierStats).map(([supplierId, stats]) => {
    const supplier = suppliersMap.get(supplierId)
    const topItems = Object.entries(stats.topItemsMap).sort(([, a], [, b]) => b - a).slice(0, 5)
    return {
      id: supplierId, name: supplier?.name || 'Unknown',
      totalPurchased: stats.totalPurchased, purchaseCount: stats.purchaseCount,
      itemCount: stats.itemCount,
      avgPerPurchase: stats.purchaseCount > 0 ? stats.totalPurchased / stats.purchaseCount : 0,
      lastPurchase: stats.lastPurchase, topItems,
    }
  })

  const factor = sortFactor(sortOrder)
  supplierItems.sort((a, b) => {
    if (sortBy === 'totalPurchased') return (a.totalPurchased - b.totalPurchased) * factor
    if (sortBy === 'purchaseCount') return (a.purchaseCount - b.purchaseCount) * factor
    if (sortBy === 'itemCount') return (a.itemCount - b.itemCount) * factor
    if (sortBy === 'avgPerPurchase') return (a.avgPerPurchase - b.avgPerPurchase) * factor
    if (sortBy === 'lastPurchase') return String(a.lastPurchase || '').localeCompare(String(b.lastPurchase || '')) * factor
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }) * factor
  })

  const { data: paginatedItems, pagination } = paginate(supplierItems, page, pageSize)

  const result: Record<string, any> = {
    data: {
      suppliersReport: {
        availableSuppliers: suppliers.map((s: any) => ({ id: s.id, name: s.name || '' })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')),
        items: paginatedItems,
        summary: { totalPurchased: supplierItems.reduce((s, i) => s + i.totalPurchased, 0), totalSuppliers: supplierItems.length },
        pagination,
        sort: { sortBy, sortOrder },
      },
    },
  }

  if (selectedSupplierId) {
    const dailyMap: Record<string, number> = {}
    for (const p of filteredPurchases.filter((p: any) => String(p?.supplier_id) === selectedSupplierId)) {
      const d = String(p?.purchase_date || '')
      if (!d) continue
      dailyMap[d] = (dailyMap[d] || 0) + toNumber(p?.total_amount, 0)
    }
    result.data.suppliersReport.selectedSupplierDaily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([name, total]) => ({ name, total }))
  }

  return result
})
