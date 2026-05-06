import { defineEventHandler, getRouterParam, createError } from 'h3'
import {
  getFocusNfeApiBaseUrl,
  getFocusNfeBasicAuthHeader,
  monitoredFocusNfeFetch,
  createServerCache
} from '../../../utils/focus-nfe'
import { mapZipCodeResult, mapFiscalErrorDetails } from '../../../utils/fiscal-mappers'
import type { FocusNfeCepResponse } from '../../../types/focus-nfe'
import type { ZipCodeResult } from '../../../types/fiscal'

const zipCodeCache = createServerCache<ZipCodeResult>(24 * 60 * 60 * 1000)

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const rawZipCode = getRouterParam(event, 'zip_code')
  if (!rawZipCode) {
    throw createError({ statusCode: 400, message: 'CEP é obrigatório' })
  }

  const zipCode = rawZipCode.replace(/\D/g, '')
  if (zipCode.length !== 8) {
    throw createError({ statusCode: 400, message: 'CEP deve conter 8 dígitos numéricos' })
  }

  const cached = zipCodeCache.get(zipCode)
  if (cached) return { success: true, data: cached, cached: true }

  const authHeader = getFocusNfeBasicAuthHeader()
  const apiBaseUrl = getFocusNfeApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredFocusNfeFetch({
    authUserEmail: user.email!,
    functionName: 'getFocusNfeCep',
    url: `${apiBaseUrl}/v2/ceps/${encodeURIComponent(zipCode)}`,
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
      data: { error: 'Erro ao consultar CEP na Focus NFe', details: mapFiscalErrorDetails(raw) }
    })
  }

  const result = mapZipCodeResult(JSON.parse(responseBodyRaw!) as FocusNfeCepResponse)
  zipCodeCache.set(zipCode, result)
  return { success: true, data: result }
})
