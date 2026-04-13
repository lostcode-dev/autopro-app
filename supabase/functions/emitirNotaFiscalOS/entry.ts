// @ts-nocheck
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21'

function sanitizeDoc(v) { return String(v || '').replace(/\D/g, '') }
function normalizeText(v) { if (typeof v !== 'string') return undefined; const t = v.trim(); return t.length > 0 ? t : undefined }

async function getOAuthToken(base44) {
  const authUrl = Deno.env.get('NUVEMFISCAL_AUTH_URL') || 'https://auth.nuvemfiscal.com.br/oauth/token'
  const clientId = Deno.env.get('NUVEMFISCAL_CLIENT_ID') || ''
  const clientSecret = Deno.env.get('NUVEMFISCAL_CLIENT_SECRET') || ''
  const scope = Deno.env.get('NUVEMFISCAL_SCOPE') || ''
  const tokens = await base44.asServiceRole.entities.OAuthToken.filter({ provider: 'nuvemfiscal' })
  const cached = tokens?.[0]
  const MARGIN = 5 * 60 * 1000
  if (cached && Date.now() + MARGIN < new Date(cached.expires_at).getTime()) {
    return cached.access_token
  }
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope }).toString()
  })
  if (!res.ok) throw new Error(`Falha OAuth2: ${await res.text()}`)
  const td = await res.json()
  const expiresAt = new Date(Date.now() + td.expires_in * 1000).toISOString()
  const tp = { provider: 'nuvemfiscal', access_token: td.access_token, token_type: td.token_type ?? 'Bearer', expires_in: td.expires_in, expires_at: expiresAt, scope: td.scope ?? scope }
  if (cached?.id) await base44.asServiceRole.entities.OAuthToken.update(cached.id, tp)
  else await base44.asServiceRole.entities.OAuthToken.create(tp)
  return td.access_token
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const authUser = await base44.auth.me()
    if (!authUser?.email) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { service_order_id, descricao_servico, natureza_operacao, observacoes } = body

    if (!service_order_id) return Response.json({ error: 'service_order_id é obrigatório' }, { status: 400 })

    // Buscar dados da OS
    const ordens = await base44.entities.OrdemServico.filter({ id: service_order_id })
    const ordem = ordens?.[0]
    if (!ordem) return Response.json({ error: 'Ordem de Serviço não encontrada' }, { status: 404 })

    // Validações de negócio
    if (ordem.status_pagamento !== 'pago') {
      return Response.json({ error: 'A OS precisa estar com pagamento registrado para emitir NF' }, { status: 400 })
    }
    if (!ordem.cliente_id) return Response.json({ error: 'OS sem cliente vinculado' }, { status: 400 })
    if (!Array.isArray(ordem.itens) || ordem.itens.length === 0) {
      return Response.json({ error: 'OS sem itens/serviços' }, { status: 400 })
    }

    // Buscar configuração da empresa
    const users = await base44.asServiceRole.entities.User.filter({ email: authUser.email })
    const orgId = users?.[0]?.organization_id
    if (!orgId) return Response.json({ error: 'Organização não encontrada' }, { status: 400 })

    const configs = await base44.asServiceRole.entities.Configuracao.filter({ organization_id: orgId })
    const config = configs?.[0]
    if (!config) return Response.json({ error: 'Configuração da empresa não encontrada' }, { status: 400 })

    const cnpjPrestador = sanitizeDoc(config.cpf_cnpj)
    if (!cnpjPrestador) return Response.json({ error: 'CNPJ da empresa não configurado' }, { status: 400 })

    const codigoMunicipio = normalizeText(config.codigo_municipio)
    if (!codigoMunicipio) return Response.json({ error: 'Código IBGE do município não configurado. Configure em Configurações > Endereço.' }, { status: 400 })

    // Buscar cliente
    const clientes = await base44.entities.Cliente.filter({ id: ordem.cliente_id })
    const cliente = clientes?.[0]
    if (!cliente) return Response.json({ error: 'Cliente não encontrado' }, { status: 404 })

    const ambiente = Deno.env.get('NUVEMFISCAL_AMBIENTE') || 'homologacao'
    const apiBaseUrl = Deno.env.get('NUVEMFISCAL_API_BASE_URL') || 'https://api.nuvemfiscal.com.br'
    const apiToken = await getOAuthToken(base44)

    // Validar município na Nuvem Fiscal
    const cidadeRes = await fetch(`${apiBaseUrl}/nfse/cidades/${codigoMunicipio}`, {
      headers: { Authorization: `Bearer ${apiToken}` }
    })
    if (!cidadeRes.ok) {
      const cidadeErr = await cidadeRes.json().catch(() => ({}))
      return Response.json({ error: `Município (IBGE ${codigoMunicipio}) não suportado para NFS-e na Nuvem Fiscal`, details: cidadeErr }, { status: 400 })
    }
    const cidadeData = await cidadeRes.json()
    if (!cidadeData.ambientes?.includes(ambiente)) {
      return Response.json({ error: `Município não disponível no ambiente ${ambiente}` }, { status: 400 })
    }

    // Montar descrição dos serviços
    const descricao = normalizeText(descricao_servico)
      || ordem.itens.map(i => `${i.descricao} (${i.quantidade}x)`).join(', ')

    const valorTotal = Number(ordem.valor_total) || 0

    // Verificar se já existe invoice ativa para esta OS
    const invoicesExistentes = await base44.asServiceRole.entities.Invoice.filter({
      service_order_id,
      organization_id: orgId
    })
    const invoiceAtiva = invoicesExistentes.find(i => i.status === 'emitida' || i.status === 'processando')
    if (invoiceAtiva) {
      return Response.json({ error: 'Já existe uma nota fiscal emitida para esta OS' }, { status: 409 })
    }

    // Montar toma (tomador = cliente)
    const cpfCnpjCliente = sanitizeDoc(cliente.cpf_cnpj)
    const tomaDoc = cpfCnpjCliente.length === 14 ? { CNPJ: cpfCnpjCliente } : cpfCnpjCliente.length === 11 ? { CPF: cpfCnpjCliente } : { cNaoNIF: 9 }

    const toma = {
      ...tomaDoc,
      xNome: normalizeText(cliente.nome),
      email: normalizeText(cliente.email),
      end: cliente.cep
        ? {
            endNac: {
              cMun: sanitizeDoc(codigoMunicipio),
              CEP: sanitizeDoc(cliente.cep || config.cep)
            },
            xLgr: normalizeText(cliente.logradouro || config.logradouro),
            nro: normalizeText(cliente.numero || config.numero),
            xBairro: normalizeText(cliente.bairro || config.bairro)
          }
        : undefined
    }

    const agora = new Date()
    const dhEmi = agora.toISOString()
    const dCompet = agora.toISOString().split('T')[0]

    const infDPS = {
      tpAmb: ambiente === 'producao' ? 1 : 2,
      dhEmi,
      verAplic: 'MecanicaApp',
      dCompet,
      prest: { CNPJ: cnpjPrestador },
      toma,
      serv: {
        locPrest: { cLocPrestacao: codigoMunicipio },
        cServ: { xDescServ: descricao },
        infoCompl: { xInfComp: normalizeText(observacoes) || `OS #${ordem.numero}` }
      },
      valores: {
        vServPrest: { vServ: valorTotal }
      }
    }

    const nfsePayload = {
      provedor: cidadeData.provedor || 'padrao',
      ambiente,
      referencia: `OS-${ordem.numero}`.slice(0, 50),
      infDPS
    }

    // Salvar invoice em estado "processando"
    const invoiceRecord = await base44.asServiceRole.entities.Invoice.create({
      organization_id: orgId,
      service_order_id,
      service_order_number: ordem.numero,
      client_id: ordem.cliente_id,
      tipo_documento: 'nfse',
      status: 'processando',
      valor_total: valorTotal,
      descricao_servico: descricao,
      natureza_operacao: normalizeText(natureza_operacao) || 'Prestação de Serviços',
      observacoes: normalizeText(observacoes),
      ambiente,
      payload_enviado_json: JSON.stringify(nfsePayload).slice(0, 10000),
      issued_by: authUser.email
    })

    // Emitir NFS-e
    const nfseRes = await fetch(`${apiBaseUrl}/nfse`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(nfsePayload)
    })

    const nfseData = await nfseRes.json().catch(() => ({}))

    if (!nfseRes.ok) {
      await base44.asServiceRole.entities.Invoice.update(invoiceRecord.id, {
        status: 'erro',
        error_message: nfseData?.mensagens?.[0]?.descricao || nfseData?.message || JSON.stringify(nfseData).slice(0, 500),
        resposta_nuvem_fiscal_json: JSON.stringify(nfseData).slice(0, 10000)
      })
      return Response.json({ error: 'Erro ao emitir NFS-e na Nuvem Fiscal', details: nfseData }, { status: nfseRes.status })
    }

    // Atualizar invoice com dados da NFS-e
    const invoiceAtualizado = await base44.asServiceRole.entities.Invoice.update(invoiceRecord.id, {
      status: nfseData.status === 'autorizada' ? 'emitida' : 'processando',
      nuvem_fiscal_id: nfseData.id,
      numero: nfseData.numero,
      codigo_verificacao: nfseData.codigo_verificacao,
      link_url: nfseData.link_url,
      issued_at: new Date().toISOString(),
      resposta_nuvem_fiscal_json: JSON.stringify(nfseData).slice(0, 10000),
      error_message: null
    })

    // Atualizar OS com referência à invoice
    await base44.entities.OrdemServico.update(service_order_id, {
      nfse_active_id: nfseData.id,
      nfse_ids: JSON.stringify([
        ...JSON.parse(ordem.nfse_ids || '[]'),
        nfseData.id
      ]).slice(0, 2000)
    })

    return Response.json({
      success: true,
      invoice: invoiceAtualizado,
      nfse: nfseData
    })
  } catch (error) {
    console.error('emitirNotaFiscalOS error:', error)
    return Response.json({ error: 'INTERNAL_ERROR', message: error?.message }, { status: 500 })
  }
})
