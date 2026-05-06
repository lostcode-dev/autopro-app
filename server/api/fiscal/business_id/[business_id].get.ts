import { defineEventHandler, getRouterParam, createError } from 'h3'
import {
  getFocusNfeApiBaseUrl,
  getFocusNfeBasicAuthHeader,
  monitoredFocusNfeFetch,
  createServerCache
} from '../../../utils/focus-nfe'
import { mapBusinessIdResult, mapFiscalErrorDetails } from '../../../utils/fiscal-mappers'
import type { FocusNfeCnpjResponse } from '../../../types/focus-nfe'
import type { BusinessIdResult } from '../../../types/fiscal'

const businessIdCache = createServerCache<BusinessIdResult>(60 * 60 * 1000)

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const rawBusinessId = getRouterParam(event, 'business_id')
  if (!rawBusinessId) {
    throw createError({ statusCode: 400, message: 'CNPJ é obrigatório' })
  }

  const businessId = rawBusinessId.replace(/\D/g, '')
  if (businessId.length !== 14) {
    throw createError({ statusCode: 400, message: 'CNPJ deve conter 14 dígitos numéricos' })
  }

  const cached = businessIdCache.get(businessId)
  if (cached) return { success: true, data: cached, cached: true }

  const authHeader = getFocusNfeBasicAuthHeader()
  const apiBaseUrl = getFocusNfeApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredFocusNfeFetch({
    authUserEmail: user.email!,
    functionName: 'getFocusNfeCnpj',
    url: `${apiBaseUrl}/v2/cnpjs/${encodeURIComponent(businessId)}`,
    captureResponseBody: 'always',
    init: {
      method: 'GET',
      headers: { Authorization: authHeader }
    }
  })

  if (!response.ok) {
    const raw = responseBodyRaw ? JSON.parse(responseBodyRaw) : null
    throw createError({
      statusCode: response.status,
      data: { error: 'Erro ao consultar CNPJ na Focus NFe', details: mapFiscalErrorDetails(raw) }
    })
  }

  const result = mapBusinessIdResult(JSON.parse(responseBodyRaw!) as FocusNfeCnpjResponse)
  businessIdCache.set(businessId, result)
  return { success: true, data: result }
})
