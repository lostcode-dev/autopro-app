// ─── Error types ──────────────────────────────────────────────────────────────

export interface FiscalApiError {
  code: string
  message: string
}

export interface FiscalApiValidationDetail {
  code: string
  message: string
  field: string
}

export interface FiscalApiValidationError {
  code: string
  message: string
  errors: FiscalApiValidationDetail[]
}

// ─── Zip Code ─────────────────────────────────────────────────────────────────

export type ZipCodeType = 'locality' | 'street' | 'operational_unit' | 'large_user'

export interface ZipCodeResult {
  zip_code: string
  type: ZipCodeType
  name: string
  state: string
  locality_name: string
  ibge_code: string
  street_type: string
  street_name: string
  neighborhood: string
  description: string
}

// ─── Business ID (CNPJ) ───────────────────────────────────────────────────────

export interface BusinessAddress {
  municipality_code: string
  siafi_code: string
  ibge_code: string
  municipality_name: string
  street: string
  complement: string
  number: string
  neighborhood: string
  zip_code: string
  state: string
}

export interface BusinessIdResult {
  business_id: string
  company_name: string
  registration_status: string
  primary_activity_code: string
  simple_national: boolean
  mei: boolean
  address: BusinessAddress
}

// ─── Municipality ─────────────────────────────────────────────────────────────

export type MunicipalityNfseStatus
  = | 'active'
    | 'offline'
    | 'paused'
    | 'in_implementation'
    | 'in_reimplementation'
    | 'inactive'
    | 'not_implemented'

export interface MunicipalityResult {
  municipality_code: string
  municipality_name: string
  state_code: string
  state_name: string
  nfse_enabled: boolean
  nfse_requires_certificate: boolean | null
  nfse_has_sandbox: boolean | null
  nfse_supports_cancellation: boolean | null
  nfse_provider: string | null
  nfse_address_required: boolean | null
  nfse_business_id_required: boolean | null
  nfse_cnae_required: boolean | null
  nfse_service_item_required: boolean | null
  nfse_tax_code_required: boolean | null
  nfse_status: MunicipalityNfseStatus
  nfse_reimplementation_date: string | null
  last_nfse_issued_at: string | null
}

// ─── Service Item ─────────────────────────────────────────────────────────────

export interface ServiceItemResult {
  code: string
  description: string
  tax_rate: string | null
}

// ─── Tax Code ─────────────────────────────────────────────────────────────────

export interface TaxCodeResult {
  code: string
  description: string
  [key: string]: unknown
}

// ─── Company ──────────────────────────────────────────────────────────────────
//
// CompanyFields: shared optional fields between CompanyInput and CompanyResult.
// Fields whose *type* differs between input and response (e.g. number vs string)
// are NOT included here; they are declared separately in each interface.

interface CompanyFields {
  // ── Identity / address ────────────────────────────────────────────────────
  name?: string | null
  trade_name?: string | null
  business_id?: string | null
  individual_id?: string | null
  street?: string | null
  complement?: string | null
  municipality?: string | null
  neighborhood?: string | null
  state?: string | null
  phone?: string | null
  email?: string | null
  accountant_id?: string | null
  contact_name?: string | null
  contact_id?: string | null
  contact_login?: string | null
  nfe_receiving_start_date?: string | null
  cte_receiving_start_date?: string | null

  // ── Feature flags ─────────────────────────────────────────────────────────
  send_email_to_recipient?: boolean
  itemize_taxes?: boolean
  nfe_enabled?: boolean
  nfce_enabled?: boolean
  nfse_enabled?: boolean
  nfsen_production_enabled?: boolean
  nfsen_sandbox_enabled?: boolean
  cte_enabled?: boolean
  mdfe_enabled?: boolean
  manifestation_enabled?: boolean
  cte_manifestation_enabled?: boolean
  nfcom_enabled?: boolean
  dce_enabled?: boolean
  nfce_offline_contingency_enabled?: boolean
  nfce_contingency_reuse_number?: boolean
  danfse_badge_visible?: boolean
  send_sandbox_emails?: boolean
  nfe_sync?: boolean
  nfe_sync_sandbox?: boolean
  mdfe_sync?: boolean
  mdfe_sync_sandbox?: boolean
  contact_password_set?: boolean

  // ── DANFE display ─────────────────────────────────────────────────────────
  danfe_orientation?: 'portrait' | 'landscape' | null
  danfe_receipt?: boolean
  danfe_always_show_ipi?: boolean
  danfe_show_issqn?: boolean
  danfe_show_additional_taxes?: boolean
  danfe_show_trace?: boolean
  danfe_show_tax_unit?: boolean
  danfe_always_show_volumes?: boolean
  mdfe_show_cargo_breakdown?: boolean

  // ── SMTP ──────────────────────────────────────────────────────────────────
  smtp_host?: string | null
  smtp_domain?: string | null
  smtp_auth?: string | null
  smtp_login?: string | null
  smtp_sender?: string | null
  smtp_reply_to?: string | null
  smtp_ssl_verification?: string | null
  smtp_ssl?: boolean
  smtp_tls?: boolean

  // ── NFCe CSC ──────────────────────────────────────────────────────────────
  nfce_csc_production?: string | null
  nfce_csc_sandbox?: string | null

