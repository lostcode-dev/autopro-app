import { getSupabaseAdminClient } from './supabase'
import type { FocusNfeNfseResponse, FocusNfeNfseStatus } from '../types/focus-nfe'

type NfseDbStatus = 'draft' | 'issued' | 'error' | 'canceled'

function focusNfeStatusToDbStatus(status: FocusNfeNfseStatus): NfseDbStatus {
  if (status === 'erro_autorizacao') return 'error'
  return 'issued'
}

function buildNfseFields(raw: FocusNfeNfseResponse, rawJson: string) {
  return {
    status: focusNfeStatusToDbStatus(raw.status),
    provider_status: raw.status,
    nfse_number: raw.numero ?? null,
    verification_code: raw.codigo_verificacao ?? null,
    issued_at: raw.data_emissao ?? null,
    document_url: raw.url ?? raw.url_danfse ?? null,
    dps_series: raw.serie_rps ?? null,
    dps_number: raw.numero_rps ?? null,
    response_json: rawJson,
    messages_json: raw.erros?.length ? JSON.stringify(raw.erros) : null
  }
}

export interface UpsertNfseParams {
  serviceOrderId: string
  organizationId: string
  payloadJson: string
  rawResponse: FocusNfeNfseResponse
  rawResponseJson: string
  userEmail?: string
}

/**
 * Upserts an NFSe record in service_order_nfse keyed by the FocusNFE reference.
 * Creates the row if it doesn't exist (requires serviceOrderId + organizationId);
 * otherwise updates only the FocusNFE-specific fields.
 * Returns the record id.
 */
export async function upsertNfseRecord(params: UpsertNfseParams): Promise<string | null> {
  const supabase = getSupabaseAdminClient()
  const reference = params.rawResponse.ref
  const fields = buildNfseFields(params.rawResponse, params.rawResponseJson)

  const { data: existing } = await supabase
    .from('service_order_nfse')
    .select('id')
    .eq('provider_reference', reference)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('service_order_nfse')
      .update({ ...fields, updated_by: params.userEmail ?? null })
      .eq('id', existing.id)
    return existing.id
  }

  const { data: inserted } = await supabase
    .from('service_order_nfse')
    .insert({
      service_order_id: params.serviceOrderId,
      organization_id: params.organizationId,
      provider_reference: reference,
      payload_json: params.payloadJson,
      created_by: params.userEmail ?? null,
      ...fields
    })
    .select('id')
    .single()

  return inserted?.id ?? null
}

/**
 * Updates an existing NFSe record with fresh data from the FocusNFE API.
 * No-op if no matching row is found (reference not yet in DB).
 */
export async function syncNfseFromApi(
  reference: string,
  rawResponse: FocusNfeNfseResponse,
  rawResponseJson: string
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const fields = buildNfseFields(rawResponse, rawResponseJson)

  await supabase
    .from('service_order_nfse')
    .update(fields)
    .eq('provider_reference', reference)
    .is('deleted_at', null)
}

/**
 * Marks an NFSe record as cancelled after a successful FocusNFE cancel call.
 */
export async function markNfseDbCancelled(reference: string, rawCancelJson?: string): Promise<void> {
  const supabase = getSupabaseAdminClient()

  await supabase
    .from('service_order_nfse')
    .update({
      status: 'canceled',
      provider_status: 'cancelado',
      cancellation_json: rawCancelJson ?? null
    })
    .eq('provider_reference', reference)
    .is('deleted_at', null)
}
