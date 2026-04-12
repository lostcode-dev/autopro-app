import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuthUser } from '../../../utils/require-auth'
import {
  NUVEM_FISCAL_OWNER_EMAIL,
  getNuvemFiscalApiToken,
  getNuvemFiscalApiBaseUrl,
  monitoredNuvemFiscalFetch,
  normalizeText,
  parseBoolean,
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

  const logotipo = parseBoolean(body?.logotipo, false)
  const nomeFantasia = parseBoolean(body?.nome_fantasia, false)
  const canhoto = parseBoolean(body?.canhoto, true)
  const mensagemRodape = normalizeText(body?.mensagem_rodape) || ''
  if (mensagemRodape.length > 120) {
    throw createError({ statusCode: 400, message: 'mensagem_rodape deve ter no máximo 120 caracteres' })
  }

  const formatoInput = normalizeText(body?.formato) || 'padrao'
  if (!['padrao', 'retrato', 'paisagem', 'simplificado', 'etiqueta'].includes(formatoInput)) {
    throw createError({ statusCode: 400, message: 'formato inválido' })
  }

  const query = new URLSearchParams()
  query.set('logotipo', String(logotipo))
  query.set('nome_fantasia', String(nomeFantasia))
  query.set('formato', formatoInput)
  query.set('mensagem_rodape', mensagemRodape)
  query.set('canhoto', String(canhoto))

  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const { response } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'downloadNuvemFiscalNfeDanfePdf',
    url: `${apiBaseUrl}/nfe/${encodeURIComponent(id)}/pdf?${query.toString()}`,
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
      data: { error: 'Erro ao baixar PDF do DANFE', details: errText },
    })
  }

  const contentType = response.headers.get('content-type') || 'application/pdf'
  const fileName = extractFilename(response.headers.get('content-disposition'), `danfe-nfe-${id}.pdf`)
  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  return { success: true, data: { fileName, contentType, base64 } }
})
