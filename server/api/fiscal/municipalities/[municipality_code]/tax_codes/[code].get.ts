import { defineEventHandler, getRouterParam, createError } from 'h3'
import {
  getFocusNfeApiBaseUrl,
  getFocusNfeBasicAuthHeader,
  monitoredFocusNfeFetch,
  createServerCache
} from '../../../../../utils/focus-nfe'
import { mapTaxCodeResult, mapFiscalErrorDetails } from '../../../../../utils/fiscal-mappers'
import type { FocusNfeMunicipioCodigoTributario } from '../../../../../types/focus-nfe'
import type { TaxCodeResult } from '../../../../../types/fiscal'

const taxCodeCache = createServerCache<TaxCodeResult>(24 * 60 * 60 * 1000)

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const municipalityCode = getRouterParam(event, 'municipality_code')
  const taxCode = getRouterParam(event, 'code')

  if (!municipalityCode) {
    throw createError({ statusCode: 400, message: 'municipality_code é obrigatório' })
  }
  if (!taxCode) {
    throw createError({ statusCode: 400, message: 'code é obrigatório' })
  }

  const cacheKey = `${municipalityCode}:${taxCode}`
  const cached = taxCodeCache.get(cacheKey)
  if (cached) return { success: true, data: cached, cached: true }

  const authHeader = getFocusNfeBasicAuthHeader()
  const apiBaseUrl = getFocusNfeApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredFocusNfeFetch({
    authUserEmail: user.email!,
    functionName: 'getFocusNfeCodigoTributario',
    url: `${apiBaseUrl}/v2/municipios/${encodeURIComponent(municipalityCode)}/codigos_tributarios_municipio/${encodeURIComponent(taxCode)}`,
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
      data: { error: 'Erro ao consultar código tributário na Focus NFe', details: mapFiscalErrorDetails(raw) }
    })
  }

  const result = mapTaxCodeResult(JSON.parse(responseBodyRaw!) as FocusNfeMunicipioCodigoTributario)
  taxCodeCache.set(cacheKey, result)
  return { success: true, data: result }
})
