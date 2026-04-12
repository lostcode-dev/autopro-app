import { defineEventHandler, getQuery, createError } from 'h3'
import { requireAuthUser } from '../../utils/require-auth'
import { NUVEM_FISCAL_OWNER_EMAIL } from '../../utils/nuvem-fiscal'
import { getSupabaseAdminClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (user.email !== NUVEM_FISCAL_OWNER_EMAIL) {
    throw createError({ statusCode: 403, message: 'Não autorizado' })
  }

  const body = getQuery(event)
  const page = Math.max(1, Math.min(Number(body.page) || 1, 100000))
  const pageSize = Math.max(1, Math.min(Number(body.pageSize) || 50, 200))
  const offset = (page - 1) * pageSize

  const supabase = getSupabaseAdminClient()

  const { data: logs, error } = await supabase
    .from('fiscal_integration_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Erro ao listar logs da Nuvem Fiscal',
    })
  }

  const hasMore = (logs || []).length === pageSize

  return {
    data: {
      logs: logs || [],
      page,
      pageSize,
      hasMore,
    },
  }
})
