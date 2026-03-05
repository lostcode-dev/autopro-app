import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const querySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('30d')
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const query = getQuery(event)
  const params = querySchema.parse(query)

  const supabase = getSupabaseAdminClient()

  // Calculate date range
  const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
  const days = daysMap[params.range] ?? 30
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - days)
  const fromStr = fromDate.toISOString().split('T')[0] ?? ''

  // Count entries in range
  const { data: entries, count: totalEntries } = await supabase
    .from('journal_entries')
    .select('entry_date', { count: 'exact' })
    .eq('user_id', user.id)
    .is('archived_at', null)
    .gte('entry_date', fromStr)

  // Entries by day of week
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const dayCounts: Record<string, number> = {}
  for (const name of dayNames) {
    dayCounts[name] = 0
  }
  for (const e of (entries ?? []) as Array<Record<string, unknown>>) {
    const date = new Date((e.entry_date as string) + 'T12:00:00')
    const dayName = dayNames[date.getDay()] ?? 'Domingo'
    dayCounts[dayName] = (dayCounts[dayName] ?? 0) + 1
  }
  const entriesByDayOfWeek = dayNames.map(day => ({
    day,
    count: dayCounts[day] ?? 0
  }))

  // Metric insights: averages for numeric metrics
  const { data: metricValues } = await supabase
    .from('metric_values')
    .select('*, definition:metric_definitions(key, name, type)')
    .eq('user_id', user.id)
    .gte('entry_date', fromStr)

  // Group by metric key
  const metricGroups = new Map<string, { name: string, values: number[] }>()

  for (const mv of (metricValues ?? []) as Array<Record<string, unknown>>) {
    const def = mv.definition as Record<string, unknown> | null
    if (!def) continue
    const type = def.type as string
    if (type !== 'number' && type !== 'scale') continue
    const numVal = mv.number_value as number | null
    if (numVal === null) continue

    const key = def.key as string
    const name = def.name as string

    if (!metricGroups.has(key)) {
      metricGroups.set(key, { name, values: [] })
    }
    metricGroups.get(key)!.values.push(numVal)
  }

  const metrics = Array.from(metricGroups.entries()).map(([key, group]) => {
    const vals = group.values
    const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    return {
      key,
      name: group.name,
      avg,
      min,
      max,
      count: vals.length
    }
  })

  return {
    range: params.range,
    totalEntries: totalEntries ?? 0,
    metrics,
    entriesByDayOfWeek
  }
})
