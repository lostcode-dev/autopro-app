export function mapIdentity(row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
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
    status: row.status ?? null,
    currentStreak: row.currentStreak ?? row.current_streak,
    longestStreak: row.longestStreak ?? row.longest_streak,
    lastCompletedDate: row.lastCompletedDate ?? row.last_completed_date ?? null,
    updatedAt: row.updatedAt ?? row.updated_at
  }
}

export function mapHabit(row: Record<string, unknown>, tags?: Array<{ id: string, name: string, color: string | null }>): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.userId ?? row.user_id,
    identityId: row.identityId ?? row.identity_id ?? null,
    name: row.name,
    avatarEmoji: row.avatarEmoji ?? row.avatar_emoji ?? null,
    description: row.description ?? null,
    obviousStrategy: row.obviousStrategy ?? row.obvious_strategy ?? null,
    attractiveStrategy: row.attractiveStrategy ?? row.attractive_strategy ?? null,
    easyStrategy: row.easyStrategy ?? row.easy_strategy ?? null,
    satisfyingStrategy: row.satisfyingStrategy ?? row.satisfying_strategy ?? null,
    frequency: row.frequency,
    difficulty: row.difficulty,
    habitType: row.habitType ?? row.habit_type ?? 'positive',
    customDays: row.customDays ?? row.custom_days ?? null,
    sortOrder: row.sortOrder ?? row.sort_order ?? 0,
    timezone: row.timezone ?? null,
    calendarId: row.calendarId ?? row.calendar_id ?? null,
    scheduledTime: row.scheduledTime ?? row.scheduled_time ?? null,
    scheduledEndTime: row.scheduledEndTime ?? row.scheduled_end_time ?? null,
    archivedAt: row.archivedAt ?? row.archived_at ?? null,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
    identity: mapIdentity((row.identity ?? null) as Record<string, unknown> | null),
    streak: mapStreak((row.streak ?? null) as Record<string, unknown> | null),
    tags: tags ?? []
  }
}

/**
 * Maps a habit_versions row (with separate identity/streak/archivedAt) to the
 * same shape returned by mapHabit, so the client doesn't need to distinguish.
 */
export function mapHabitFromVersion(
  version: Record<string, unknown>,
  identity: Record<string, unknown> | null | undefined,
  streak: Record<string, unknown> | null | undefined,
  archivedAt: string | null,
  tags?: Array<{ id: string, name: string, color: string | null }>
): Record<string, unknown> {
  return {
    id: version.habit_id,
    userId: version.user_id,
    identityId: version.identity_id ?? null,
    name: version.name,
    avatarEmoji: version.avatar_emoji ?? null,
    description: version.description ?? null,
    obviousStrategy: version.obvious_strategy ?? null,
    attractiveStrategy: version.attractive_strategy ?? null,
    easyStrategy: version.easy_strategy ?? null,
    satisfyingStrategy: version.satisfying_strategy ?? null,
    frequency: version.frequency,
    difficulty: version.difficulty,
    habitType: version.habit_type ?? 'positive',
    customDays: version.custom_days ?? null,
    sortOrder: version.sort_order ?? 0,
    timezone: version.timezone ?? null,
    calendarId: version.calendar_id ?? null,
    scheduledTime: version.scheduled_time ?? null,
    scheduledEndTime: version.scheduled_end_time ?? null,
    archivedAt,
    createdAt: version.created_at,
    updatedAt: version.updated_at,
    identity: mapIdentity(identity ?? null),
    streak: mapStreak(streak ?? null),
    tags: tags ?? []
  }
}

export function mapHabitList(
  rows: Record<string, unknown>[] | null | undefined,
  tagMap?: Map<string, Array<{ id: string, name: string, color: string | null }>>
): Record<string, unknown>[] {
  return (rows ?? []).map(row => mapHabit(row, tagMap?.get(String(row.id))))
}

/**
 * Fetches habit tags from junction table and builds a lookup map keyed by habit ID.
 */
export async function fetchHabitTagMap(
  supabase: ReturnType<typeof import('./supabase').getSupabaseAdminClient>,
  habitIds: string[]
): Promise<Map<string, Array<{ id: string, name: string, color: string | null }>>> {
  const tagMap = new Map<string, Array<{ id: string, name: string, color: string | null }>>()
  if (habitIds.length === 0) return tagMap

  const { data: tagLinks } = await supabase
    .from('habit_tag_links')
    .select('habit_id, tag:habit_tags(id, name, color)')
    .in('habit_id', habitIds)

  for (const link of (tagLinks ?? []) as Array<Record<string, unknown>>) {
    const habitId = String(link.habit_id)
    const tag = link.tag as { id: string, name: string, color: string | null } | null
    if (!tag) continue
    if (!tagMap.has(habitId)) tagMap.set(habitId, [])
    tagMap.get(habitId)!.push({ id: tag.id, name: tag.name, color: tag.color ?? null })
  }

  return tagMap
}
