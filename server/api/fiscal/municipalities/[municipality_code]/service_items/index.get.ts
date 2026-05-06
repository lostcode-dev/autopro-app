import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import {
  getFocusNfeApiBaseUrl,
  getFocusNfeBasicAuthHeader,
  monitoredFocusNfeFetch
} from '../../../../../utils/focus-nfe'
import { mapServiceItemResult, mapFiscalErrorDetails } from '../../../../../utils/fiscal-mappers'
import type { FocusNfeMunicipioItemListaServico } from '../../../../../types/focus-nfe'
import type { ServiceItemResult } from '../../../../../types/fiscal'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const municipalityCode = getRouterParam(event, 'municipality_code')
  if (!municipalityCode) {
    throw createError({ statusCode: 400, message: 'municipality_code é obrigatório' })
  }

  const { code, description, offset, limit } = getQuery(event)

  const params = new URLSearchParams()
  if (code) params.set('codigo', String(code))
  if (description) params.set('descricao', String(description))
  if (offset !== undefined) params.set('offset', String(Math.max(0, Number(offset) || 0)))
  if (limit !== undefined) params.set('limit', String(Math.max(1, Number(limit) || 50)))

  const authHeader = getFocusNfeBasicAuthHeader()
  const apiBaseUrl = getFocusNfeApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredFocusNfeFetch({
    authUserEmail: user.email!,
    functionName: 'listFocusNfeItensListaServico',
    url: `${apiBaseUrl}/v2/municipios/${encodeURIComponent(municipalityCode)}/itens_lista_servico?${params.toString()}`,
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
      data: { error: 'Erro ao listar itens da lista de serviço na Focus NFe', details: mapFiscalErrorDetails(raw) }
    })
  }

  const rawList: FocusNfeMunicipioItemListaServico[] = responseBodyRaw ? JSON.parse(responseBodyRaw) : []
  const results: ServiceItemResult[] = rawList.map(mapServiceItemResult)
  const total = response.headers.get('x-total-count')
  return { success: true, data: results, total: total ? Number(total) : undefined }
})
