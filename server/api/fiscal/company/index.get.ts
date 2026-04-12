import { defineEventHandler, getQuery, createError } from 'h3'
import { requireAuthUser } from '../../../utils/require-auth'
import {
  NUVEM_FISCAL_OWNER_EMAIL,
  getNuvemFiscalApiToken,
  getNuvemFiscalApiBaseUrl,
  monitoredNuvemFiscalFetch,
  sanitizeCpfCnpj,
} from '../../../utils/nuvem-fiscal'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (user.email !== NUVEM_FISCAL_OWNER_EMAIL) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const body = getQuery(event)
  const cpfCnpj = sanitizeCpfCnpj(body?.cpf_cnpj)
  if (!cpfCnpj) {
    throw createError({ statusCode: 400, message: 'cpf_cnpj é obrigatório' })
  }

  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'getNuvemFiscalEmpresa',
    url: `${apiBaseUrl}/empresas/${encodeURIComponent(cpfCnpj)}`,
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
      data: { error: 'Erro ao consultar empresa na Nuvem Fiscal', details: data },
    })
  }

  return { success: true, data }
})
