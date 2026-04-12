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

  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const payload: Record<string, unknown> = {}
  if (body?.email) payload.email = body.email
  if (body?.assunto) payload.assunto = body.assunto
  if (body?.mensagem) payload.mensagem = body.mensagem
  if (body?.cc) payload.cc = body.cc

  const { response, responseBodyRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'sendNuvemFiscalNfeEmail',
    url: `${apiBaseUrl}/nfe/${encodeURIComponent(id)}/email`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  })

  const data = responseBodyRaw ? JSON.parse(responseBodyRaw) : null

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      data: { error: 'Erro ao enviar e-mail da NF-e', details: data },
    })
  }

  return { success: true, data }
})
