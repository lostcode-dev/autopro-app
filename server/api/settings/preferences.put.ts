import { z } from 'zod'
import { requireAuthUser } from '../../utils/require-auth'
import { getSupabaseAdminClient } from '../../utils/supabase'

const VALID_PRIMARY_COLORS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple',
  'fuchsia', 'pink', 'rose'
] as const

const VALID_NEUTRAL_COLORS = ['slate', 'gray', 'zinc', 'neutral', 'stone'] as const
const VALID_COLOR_MODES = ['light', 'dark'] as const

const schema = z.object({
  primary_color: z.enum(VALID_PRIMARY_COLORS),
  neutral_color: z.enum(VALID_NEUTRAL_COLORS),
  color_mode: z.enum(VALID_COLOR_MODES)
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados inválidos',
      data: parsed.error.flatten()
    })
  }

  const supabase = getSupabaseAdminClient()

  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      primary_color: parsed.data.primary_color,
      neutral_color: parsed.data.neutral_color,
      color_mode: parsed.data.color_mode
    }, { onConflict: 'user_id' })

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Não foi possível salvar as preferências'
    })
  }

  return { ok: true }
})
