import { defineEventHandler, readBody, createError } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

/**
 * POST /api/reports/overview
 * Returns reports overview data: revenue, costs, margin, chart, top items.
 * Migrated from: supabase/functions/getReportsOverviewData
 */

function parseDateStart(value?: string) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseDateEnd(value?: string) {
  if (!value) return null
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? null : date
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  const payload = (await readBody(event)) || {}

  // Default to current month
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

  const dateFrom = parseDateStart(payload?.dateFrom || defaultFrom)!
  const dateTo = parseDateEnd(payload?.dateTo || defaultTo)!

  const [ordensResult, clientesResult, lancamentosResult] = await Promise.all([
    supabase.from('service_orders').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('clients').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('financial_transactions').select('*').eq('organization_id', organizationId).is('deleted_at', null).order('due_date', { ascending: false }),
  ])

  const ordens = ordensResult.data || []
  const clientes = clientesResult.data || []
  const lancamentos = lancamentosResult.data || []

  // Filter OS in period
  const ordensPeriodo = ordens.filter((o: any) => {
    const de = o?.entry_date ? new Date(`${o.entry_date}T00:00:00`) : null
    return de && !Number.isNaN(de.getTime()) && de >= dateFrom && de <= dateTo
  })

  // New clients in period
  const novosClientes = clientes.filter((c: any) => {
    const cd = c?.created_at ? new Date(c.created_at) : null
    return cd && !Number.isNaN(cd.getTime()) && cd >= dateFrom && cd <= dateTo
  }).length

  // Completed orders only
  const ordensCompletas = ordensPeriodo.filter((o: any) => o?.status === 'completed' || o?.status === 'delivered')

  // Financial costs in period
  const custosPeriodo = lancamentos.filter((l: any) => {
    const dd = l?.due_date ? new Date(`${l.due_date}T00:00:00`) : null
    return dd && !Number.isNaN(dd.getTime()) && l?.type === 'expense' && l?.status === 'pago' && dd >= dateFrom && dd <= dateTo
  })

  const faturamentoBruto = ordensCompletas.reduce((s: number, o: any) => s + toNumber(o?.total_amount, 0), 0)
  const custoTotal = custosPeriodo.reduce((s: number, l: any) => s + toNumber(l?.amount, 0), 0)
  const custoOsItens = ordensCompletas.reduce((s: number, o: any) => s + toNumber(o?.total_cost_amount, 0), 0)
  const lucroLiquido = faturamentoBruto - custoTotal
  const margemLucro = faturamentoBruto > 0 ? (lucroLiquido / faturamentoBruto) * 100 : 0
  const ticketMedio = ordensCompletas.length > 0 ? faturamentoBruto / ordensCompletas.length : 0

  // Active clients (unique clients with completed orders)
  const clientesAtivos = new Set(ordensCompletas.map((o: any) => String(o?.client_id || ''))).size

  // Daily chart data
  const dailyData: Record<string, { faturamento: number; custo: number }> = {}
  const cursor = new Date(dateFrom)
  while (cursor <= dateTo) {
    dailyData[formatDateKey(cursor)] = { faturamento: 0, custo: 0 }
    cursor.setDate(cursor.getDate() + 1)
  }
  for (const o of ordensCompletas) {
    const dk = String(o?.entry_date || '')
    if (dailyData[dk]) dailyData[dk].faturamento += toNumber(o?.total_amount, 0)
  }
  for (const l of custosPeriodo) {
    const dk = String(l?.due_date || '')
    if (dailyData[dk]) dailyData[dk].custo += toNumber(l?.amount, 0)
  }
  const chartData = Object.entries(dailyData).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ name: formatDayLabel(date), ...v }))

  // Top items
  const itemCounts: Record<string, number> = {}
  for (const o of ordensCompletas) {
    const items = Array.isArray(o?.items) ? o.items : []
    for (const item of items) {
      const desc = String(item?.description || item?.name || 'Sem descrição')
      itemCounts[desc] = (itemCounts[desc] || 0) + (Number(item?.quantity) || 1)
    }
  }
  const topItens = Object.entries(itemCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count }))

  return {
    organization_id: organizationId,
    data: {
      reportData: {
        faturamentoBruto, custoTotal, custoOsItens, lucroLiquido, margemLucro,
        ticketMedio, clientesAtivos, totalOrdens: ordensCompletas.length, novosClientes,
        chartData, topItens,
      },
    },
  }
})
