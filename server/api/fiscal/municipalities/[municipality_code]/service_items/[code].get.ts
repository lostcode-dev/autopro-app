import { defineEventHandler, getRouterParam, createError } from 'h3'
import {
  getFocusNfeApiBaseUrl,
  getFocusNfeBasicAuthHeader,
  monitoredFocusNfeFetch,
  createServerCache
} from '../../../../../utils/focus-nfe'
import { mapServiceItemResult, mapFiscalErrorDetails } from '../../../../../utils/fiscal-mappers'
import type { FocusNfeMunicipioItemListaServico } from '../../../../../types/focus-nfe'
import type { ServiceItemResult } from '../../../../../types/fiscal'

const serviceItemCache = createServerCache<ServiceItemResult>(24 * 60 * 60 * 1000)

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const municipalityCode = getRouterParam(event, 'municipality_code')
  const serviceCode = getRouterParam(event, 'code')

  if (!municipalityCode) {
    throw createError({ statusCode: 400, message: 'municipality_code é obrigatório' })
  }
  if (!serviceCode) {
    throw createError({ statusCode: 400, message: 'code é obrigatório' })
  }

  const cacheKey = `${municipalityCode}:${serviceCode}`
  const cached = serviceItemCache.get(cacheKey)
  if (cached) return { success: true, data: cached, cached: true }

  const authHeader = getFocusNfeBasicAuthHeader()
  const apiBaseUrl = getFocusNfeApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredFocusNfeFetch({
    authUserEmail: user.email!,
    functionName: 'getFocusNfeItemListaServico',
    url: `${apiBaseUrl}/v2/municipios/${encodeURIComponent(municipalityCode)}/itens_lista_servico/${encodeURIComponent(serviceCode)}`,
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
      data: { error: 'Erro ao consultar item da lista de serviço na Focus NFe', details: mapFiscalErrorDetails(raw) }
    })
  }

  const result = mapServiceItemResult(JSON.parse(responseBodyRaw!) as FocusNfeMunicipioItemListaServico)
  serviceItemCache.set(cacheKey, result)
  return { success: true, data: result }
})
