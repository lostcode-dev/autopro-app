import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*, list:task_lists(id, name)')
    .eq('user_id', user.id)
    .neq('status', 'archived')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao buscar insights', data: error.message })
  }

  const all = tasks ?? []
  const today = new Date().toISOString().split('T')[0] ?? ''

  const pending = all.filter((t: Record<string, unknown>) => t.status === 'pending')
  const inProgress = all.filter((t: Record<string, unknown>) => t.status === 'in_progress')
  const completed = all.filter((t: Record<string, unknown>) => t.status === 'completed')
  const overdue = all.filter((t: Record<string, unknown>) =>
    t.due_date && (t.due_date as string) < today && t.status !== 'completed'
  )

  const totalTasks = all.length
  const completionRate = totalTasks > 0
    ? Math.round((completed.length / totalTasks) * 100)
    : 0

  // Group by priority
  const priorityLabels: Record<string, string> = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    critical: 'Crítica'
  }

  const byPriority = Object.entries(
    all.reduce((acc: Record<string, { count: number, completedCount: number }>, t: Record<string, unknown>) => {
      const p = t.priority as string
      if (!acc[p]) acc[p] = { count: 0, completedCount: 0 }
      acc[p].count++
      if (t.status === 'completed') acc[p].completedCount++
      return acc
    }, {})
  ).map(([priority, stats]) => ({
    priority,
    label: priorityLabels[priority] ?? priority,
    count: stats.count,
    completedCount: stats.completedCount
  }))

  // Group by list
  const byList = Object.entries(
    all.reduce((acc: Record<string, { listName: string, count: number, completedCount: number }>, t: Record<string, unknown>) => {
      const list = t.list as Record<string, unknown> | null
      const listId = list?.id as string ?? '_none'
      const listName = list?.name as string ?? 'Sem lista'
      if (!acc[listId]) acc[listId] = { listName, count: 0, completedCount: 0 }
      acc[listId].count++
      if (t.status === 'completed') acc[listId].completedCount++
      return acc
    }, {})
  ).map(([listId, stats]) => ({
    listId: listId === '_none' ? null : listId,
    listName: stats.listName,
    count: stats.count,
    completedCount: stats.completedCount
  }))

  return {
    totalTasks,
    pendingTasks: pending.length,
    inProgressTasks: inProgress.length,
    completedTasks: completed.length,
    overdueTasks: overdue.length,
    completionRate,
    byPriority,
    byList
  }
})
