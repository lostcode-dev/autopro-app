import { defineEventHandler } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'
import { resolveOrganizationId } from '../../utils/organization'

export interface RecentOrder {
  id: string
  number: string | number
  status: string
  entry_date: string
  reported_defect: string | null
  total_amount: number
  clientName: string
  vehicleLabel: string
}

export interface TodayAppointment {
  id: string
  time: string
  status: string
  service_type: string
  clientName: string
  vehicleLabel: string
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()
  const organizationId = await resolveOrganizationId(event, authUser.id)

  // Default to current month for faturamento (Card 2)
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Today's date in YYYY-MM-DD (server local time)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [
    openOrdersResult,
    revenueOrdersResult,
    totalClientsResult,
    todayAppointmentsCountResult,
    recentOrdersResult,
    todayScheduleResult
  ] = await Promise.all([
    // Card 1: OS em andamento (snapshot atual)
    supabase
      .from('service_orders')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('status', ['open', 'in_progress', 'waiting_for_part']),

    // Card 2: Faturamento do período
    supabase
      .from('service_orders')
      .select('total_amount')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('status', ['completed', 'delivered'])
      .gte('entry_date', defaultFrom)
      .lte('entry_date', defaultTo),

    // Card 3: Total de clientes
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null),

    // Card 4: Agendamentos hoje
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .eq('appointment_date', todayStr),

    // Seção: últimas 5 OS
    supabase
      .from('service_orders')
      .select('id, number, status, entry_date, reported_defect, total_amount, clients(name), vehicles(brand, model, plate)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),

    // Seção: agenda de hoje
    supabase
      .from('appointments')
      .select('id, time, status, service_type, clients(name), vehicles(brand, model)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .eq('appointment_date', todayStr)
      .order('time', { ascending: true })
  ])

  const openOrdersCount = openOrdersResult.count ?? 0

  const grossRevenue = (revenueOrdersResult.data ?? []).reduce(
    (sum: number, o: { total_amount: unknown }) => sum + (Number(o.total_amount) || 0),
    0
  )

  const totalClients = totalClientsResult.count ?? 0

  const todayAppointmentsCount = todayAppointmentsCountResult.count ?? 0

  type RawOrder = { id: string, number: string | number, status: string, entry_date: string, reported_defect: string | null, total_amount: unknown, clients: { name: string } | { name: string }[] | null, vehicles: { brand: string, model: string, plate: string } | { brand: string, model: string, plate: string }[] | null }
  const recentOrders: RecentOrder[] = ((recentOrdersResult.data ?? []) as RawOrder[]).map((o) => {
    const client = Array.isArray(o.clients) ? o.clients[0] : o.clients
    const vehicle = Array.isArray(o.vehicles) ? o.vehicles[0] : o.vehicles
    const brand = vehicle?.brand ?? ''
    const model = vehicle?.model ?? ''
    const plate = vehicle?.plate ?? ''
    const vehicleLabel = [brand, model].filter(Boolean).join(' ') + (plate ? ` — ${plate}` : '')
    return {
      id: o.id,
      number: o.number,
      status: o.status,
      entry_date: o.entry_date,
      reported_defect: o.reported_defect ?? null,
      total_amount: Number(o.total_amount) || 0,
      clientName: client?.name ?? '—',
      vehicleLabel: vehicleLabel || '—'
    }
  })

  type RawAppt = { id: string, time: string, status: string, service_type: string, clients: { name: string } | { name: string }[] | null, vehicles: { brand: string, model: string } | { brand: string, model: string }[] | null }
  const todaySchedule: TodayAppointment[] = ((todayScheduleResult.data ?? []) as RawAppt[]).map((a) => {
    const client = Array.isArray(a.clients) ? a.clients[0] : a.clients
    const vehicle = Array.isArray(a.vehicles) ? a.vehicles[0] : a.vehicles
    const brand = vehicle?.brand ?? ''
    const model = vehicle?.model ?? ''
    return {
      id: a.id,
      time: a.time,
      status: a.status,
      service_type: a.service_type,
      clientName: client?.name ?? '—',
      vehicleLabel: [brand, model].filter(Boolean).join(' ') || '—'
    }
  })

  return {
    openOrdersCount,
    grossRevenue,
    totalClients,
    todayAppointmentsCount,
    lowStockCount: 0, // stock tracking not yet implemented
    recentOrders,
    todaySchedule
  }
})
