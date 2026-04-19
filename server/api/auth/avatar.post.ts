import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  // Fetch the user profile to get profile_picture_url context and employee_id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('employee_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(p => p.name === 'file')

  if (!filePart?.data || !filePart.filename)
    throw createError({ statusCode: 400, statusMessage: 'Arquivo não fornecido' })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const contentType = filePart.type || ''
  if (!allowedTypes.includes(contentType))
    throw createError({ statusCode: 400, statusMessage: 'Formato não permitido. Use JPEG, PNG, GIF ou WebP.' })

  const maxSize = 1 * 1024 * 1024
  if (filePart.data.length > maxSize)
    throw createError({ statusCode: 400, statusMessage: 'Arquivo muito grande. Máximo 1MB.' })

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  }
  const ext = extMap[contentType] ?? 'jpg'
  const storagePath = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('user-avatars')
    .upload(storagePath, filePart.data, { contentType, upsert: true })

  if (uploadError)
    throw createError({ statusCode: 500, statusMessage: uploadError.message })

  const { data: publicUrlData } = supabase.storage
    .from('user-avatars')
    .getPublicUrl(storagePath)

  const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

  // Update auth user metadata
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { avatar_url: avatarUrl }
  })

  if (updateError)
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível atualizar o avatar' })

  await supabase
    .from('user_profiles')
    .update({ profile_picture_url: avatarUrl })
    .eq('user_id', user.id)

  if (profile?.employee_id) {
    await supabase
      .from('employees')
      .update({ photo_url: avatarUrl })
      .eq('id', profile.employee_id)
  }

  return { avatar_url: avatarUrl }
})
