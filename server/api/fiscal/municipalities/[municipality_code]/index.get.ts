import { defineEventHandler, getRouterParam, createError } from 'h3'
import {
  getFocusNfeApiBaseUrl,
  getFocusNfeBasicAuthHeader,
  monitoredFocusNfeFetch,
  createServerCache
} from '../../../../utils/focus-nfe'
import { mapMunicipalityResult, mapFiscalErrorDetails } from '../../../../utils/fiscal-mappers'
import type { FocusNfeMunicipio } from '../../../../types/focus-nfe'
import type { MunicipalityResult } from '../../../../types/fiscal'

const municipalityCache = createServerCache<MunicipalityResult>(24 * 60 * 60 * 1000)

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const municipalityCode = getRouterParam(event, 'municipality_code')
  if (!municipalityCode) {
    throw createError({ statusCode: 400, message: 'municipality_code é obrigatório' })
  }

  const cached = municipalityCache.get(municipalityCode)
  if (cached) return { success: true, data: cached, cached: true }

  const authHeader = getFocusNfeBasicAuthHeader()
  const apiBaseUrl = getFocusNfeApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredFocusNfeFetch({
    authUserEmail: user.email!,
    functionName: 'getFocusNfeMunicipio',
    url: `${apiBaseUrl}/v2/municipios/${encodeURIComponent(municipalityCode)}`,
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
      data: { error: 'Erro ao consultar município na Focus NFe', details: mapFiscalErrorDetails(raw) }
    })
  }

  const result = mapMunicipalityResult(JSON.parse(responseBodyRaw!) as FocusNfeMunicipio)
  municipalityCache.set(municipalityCode, result)
  return { success: true, data: result }
})