  // ── Series / next numbers ─────────────────────────────────────────────────
  nfe_next_number_production?: string | null
  nfe_next_number_sandbox?: string | null
  nfe_series_production?: string | null
  nfe_series_sandbox?: string | null
  nfce_next_number_production?: string | null
  nfce_next_number_sandbox?: string | null
  nfce_series_production?: string | null
  nfce_series_sandbox?: string | null
  nfse_next_number_production?: string | null
  nfse_next_number_sandbox?: string | null
  nfse_series_production?: string | null
  nfse_series_sandbox?: string | null
  nfsen_next_number_production?: string | null
  nfsen_next_number_sandbox?: string | null
  nfsen_series_production?: string | null
  nfsen_series_sandbox?: string | null
  cte_next_number_production?: string | null
  cte_next_number_sandbox?: string | null
  cte_series_production?: string | null
  cte_series_sandbox?: string | null
  cte_os_next_number_production?: string | null
  cte_os_next_number_sandbox?: string | null
  cte_os_series_production?: string | null
  cte_os_series_sandbox?: string | null
  mdfe_next_number_production?: string | null
  mdfe_next_number_sandbox?: string | null
  mdfe_series_production?: string | null
  mdfe_series_sandbox?: string | null
  nfcom_next_number_production?: string | null
  nfcom_next_number_sandbox?: string | null
  nfcom_series_production?: string | null
  nfcom_series_sandbox?: string | null
  dce_next_number_production?: string | null
  dce_next_number_sandbox?: string | null
  dce_series_production?: string | null
  dce_series_sandbox?: string | null
}

export interface CompanyInput extends CompanyFields {
  // Overrides: sent as integer (FocusNFE expects numbers on create/update)
  state_registration?: number
  municipal_registration?: number
  tax_regime?: number
  address_number?: number
  zip_code?: number
  smtp_port?: number
  nfce_token_id_production?: number
  nfce_token_id_sandbox?: number

  // Narrowed enum overrides
  smtp_auth?: 'plain' | 'login' | 'cram_md5'
  smtp_ssl_verification?: 'peer' | 'none'
  danfe_orientation?: 'portrait' | 'landscape'

  // Write-only fields (not returned in responses)
  certificate_base64?: string
  certificate_password?: string
  logo_base64?: string
  delete_logo?: boolean
  contact_password?: string
  smtp_password?: string
  smtp_starttls_enabled?: boolean
  nfsen_received_production_enabled?: boolean
  nfsen_received_sandbox_enabled?: boolean
}

export interface CompanyResult extends CompanyFields {
  id: number

  // Overrides: numbers in input, strings in responses
  state_registration: string
  municipal_registration: string
  tax_regime: string
  address_number: string
  zip_code: string
  smtp_port: string | null
  nfce_token_id_production: string | null
  nfce_token_id_sandbox: string | null

  // Read-only fields (not in CompanyInput)
  municipality_code: string
  country_code: string
  state_code: string
  country: string
  contact_role: string | null
  nfce_epec_contingency_enabled: boolean
  manifestation_sandbox_enabled: boolean
  cte_manifestation_sandbox_enabled: boolean
  certificate_valid_until: string | null
  certificate_valid_from: string | null
  certificate_business_id: string | null
  certificate_specific: boolean
  last_issued_at: string | null
  logo_url: string | null
  danfe_show_invoice: boolean
  danfe_show_item_discount: boolean
  nfe_csrt_enabled: boolean
  smtp_starttls_enabled: boolean
  token_production: string
  token_sandbox: string
}

// ─── NFSe ─────────────────────────────────────────────────────────────────────

export type NfseStatus
  = | 'processing_authorization'
    | 'authorized'
    | 'cancelled'
    | 'authorization_error'

export interface NfseError {
  code: string
  message: string
  correction: string | null
}

export interface NfseResult {
  provider_business_id: string
  reference: string
  rps_number: string | null
  rps_series: string | null
  rps_type: string | null
  status: NfseStatus
  number?: string | null
  verification_code?: string | null
  issued_at?: string | null
  url?: string | null
  xml_path?: string | null
  pdf_url?: string | null
  cancellation_xml_path?: string | null
  errors?: NfseError[]
}

export interface NfseCancelResult {
  status: 'cancelled' | 'cancellation_error'
  errors?: NfseError[]
}

export interface WebhookTrigger {
  id: string
  url: string
  authorization: string | null
  authorization_header: string | null
  event: string
  business_id?: string
  individual_id?: string
}

export interface NfseServiceInput {
  description: string
  service_value: number
  deductions_value?: number
  pis_value?: number
  cofins_value?: number
  inss_value?: number
  ir_value?: number
  csll_value?: number
  iss_withheld?: boolean
  iss_value?: number
  iss_withheld_value?: number
  tax_base?: number
  tax_rate?: number
  net_value?: number
  other_deductions?: number
  unconditional_discount?: number
  conditional_discount?: number
  service_list_item?: string
  municipal_tax_code?: string
  cnae_code?: string
  total_tax_rate?: number
  total_tax_source?: string
  municipality_code?: string
  country_code?: string
}

export interface NfseTakerAddressInput {
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  municipality_code?: string
  state?: string
  zip_code?: string
  country_code?: string
}

export interface NfseTakerContactInput {
  phone?: string
  email?: string
}

export interface NfseTakerInput {
  business_id?: string
  individual_id?: string
  municipal_registration?: string
  company_name?: string
  address?: NfseTakerAddressInput
  contact?: NfseTakerContactInput
}

export interface NfseInput {
  reference: string
  service_order_id?: string
  organization_id?: string
  issued_at?: string
  provider_business_id?: string
  provider_individual_id?: string
  operation_nature?: number
  special_tax_regime?: number
  simple_national?: boolean
  cultural_incentive?: boolean
  service: NfseServiceInput
  taker?: NfseTakerInput
  email?: string
  emails?: string[]
}
