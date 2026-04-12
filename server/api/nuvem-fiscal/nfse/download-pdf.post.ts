import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuthUser } from '../../../utils/require-auth'
import {
  NUVEM_FISCAL_OWNER_EMAIL,
  getNuvemFiscalApiToken,
  getNuvemFiscalApiBaseUrl,
  monitoredNuvemFiscalFetch,
  normalizeText,
  extractFilename,
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

  const { response } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'downloadNuvemFiscalNfsePdf',
    url: `${apiBaseUrl}/nfse/${encodeURIComponent(id)}/pdf`,
    init: {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiToken}` },
    },
    captureResponseBody: 'never',
  })

  if (!response.ok) {
    const errText = await response.text()
    throw createError({
      statusCode: response.status,
      data: { error: 'Erro ao baixar PDF da NFS-e', details: errText },
    })
  }

  const contentType = response.headers.get('content-type') || 'application/pdf'
  const fileName = extractFilename(response.headers.get('content-disposition'), `nfse-${id}.pdf`)
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  return { success: true, data: { fileName, contentType, base64 } }
})
