import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const body = await readBody(event)

  const updates: Record<string, unknown> = {
    updated_by: authUser.email,
  }

  if (body.display_name !== undefined)
    updates.display_name = body.display_name

  if (body.profile_picture_url !== undefined)
    updates.profile_picture_url = body.profile_picture_url

  const { data: userProfile, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('email', authUser.email!)
    .select()
    .single()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  return userProfile
})
