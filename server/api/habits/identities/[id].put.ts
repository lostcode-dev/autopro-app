import { z } from 'zod'
import { getSupabaseAdminClient } from '../../../utils/supabase'
import { requireAuthUser } from '../../../utils/require-auth'
import { mapIdentity } from '../../../utils/habits'

const paramsSchema = z.object({
  id: z.string().uuid()
})

const bodySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200).optional(),
  description: z.string().max(500).nullable().optional()
})

export default eventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const { id } = paramsSchema.parse(getRouterParams(event))
  const body = await readBody(event)
  const parsed = bodySchema.parse(body)

  const updateData: Record<string, string | null> = {}

  if (parsed.name !== undefined) updateData.name = parsed.name
  if (parsed.description !== undefined) updateData.description = parsed.description

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('identities')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .is('archived_at', null)
    .select('*')
    .single()

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Falha ao atualizar identidade',
      data: error?.message
    })
  }

  return mapIdentity(data)
})
