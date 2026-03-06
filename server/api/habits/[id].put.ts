import { z } from 'zod'
import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

const paramsSchema = z.object({
  id: z.string().uuid()
})

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
  difficulty: z.enum(['tiny', 'normal', 'hard']).optional(),
  habitType: z.enum(['positive', 'negative']).optional(),
  identityId: z.string().uuid().nullable().optional(),
  customDays: z.array(z.number().int().min(0).max(6)).optional(),
  sortOrder: z.number().int().min(0).optional()
})

/** Fields to track in change history */
const TRACKED_FIELDS = ['difficulty', 'frequency', 'identityId', 'habitType'] as const

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id } = paramsSchema.parse(getRouterParams(event))
  const body = await readBody(event)
  const parsed = bodySchema.parse(body)

  const supabase = getSupabaseAdminClient()

  // Fetch current habit to compare tracked fields
  const { data: current, error: fetchError } = await supabase
    .from('habits')
    .select('difficulty, frequency, identity_id, habit_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !current) {
    throw createError({ statusCode: 404, statusMessage: 'Hábito não encontrado' })
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (parsed.name !== undefined) updateData.name = parsed.name
  if (parsed.description !== undefined) updateData.description = parsed.description
  if (parsed.frequency !== undefined) updateData.frequency = parsed.frequency
  if (parsed.difficulty !== undefined) updateData.difficulty = parsed.difficulty
  if (parsed.habitType !== undefined) updateData.habit_type = parsed.habitType
  if (parsed.identityId !== undefined) updateData.identity_id = parsed.identityId
  if (parsed.customDays !== undefined) updateData.custom_days = parsed.customDays
  if (parsed.sortOrder !== undefined) updateData.sort_order = parsed.sortOrder

  // Record change history for tracked fields
  const fieldToColumn: Record<string, string> = {
    difficulty: 'difficulty',
    frequency: 'frequency',
    identityId: 'identity_id',
    habitType: 'habit_type'
  }

  const historyRows: { habit_id: string; user_id: string; field: string; old_value: string | null; new_value: string | null }[] = []

  for (const field of TRACKED_FIELDS) {
    const newVal = parsed[field]
    if (newVal === undefined) continue
    const colName = fieldToColumn[field]!
    const oldVal = (current as Record<string, unknown>)[colName]
    if (String(newVal ?? '') !== String(oldVal ?? '')) {
      historyRows.push({
        habit_id: id,
        user_id: user.id,
        field,
        old_value: oldVal != null ? String(oldVal) : null,
        new_value: newVal != null ? String(newVal) : null
      })
    }
  }

  if (historyRows.length > 0) {
    await supabase.from('habit_change_history').insert(historyRows)
  }

  const { data, error } = await supabase
    .from('habits')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*, identity:identities(*), streak:habit_streaks(*)')
    .single()

  if (error || !data) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao atualizar hábito', data: error?.message })
  }

  return data
})
