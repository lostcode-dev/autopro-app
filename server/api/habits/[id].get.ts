import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const paramsSchema = z.object({
  id: z.string().uuid()
})

function mapIdentity(row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!row) return null

  return {
    id: row.id,
    userId: row.userId ?? row.user_id,
    name: row.name,
    description: row.description ?? null,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
    archivedAt: row.archivedAt ?? row.archived_at ?? null
  }
}

function mapStreak(row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!row) return null

  return {
    habitId: row.habitId ?? row.habit_id,
    userId: row.userId ?? row.user_id,
    currentStreak: row.currentStreak ?? row.current_streak,
    longestStreak: row.longestStreak ?? row.longest_streak,
    lastCompletedDate: row.lastCompletedDate ?? row.last_completed_date ?? null,
    updatedAt: row.updatedAt ?? row.updated_at
  }
}

function mapHabit(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.userId ?? row.user_id,
    identityId: row.identityId ?? row.identity_id ?? null,
    name: row.name,
    description: row.description ?? null,
    frequency: row.frequency,
    difficulty: row.difficulty,
    customDays: row.customDays ?? row.custom_days ?? null,
    timezone: row.timezone ?? null,
    archivedAt: row.archivedAt ?? row.archived_at ?? null,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
    identity: mapIdentity((row.identity ?? null) as Record<string, unknown> | null),
    streak: mapStreak((row.streak ?? null) as Record<string, unknown> | null)
  }
}

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id } = paramsSchema.parse(getRouterParams(event))

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('habits')
    .select('*, identity:identities(*), streak:habit_streaks(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: 'Hábito não encontrado' })
  }

  return mapHabit(data as Record<string, unknown>)
})
