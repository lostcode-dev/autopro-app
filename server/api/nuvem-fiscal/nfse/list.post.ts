import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuthUser } from '../../../utils/require-auth'
import {
  NUVEM_FISCAL_OWNER_EMAIL,
  getNuvemFiscalApiToken,
  getNuvemFiscalApiBaseUrl,
  monitoredNuvemFiscalFetch,
  sanitizeCpfCnpj,
  normalizeText,
} from '../../../utils/nuvem-fiscal'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (user.email !== NUVEM_FISCAL_OWNER_EMAIL) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const body = await readBody(event) || {}
  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const stop = Math.max(1, Math.min(Number(body.stop) || 100, 100))
  const skip = Math.max(0, Number(body.skip) || 0)
  const linecount = body.linecount !== false
  const cpfCnpj = sanitizeCpfCnpj(body.cpf_cnpj)
  const referencia = normalizeText(body.referencia)
  const ambiente = normalizeText(body.ambiente)

  const query = new URLSearchParams()
  query.set('$stop', String(stop))
  query.set('$skip', String(skip))
  query.set('$linecount', String(linecount))
  if (cpfCnpj) query.set('cpf_cnpj', cpfCnpj)
  if (referencia) query.set('referencia', referencia)
  if (ambiente) query.set('ambiente', ambiente)

  const { response, responseBodyRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'listNuvemFiscalNfse',
    url: `${apiBaseUrl}/nfse?${query.toString()}`,
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
      data: { error: 'Erro ao listar NFS-e na Nuvem Fiscal', details: data },
    })
  }

  return { success: true, data }
})
