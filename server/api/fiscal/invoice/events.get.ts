import { defineEventHandler, getQuery, createError } from 'h3'
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

  const body = getQuery(event)
  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const stop = Math.max(1, Math.min(Number(body.stop) || 100, 100))
  const skip = Math.max(0, Number(body.skip) || 0)
  const linecount = body.linecount !== 'false'
  const tipoEvento = normalizeText(body.tipo_evento)

  const query = new URLSearchParams()
  query.set('$stop', String(stop))
  query.set('$skip', String(skip))
  query.set('$linecount', String(linecount))
  if (tipoEvento) query.set('tipo_evento', tipoEvento)

  const { response, responseBodyRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'listNuvemFiscalNfeEventos',
    url: `${apiBaseUrl}/nfe/eventos?${query.toString()}`,
    init: {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    },
  })

  const data = responseBodyRaw ? JSON.parse(responseBodyRaw) : null

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      data: { error: 'Erro ao listar eventos de NF-e', details: data },
    })
  }

  return { success: true, data }
})
