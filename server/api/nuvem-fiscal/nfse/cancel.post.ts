import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuthUser } from '../../../utils/require-auth'
import {
  NUVEM_FISCAL_OWNER_EMAIL,
  getNuvemFiscalApiToken,
  getNuvemFiscalApiBaseUrl,
  monitoredNuvemFiscalFetch,
  normalizeText,
} from '../../../utils/nuvem-fiscal'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (user.email !== NUVEM_FISCAL_OWNER_EMAIL) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const body = await readBody(event)
  const id = normalizeText(body?.id)
  if (!id) {
    throw createError({ statusCode: 400, message: 'id é obrigatório' })
  }

  const justificativa = normalizeText(body?.justificativa) || 'Cancelamento solicitado pelo emissor.'
  if (justificativa.length > 255) {
    throw createError({ statusCode: 400, message: 'justificativa deve ter no máximo 255 caracteres' })
  }

  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'cancelNuvemFiscalNfse',
    url: `${apiBaseUrl}/nfse/${encodeURIComponent(id)}/cancelamento`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ justificativa }),
    },
  })

  const data = responseBodyRaw ? JSON.parse(responseBodyRaw) : null

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      data: { error: 'Erro ao cancelar NFS-e na Nuvem Fiscal', details: data },
    })
  }

  return { success: true, data }
})
