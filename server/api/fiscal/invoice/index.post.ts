import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuthUser } from '../../../utils/require-auth'
import {
  NUVEM_FISCAL_OWNER_EMAIL,
  getNuvemFiscalApiToken,
  getNuvemFiscalApiBaseUrl,
  monitoredNuvemFiscalFetch,
  resolveCompanyDocument,
  normalizeText
} from '../../../utils/nuvem-fiscal'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (user.email !== NUVEM_FISCAL_OWNER_EMAIL) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const body = await readBody(event)
  const inputData = body?.data ?? body
  if (!inputData || typeof inputData !== 'object') {
    throw createError({ statusCode: 400, message: 'Payload da NF-e é obrigatório' })
  }
  if (!inputData.infNFe?.ide) {
    throw createError({ statusCode: 400, message: 'Campo obrigatório: infNFe.ide' })
  }
  if (!inputData.infNFe?.emit) {
    throw createError({ statusCode: 400, message: 'Campo obrigatório: infNFe.emit' })
  }
  if (!Array.isArray(inputData.infNFe?.det) || inputData.infNFe.det.length === 0) {
    throw createError({ statusCode: 400, message: 'Campo obrigatório: infNFe.det com ao menos 1 item' })
  }
  if (!inputData.infNFe?.total) {
    throw createError({ statusCode: 400, message: 'Campo obrigatório: infNFe.total' })
  }
  if (!inputData.infNFe?.transp) {
    throw createError({ statusCode: 400, message: 'Campo obrigatório: infNFe.transp' })
  }
  if (!inputData.infNFe?.pag) {
    throw createError({ statusCode: 400, message: 'Campo obrigatório: infNFe.pag' })
  }

  const ambienteFromEnv = normalizeText(process.env.NUVEMFISCAL_AMBIENTE) as 'homologacao' | 'producao' | undefined
  if (ambienteFromEnv !== 'homologacao' && ambienteFromEnv !== 'producao') {
    throw createError({ statusCode: 500, message: 'NUVEMFISCAL_AMBIENTE inválido ou não configurado' })
  }

  const companyDocument = await resolveCompanyDocument(user.id)
  if (!companyDocument) {
    throw createError({ statusCode: 400, message: 'Não foi possível identificar o CPF/CNPJ da empresa' })
  }

  const payload = {
    ...inputData,
    ambiente: ambienteFromEnv,
    infNFe: {
      ...inputData.infNFe,
      ide: { ...inputData.infNFe.ide, tpAmb: ambienteFromEnv === 'producao' ? 1 : 2 },
      emit: { ...inputData.infNFe.emit, CNPJ: companyDocument }
    }
  }

  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const { response, responseBodyRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'createNuvemFiscalNfe',
    url: `${apiBaseUrl}/nfe`,
    init: {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  })

  const data = responseBodyRaw ? JSON.parse(responseBodyRaw) : null

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      data: { error: 'Erro ao emitir NF-e na Nuvem Fiscal', details: data }
    })
  }

  return { success: true, data }
})
