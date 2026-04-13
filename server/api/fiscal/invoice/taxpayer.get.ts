import { defineEventHandler, getQuery, createError } from 'h3'
import { requireAuthUser } from '../../../utils/require-auth'
import {
  NUVEM_FISCAL_OWNER_EMAIL,
  getNuvemFiscalApiToken,
  getNuvemFiscalApiBaseUrl,
  monitoredNuvemFiscalFetch,
  normalizeText
} from '../../../utils/nuvem-fiscal'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (user.email !== NUVEM_FISCAL_OWNER_EMAIL) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const body = getQuery(event)
  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const uf = normalizeText(body.uf)
  const cpfCnpj = normalizeText(body.cpf_cnpj)
  const ie = normalizeText(body.ie)

  const query = new URLSearchParams()
  if (uf) query.set('uf', uf.toUpperCase())
  if (cpfCnpj) query.set('cpf_cnpj', cpfCnpj.replace(/\D/g, ''))
  if (ie) query.set('ie', ie)

  const { response, responseBodyRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'getNuvemFiscalNfeContribuinte',
    url: `${apiBaseUrl}/nfe/cadastro-contribuinte?${query.toString()}`,
    init: {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  })

  const data = responseBodyRaw ? JSON.parse(responseBodyRaw) : null

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      data: { error: 'Erro ao consultar contribuinte da NF-e', details: data }
    })
  }

  return { success: true, data }
})
