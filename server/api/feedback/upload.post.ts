import { getSupabaseAdminClient } from '../../utils/supabase'
import { requireAuthUser } from '../../utils/require-auth'

// ─── Configurable limits ──────────────────────────────────────────────────────
// These values are mirrored in FeedbackCreateModal.vue — keep in sync.
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  const supabase = getSupabaseAdminClient()

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find(p => p.name === 'file')

  if (!filePart?.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo não fornecido' })
  }

  const contentType = filePart.type ?? ''

  if (!ALLOWED_TYPES.includes(contentType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tipo de arquivo não permitido. Use JPEG, PNG, GIF, WebP, MP4, WebM ou MOV.'
    })
  }

  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType)
  const maxBytes = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES
  const maxLabel = isVideo ? '10MB' : '5MB'

  if (filePart.data.length > maxBytes) {
    throw createError({
      statusCode: 400,
      statusMessage: `Arquivo muito grande. Máximo ${maxLabel} para ${isVideo ? 'vídeos' : 'imagens'}.`
    })
  }

  const timestamp = Date.now()
  const safeName = filePart.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${timestamp}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('support-attachments')
    .upload(storagePath, filePart.data, { contentType, upsert: false })

  if (uploadError) {
    throw createError({ statusCode: 500, statusMessage: uploadError.message })
  }

  const { data: urlData } = supabase.storage
    .from('support-attachments')
    .getPublicUrl(storagePath)

  return {
    url: urlData.publicUrl,
    fileName: filePart.filename,
    fileType: contentType,
    fileSize: filePart.data.length
  }
})
