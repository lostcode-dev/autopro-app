import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuthUser } from '../../utils/require-auth'
import {
  getNuvemFiscalApiToken,
  getNuvemFiscalApiBaseUrl,
  monitoredNuvemFiscalFetch,
  sanitizeCpfCnpj,
  normalizeText,
} from '../../utils/nuvem-fiscal'
import { getSupabaseAdminClient } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)

  const body = await readBody(event)
  const {
    organization_id,
    configuracao_id,
    nome_razao_social,
    inscricao_estadual,
    inscricao_municipal,
    nome_fantasia,
    fone,
    email,
    endereco,
  } = body || {}

  if (!organization_id) {
    throw createError({ statusCode: 400, message: 'organization_id é obrigatório' })
  }

  const cpfCnpj = sanitizeCpfCnpj(body?.cpf_cnpj)
  if (!cpfCnpj) {
    throw createError({ statusCode: 400, message: 'cpf_cnpj é obrigatório' })
  }

  if (!normalizeText(nome_razao_social)) {
    throw createError({ statusCode: 400, message: 'nome_razao_social é obrigatório' })
  }

  const apiToken = await getNuvemFiscalApiToken()
  const apiBaseUrl = getNuvemFiscalApiBaseUrl()

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  }

  // Check if company already exists
  const { response: getResp } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: 'syncConfiguracaoNuvemFiscal:check',
    url: `${apiBaseUrl}/empresas/${cpfCnpj}`,
    init: { method: 'GET', headers },
  })

  const companyExists = getResp.ok
  const nfPayload = {
    cpf_cnpj: cpfCnpj,
    nome_razao_social: normalizeText(nome_razao_social),
    inscricao_estadual: normalizeText(inscricao_estadual),
    inscricao_municipal: normalizeText(inscricao_municipal),
    nome_fantasia: normalizeText(nome_fantasia),
    fone: normalizeText(fone),
    email: normalizeText(email),
    endereco: {
      logradouro: normalizeText(endereco?.logradouro),
      numero: normalizeText(endereco?.numero),
      complemento: normalizeText(endereco?.complemento),
      bairro: normalizeText(endereco?.bairro),
      cidade: normalizeText(endereco?.cidade),
      uf: normalizeText(endereco?.uf)?.toUpperCase(),
      cep: sanitizeCpfCnpj(endereco?.cep) || undefined,
      codigo_municipio: normalizeText(endereco?.codigo_municipio),
    },
  }

  // Create or Update
  const method = companyExists ? 'PUT' : 'POST'
  const url = companyExists
    ? `${apiBaseUrl}/empresas/${cpfCnpj}`
    : `${apiBaseUrl}/empresas`

  const { response: saveResp, responseBodyRaw: saveRaw } = await monitoredNuvemFiscalFetch({
    authUserEmail: user.email!,
    functionName: companyExists ? 'syncConfiguracaoNuvemFiscal:update' : 'syncConfiguracaoNuvemFiscal:create',
    url,
    init: { method, headers, body: JSON.stringify(nfPayload) },
  })

  const saveData = saveRaw ? JSON.parse(saveRaw) : null
  const nowIso = new Date().toISOString()

  // Upsert sync status record
  const supabase = getSupabaseAdminClient()
  let syncRecord = null
  try {
    const { data: existing } = await supabase
      .from('fiscal_sync_status')
      .select('*')
      .eq('organization_id', organization_id)
      .maybeSingle()

    const syncData: Record<string, unknown> = {
      organization_id,
      configuracao_id: configuracao_id || undefined,
      nuvem_fiscal_cpf_cnpj: cpfCnpj,
      integration_status: saveResp.ok ? 'active' : 'error',
      empresa_sincronizada: saveResp.ok,
      sync_status: saveResp.ok ? 'synced' : 'error',
      sync_error_message: saveResp.ok ? null : (saveData?.error || saveData?.message || JSON.stringify(saveData)?.slice(0, 500)),
      sync_error_code: saveResp.ok ? null : String(saveResp.status),
      last_synced_at: saveResp.ok ? nowIso : (existing?.last_synced_at || null),
      last_sync_attempt_at: nowIso,
      selected_uf: normalizeText(endereco?.uf)?.toUpperCase() || existing?.selected_uf,
      nuvem_fiscal_response_json: JSON.stringify(saveData)?.slice(0, 5000),
    }

    if (existing?.id) {
      const { data } = await supabase.from('fiscal_sync_status').update(syncData).eq('id', existing.id).select().single()
      syncRecord = data
    } else {
      const { data } = await supabase.from('fiscal_sync_status').insert(syncData).select().single()
      syncRecord = data
    }
  } catch (syncErr: any) {
    console.error('Error upserting sync status:', syncErr)
  }

  if (!saveResp.ok) {
    throw createError({
      statusCode: saveResp.status,
      data: {
        success: false,
        error: companyExists ? 'Erro ao atualizar empresa na Nuvem Fiscal' : 'Erro ao criar empresa na Nuvem Fiscal',
        details: saveData,
        syncRecord,
      },
    })
  }

  return {
    success: true,
    action: companyExists ? 'updated' : 'created',
    data: saveData,
    syncRecord,
  }
})
