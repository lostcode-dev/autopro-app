import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import {
  getFocusNfeApiBaseUrl,
  getFocusNfeBasicAuthHeader,
  monitoredFocusNfeFetch
} from '../../../../../utils/focus-nfe'
import { mapTaxCodeResult, mapFiscalErrorDetails } from '../../../../../utils/fiscal-mappers'
import type { FocusNfeMunicipioCodigoTributario } from '../../../../../types/focus-nfe'
import type { TaxCodeResult } from '../../../../../types/fiscal'

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
    functionName: 'listFocusNfeCodigosTributarios',
    url: `${apiBaseUrl}/v2/municipios/${encodeURIComponent(municipalityCode)}/codigos_tributarios_municipio?${params.toString()}`,
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
      data: { error: 'Erro ao listar códigos tributários na Focus NFe', details: mapFiscalErrorDetails(raw) }
    })
  }

  const rawList: FocusNfeMunicipioCodigoTributario[] = responseBodyRaw ? JSON.parse(responseBodyRaw) : []
  const results: TaxCodeResult[] = rawList.map(mapTaxCodeResult)
  const total = response.headers.get('x-total-count')
  return { success: true, data: results, total: total ? Number(total) : undefined }
})
