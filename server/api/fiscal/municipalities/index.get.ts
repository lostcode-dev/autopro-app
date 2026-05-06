import { defineEventHandler, getQuery, createError } from 'h3'
import {
  getFocusNfeApiBaseUrl,
  getFocusNfeBasicAuthHeader,
  monitoredFocusNfeFetch
} from '../../../utils/focus-nfe'
import { mapMunicipalityResult, mapFiscalErrorDetails } from '../../../utils/fiscal-mappers'
import type { FocusNfeMunicipio, FocusNfeMunicipioStatusNfse } from '../../../types/focus-nfe'
import type { MunicipalityResult } from '../../../types/fiscal'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const {
    state_code: stateCode,
    municipality_name: municipalityName,
    name,
    nfse_status: nfseStatus,
    offset,
    limit
  } = getQuery(event)

  const params = new URLSearchParams()
  if (stateCode) params.set('sigla_uf', String(stateCode))
  if (municipalityName) params.set('nome_municipio', String(municipalityName))
  if (name) params.set('nome', String(name))
  if (nfseStatus) params.set('status_nfse', String(nfseStatus) as FocusNfeMunicipioStatusNfse)
  if (offset !== undefined) params.set('offset', String(Math.max(0, Number(offset) || 0)))
  if (limit !== undefined) params.set('limit', String(Math.max(1, Number(limit) || 50)))

  const authHeader = getFocusNfeBasicAuthHeader()
  const apiBaseUrl = getFocusNfeApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredFocusNfeFetch({
    authUserEmail: user.email!,
    functionName: 'listFocusNfeMunicipios',
    url: `${apiBaseUrl}/v2/municipios?${params.toString()}`,
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
      data: { error: 'Erro ao listar municípios na Focus NFe', details: mapFiscalErrorDetails(raw) }
    })
  }

  const rawList: FocusNfeMunicipio[] = responseBodyRaw ? JSON.parse(responseBodyRaw) : []
  const results: MunicipalityResult[] = rawList.map(mapMunicipalityResult)
  const total = response.headers.get('x-total-count')
  return { success: true, data: results, total: total ? Number(total) : undefined }
})
