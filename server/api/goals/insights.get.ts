import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  // Fetch all non-archived goals
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao buscar insights', data: error.message })
  }

  const all = goals ?? []
  const nonArchived = all.filter((g: Record<string, unknown>) => g.status !== 'archived')
  const active = nonArchived.filter((g: Record<string, unknown>) => g.status === 'active')
  const completed = nonArchived.filter((g: Record<string, unknown>) => g.status === 'completed')

  const totalGoals = nonArchived.length
  const averageProgress = totalGoals > 0
    ? Math.round(nonArchived.reduce((sum: number, g: Record<string, unknown>) => sum + (g.progress as number), 0) / totalGoals)
    : 0

  // Group by life_category
  const lifeCategoryLabels: Record<string, string> = {
    personal: 'Pessoal',
    career: 'Carreira',
    health: 'Saúde',
    finance: 'Finanças',
    spiritual: 'Espiritual',
    learning: 'Aprendizado',
    relationships: 'Relacionamentos',
    lifestyle: 'Estilo de vida'
  }

  const lifeCategoryStats = nonArchived.reduce<Record<string, { count: number, totalProgress: number }>>((acc, g: Record<string, unknown>) => {
      const cat = g.life_category as string
      if (!acc[cat]) acc[cat] = { count: 0, totalProgress: 0 }
      acc[cat].count++
      acc[cat].totalProgress += g.progress as number
      return acc
    }, {})

  const byLifeCategory = Object.entries(lifeCategoryStats).map(([category, stats]) => ({
    category,
    label: lifeCategoryLabels[category] ?? category,
    count: stats.count,
    avgProgress: stats.count > 0 ? Math.round(stats.totalProgress / stats.count) : 0
  }))

  // Group by time_category
  const timeCategoryLabels: Record<string, string> = {
    daily: 'Diário',
    weekly: 'Semanal',
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    yearly: 'Anual',
    long_term: 'Longo prazo'
  }

  const timeCategoryStats = nonArchived.reduce<Record<string, { count: number, totalProgress: number }>>((acc, g: Record<string, unknown>) => {
      const cat = g.time_category as string
      if (!acc[cat]) acc[cat] = { count: 0, totalProgress: 0 }
      acc[cat].count++
      acc[cat].totalProgress += g.progress as number
      return acc
    }, {})

  const byTimeCategory = Object.entries(timeCategoryStats).map(([category, stats]) => ({
    category,
    label: timeCategoryLabels[category] ?? category,
    count: stats.count,
    avgProgress: stats.count > 0 ? Math.round(stats.totalProgress / stats.count) : 0
  }))

  return {
    totalGoals,
    completedGoals: completed.length,
    activeGoals: active.length,
    averageProgress,
    byLifeCategory,
    byTimeCategory
  }
})
