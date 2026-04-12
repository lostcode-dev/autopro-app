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

  const correcao = normalizeText(body?.correcao)
  if (!correcao) {
    throw createError({ statusCode: 400, message: 'correcao é obrigatório' })
  }

  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'createNuvemFiscalNfeCartaCorrecao',
    url: `${apiBaseUrl}/nfe/${encodeURIComponent(id)}/carta-correcao`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ correcao }),
    },
  })

  const data = responseBodyRaw ? JSON.parse(responseBodyRaw) : null

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      data: { error: 'Erro ao criar carta de correção da NF-e', details: data },
    })
  }

  return { success: true, data }
})
