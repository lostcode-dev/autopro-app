import { defineEventHandler, createError } from 'h3'
import { requireAuthUser } from '../../utils/require-auth'
import {
  NUVEM_FISCAL_OWNER_EMAIL,
  resolveOrganizationIdByEmail
} from '../../utils/nuvem-fiscal'
import { getSupabaseAdminClient } from '../../utils/supabase'

const ENDPOINTS = [
  { function_name: 'createNuvemFiscalEmpresa', method: 'POST', path: '/empresas', integration: 'empresas' },
  { function_name: 'getNuvemFiscalEmpresa', method: 'GET', path: '/empresas/{cpf_cnpj}', integration: 'empresas' },
  { function_name: 'updateNuvemFiscalEmpresa', method: 'GET', path: '/empresas/{cpf_cnpj}', integration: 'empresas', description: 'Carrega dados atuais para merge' },
  { function_name: 'updateNuvemFiscalEmpresa', method: 'PUT', path: '/empresas/{cpf_cnpj}', integration: 'empresas' },
  { function_name: 'deleteNuvemFiscalEmpresa', method: 'DELETE', path: '/empresas/{cpf_cnpj}', integration: 'empresas' },
  { function_name: 'getNuvemFiscalCertificadoEmpresa', method: 'GET', path: '/empresas/{cpf_cnpj}/certificado', integration: 'certificado' },
  { function_name: 'upsertNuvemFiscalCertificadoEmpresa', method: 'PUT', path: '/empresas/{cpf_cnpj}/certificado', integration: 'certificado' },
  { function_name: 'deleteNuvemFiscalCertificadoEmpresa', method: 'DELETE', path: '/empresas/{cpf_cnpj}/certificado', integration: 'certificado' },
  { function_name: 'listNuvemFiscalEmpresas', method: 'GET', path: '/empresas', integration: 'empresas' },
  { function_name: 'listNuvemFiscalCotas', method: 'GET', path: '/conta/cotas', integration: 'conta' },
  { function_name: 'createNuvemFiscalNfe', method: 'POST', path: '/nfe', integration: 'nfe' },
  { function_name: 'listNuvemFiscalNfe', method: 'GET', path: '/nfe', integration: 'nfe' },
  { function_name: 'getNuvemFiscalNfe', method: 'GET', path: '/nfe/{id}', integration: 'nfe' },
  { function_name: 'syncNuvemFiscalNfe', method: 'POST', path: '/nfe/{id}/sincronizar', integration: 'nfe' },
  { function_name: 'cancelNuvemFiscalNfe', method: 'POST', path: '/nfe/{id}/cancelamento', integration: 'nfe' },
  { function_name: 'getNuvemFiscalNfeCancelamento', method: 'GET', path: '/nfe/{id}/cancelamento', integration: 'nfe' },
  { function_name: 'downloadNuvemFiscalNfeCancelamentoPdf', method: 'GET', path: '/nfe/{id}/cancelamento/pdf', integration: 'nfe' },
  { function_name: 'createNuvemFiscalNfeCartaCorrecao', method: 'POST', path: '/nfe/{id}/carta-correcao', integration: 'nfe' },
  { function_name: 'getNuvemFiscalNfeCartaCorrecao', method: 'GET', path: '/nfe/{id}/carta-correcao', integration: 'nfe' },
  { function_name: 'downloadNuvemFiscalNfeCartaCorrecaoPdf', method: 'GET', path: '/nfe/{id}/carta-correcao/pdf', integration: 'nfe' },
  { function_name: 'createNuvemFiscalNfeInutilizacao', method: 'POST', path: '/nfe/inutilizacoes', integration: 'nfe' },
  { function_name: 'getNuvemFiscalNfeInutilizacao', method: 'GET', path: '/nfe/inutilizacoes/{id}', integration: 'nfe' },
  { function_name: 'downloadNuvemFiscalNfeInutilizacaoPdf', method: 'GET', path: '/nfe/inutilizacoes/{id}/pdf', integration: 'nfe' },
  { function_name: 'listNuvemFiscalNfeEventos', method: 'GET', path: '/nfe/eventos', integration: 'nfe' },
  { function_name: 'getNuvemFiscalNfeEvento', method: 'GET', path: '/nfe/eventos/{id}', integration: 'nfe' },
  { function_name: 'downloadNuvemFiscalNfeEventoPdf', method: 'GET', path: '/nfe/eventos/{id}/pdf', integration: 'nfe' },
  { function_name: 'downloadNuvemFiscalNfeDanfePdf', method: 'GET', path: '/nfe/{id}/pdf', integration: 'nfe' },
  { function_name: 'sendNuvemFiscalNfeEmail', method: 'POST', path: '/nfe/{id}/email', integration: 'nfe' },
  { function_name: 'getNuvemFiscalNfeContribuinte', method: 'GET', path: '/nfe/cadastro-contribuinte', integration: 'nfe' },
  { function_name: 'createNuvemFiscalNfse', method: 'POST', path: '/nfse', integration: 'nfse' },
  { function_name: 'listNuvemFiscalNfse', method: 'GET', path: '/nfse', integration: 'nfse' },
  { function_name: 'getNuvemFiscalNfse', method: 'GET', path: '/nfse/{id}', integration: 'nfse' },
  { function_name: 'updateNuvemFiscalNfse', method: 'PUT', path: '/nfse/{id}', integration: 'nfse' },
  { function_name: 'deleteNuvemFiscalNfse', method: 'DELETE', path: '/nfse/{id}', integration: 'nfse' },
  { function_name: 'syncNuvemFiscalNfse', method: 'POST', path: '/nfse/{id}/sincronizar', integration: 'nfse' },
  { function_name: 'cancelNuvemFiscalNfse', method: 'POST', path: '/nfse/{id}/cancelamento', integration: 'nfse' },
  { function_name: 'getNuvemFiscalNfseCancelamento', method: 'GET', path: '/nfse/{id}/cancelamento', integration: 'nfse' },
  { function_name: 'downloadNuvemFiscalNfsePdf', method: 'GET', path: '/nfse/{id}/pdf', integration: 'nfse' },
  { function_name: 'listNuvemFiscalNfseCidades', method: 'GET', path: '/nfse/cidades', integration: 'nfse' },
  { function_name: 'getNuvemFiscalNfseCidadeMetadados', method: 'GET', path: '/nfse/cidades/{codigo_ibge}', integration: 'nfse' }
]

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event)
  if (user.email !== NUVEM_FISCAL_OWNER_EMAIL) {
    throw createError({ statusCode: 403, message: 'Acesso negado' })
  }

  const organizationId = await resolveOrganizationIdByEmail(user.email!)
  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'organization_id não encontrado para o usuário atual' })
  }

  const supabase = getSupabaseAdminClient()
  const results: Array<{ function_name: string, status: string, id?: string }> = []

  for (const endpoint of ENDPOINTS) {
    try {
      const { data: existing } = await supabase
        .from('fiscal_integration_endpoints')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('function_name', endpoint.function_name)
        .eq('method', endpoint.method)
        .eq('path', endpoint.path)
        .maybeSingle()

      const payload = {
        organization_id: organizationId,
        function_name: endpoint.function_name,
        method: endpoint.method,
        path: endpoint.path,
        integration: endpoint.integration,
        description: (endpoint as any).description || null,
        is_active: true,
        source: 'api_routes'
      }

      if (existing?.id) {
        await supabase.from('fiscal_integration_endpoints').update(payload).eq('id', existing.id)
        results.push({ function_name: endpoint.function_name, status: 'updated', id: existing.id })
      } else {
        const { data: created } = await supabase
          .from('fiscal_integration_endpoints')
          .insert(payload)
          .select('id')
          .single()
        results.push({ function_name: endpoint.function_name, status: 'created', id: created?.id })
      }
    } catch {
      results.push({ function_name: endpoint.function_name, status: 'skipped' })
    }
  }

  return {
    success: true,
    data: { organization_id: organizationId, count: results.length, results }
  }
})
