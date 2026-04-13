import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const { data: userProfile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', authUser.email!)
    .maybeSingle()

  if (error)
    throw createError({ statusCode: 500, statusMessage: error.message })

  if (!userProfile)
    throw createError({ statusCode: 404, statusMessage: 'Perfil não encontrado' })

  return userProfile
})
