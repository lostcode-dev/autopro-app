// @ts-nocheck
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21'

async function getOAuthToken(base44) {
  const authUrl = Deno.env.get('NUVEMFISCAL_AUTH_URL') || 'https://auth.nuvemfiscal.com.br/oauth/token'
  const clientId = Deno.env.get('NUVEMFISCAL_CLIENT_ID') || ''
  const clientSecret = Deno.env.get('NUVEMFISCAL_CLIENT_SECRET') || ''
  const scope = Deno.env.get('NUVEMFISCAL_SCOPE') || ''
  const tokens = await base44.asServiceRole.entities.OAuthToken.filter({ provider: 'nuvemfiscal' })
  const cached = tokens?.[0]
  const MARGIN = 5 * 60 * 1000
  if (cached && Date.now() + MARGIN < new Date(cached.expires_at).getTime()) return cached.access_token
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
    const { invoice_id, motivo } = body

    if (!invoice_id) return Response.json({ error: 'invoice_id é obrigatório' }, { status: 400 })

    const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: invoice_id })
    const invoice = invoices?.[0]
    if (!invoice) return Response.json({ error: 'Invoice não encontrada' }, { status: 404 })

    if (invoice.status === 'cancelada') {
      return Response.json({ error: 'Esta nota já está cancelada' }, { status: 409 })
    }

    const apiBaseUrl = Deno.env.get('NUVEMFISCAL_API_BASE_URL') || 'https://api.nuvemfiscal.com.br'
    const apiToken = await getOAuthToken(base44)

    let nfseData = null
    // Cancelar na Nuvem Fiscal se tiver ID
    if (invoice.nuvem_fiscal_id) {
      const cancelPayload = {}
      if (motivo) cancelPayload.motivo = String(motivo).slice(0, 255)

      const cancelRes = await fetch(`${apiBaseUrl}/nfse/${invoice.nuvem_fiscal_id}/cancelamento`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cancelPayload)
      })
      nfseData = await cancelRes.json().catch(() => ({}))

      if (!cancelRes.ok && cancelRes.status !== 404) {
        return Response.json({ error: 'Erro ao cancelar NFS-e na Nuvem Fiscal', details: nfseData }, { status: cancelRes.status })
      }
    }

    // Atualizar invoice local
    const invoiceAtualizado = await base44.asServiceRole.entities.Invoice.update(invoice_id, {
      status: 'cancelada',
      cancelled_at: new Date().toISOString(),
      cancel_reason: motivo || null,
      cancelled_by: authUser.email,
      resposta_nuvem_fiscal_json: nfseData ? JSON.stringify(nfseData).slice(0, 10000) : invoice.resposta_nuvem_fiscal_json
    })

    // Limpar referência na OS
    if (invoice.service_order_id) {
      const ordens = await base44.entities.OrdemServico.filter({ id: invoice.service_order_id })
      const ordem = ordens?.[0]
      if (ordem && ordem.nfse_active_id === invoice.nuvem_fiscal_id) {
        await base44.entities.OrdemServico.update(invoice.service_order_id, {
          nfse_active_id: null
        })
      }
    }

    return Response.json({ success: true, invoice: invoiceAtualizado, nfse: nfseData })
  } catch (error) {
    console.error('cancelarNotaFiscalOS error:', error)
    return Response.json({ error: 'INTERNAL_ERROR', message: error?.message }, { status: 500 })
  }
})
