export type NfseRow = {
  id: string
  service_order_id: string | null
  organization_id: string | null
  status: string
  service_order_number: string | null
  provider_nfse_id: string | null
  provider_status: string | null
  nfse_number: string | null
  verification_code: string | null
  issued_at: string | null
  environment: string | null
  provider_reference: string
  dps_series: string | null
  dps_number: string | null
  document_url: string | null
  last_error_message: string | null
  last_error_at: string | null
  created_at: string
  updated_at: string
}

export type NfseDetail = {
  reference: string
  status: string
  nfse_number: string | null
  verification_code: string | null
  issued_at: string | null
  environment: string | null
  document_url: string | null
  taker_name: string | null
  taker_id: string | null
  taker_email: string | null
  services_amount: number | null
  deductions_amount: number | null
  iss_amount: number | null
  effective_rate: number | null
  services_description: string | null
  service_item_code: string | null
  errors: Array<{ code: string, message: string, correction: string | null }>
}

export type SyncStatusOrganization = {
  id: string
  name: string
  tax_id: string | null
  phone: string | null
  email: string | null
  state_registration: string | null
  street: string | null
  address_number: string | null
  address_complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  municipality_code: string | null
}

export type SyncStatusResponse = {
  success: boolean
  is_synced: boolean
  organization_id: string
  sync: {
    tax_id: string | null
    integration_status: string | null
    sync_status: string | null
    sync_error_message: string | null
    last_synced_at: string | null
    last_sync_attempt_at: string | null
    selected_state: string | null
    contact_name: string | null
    contact_cpf: string | null
  } | null
  organization: SyncStatusOrganization
}
