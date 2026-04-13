import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuthUser } from '../../../utils/require-auth'
import {
  NUVEM_FISCAL_OWNER_EMAIL,
  getNuvemFiscalApiToken,
  getNuvemFiscalApiBaseUrl,
  monitoredNuvemFiscalFetch,
  sanitizeCpfCnpj
} from '../../../utils/nuvem-fiscal'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (user.email !== NUVEM_FISCAL_OWNER_EMAIL) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const body = await readBody(event)
  const cpfCnpj = sanitizeCpfCnpj(body?.cpf_cnpj)
  if (!cpfCnpj) {
    throw createError({ statusCode: 400, message: 'cpf_cnpj é obrigatório' })
  }

  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  // Step 1: GET current data for merge
  const { response: getResp, responseBodyRaw: getRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'updateNuvemFiscalEmpresa:get',
    url: `${apiBaseUrl}/empresas/${encodeURIComponent(cpfCnpj)}`,
    init: {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    }
  })

  let existingData: Record<string, any> = {}
  if (getResp.ok && getRaw) {
    try { existingData = JSON.parse(getRaw) } catch { /* ignore */ }
  }

  // Step 2: Merge and PUT
  const merged = { ...existingData, ...body, cpf_cnpj: cpfCnpj }

  const { response, responseBodyRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'updateNuvemFiscalEmpresa:put',
    url: `${apiBaseUrl}/empresas/${encodeURIComponent(cpfCnpj)}`,
    init: {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(merged)
    }
  })

  const data = responseBodyRaw ? JSON.parse(responseBodyRaw) : null

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      data: { error: 'Erro ao atualizar empresa na Nuvem Fiscal', details: data }
    })
  }

  return { success: true, data }
})
