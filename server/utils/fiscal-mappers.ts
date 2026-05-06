import type {
  FocusNfeCepResponse,
  FocusNfeCnpjResponse,
  FocusNfeMunicipio,
  FocusNfeMunicipioStatusNfse,
  FocusNfeMunicipioItemListaServico,
  FocusNfeMunicipioCodigoTributario,
  FocusNfeEmpresaCreate,
  FocusNfeEmpresaResponse,
  FocusNfeErrorResponse,
  FocusNfeValidationErrorResponse,
  FocusNfeNfseStatus,
  FocusNfeNfseErro,
  FocusNfeNfseResponse,
  FocusNfeNfseCancelResponse,
  FocusNfeHookTrigger,
  FocusNfeNfseCreate
} from '../types/focus-nfe'
import type {
  ZipCodeResult,
  ZipCodeType,
  BusinessIdResult,
  MunicipalityResult,
  MunicipalityNfseStatus,
  ServiceItemResult,
  TaxCodeResult,
  CompanyResult,
  CompanyInput,
  FiscalApiError,
  FiscalApiValidationError,
  NfseStatus,
  NfseError,
  NfseResult,
  NfseCancelResult,
  WebhookTrigger,
  NfseInput
} from '../types/fiscal'

// ─── Error mappers ────────────────────────────────────────────────────────────

export function mapFiscalApiError(raw: FocusNfeErrorResponse): FiscalApiError {
  return { code: raw.codigo, message: raw.mensagem }
}

export function mapFiscalApiValidationError(raw: FocusNfeValidationErrorResponse): FiscalApiValidationError {
  return {
    code: raw.codigo,
    message: raw.mensagem,
    errors: raw.erros.map(e => ({ code: e.codigo, message: e.mensagem, field: e.campo }))
  }
}

export function mapFiscalErrorDetails(raw: unknown): FiscalApiError | FiscalApiValidationError | unknown {
  if (!raw || typeof raw !== 'object') return raw
  const obj = raw as Record<string, unknown>
  if ('erros' in obj && Array.isArray(obj.erros)) {
    return mapFiscalApiValidationError(raw as FocusNfeValidationErrorResponse)
  }
  if ('codigo' in obj && 'mensagem' in obj) {
    return mapFiscalApiError(raw as FocusNfeErrorResponse)
  }
  return raw
}

// ─── Zip Code ─────────────────────────────────────────────────────────────────

const ZIP_CODE_TYPE_MAP: Record<string, ZipCodeType> = {
  localidade: 'locality',
  logradouro: 'street',
  unidade_operacional: 'operational_unit',
  grande_usuario: 'large_user'
}

export function mapZipCodeResult(raw: FocusNfeCepResponse): ZipCodeResult {
  return {
    zip_code: raw.cep,
    type: ZIP_CODE_TYPE_MAP[raw.tipo] ?? 'locality',
    name: raw.nome,
    state: raw.uf,
    locality_name: raw.nome_localidade,
    ibge_code: raw.codigo_ibge,
    street_type: raw.tipo_logradouro,
    street_name: raw.nome_logradouro,
    neighborhood: raw.bairro,
    description: raw.descricao
  }
}

// ─── Business ID (CNPJ) ───────────────────────────────────────────────────────

export function mapBusinessIdResult(raw: FocusNfeCnpjResponse): BusinessIdResult {
  return {
    business_id: raw.cnpj,
    company_name: raw.razao_social,
    registration_status: raw.situacao_cadastral,
    primary_activity_code: raw.cnae_principal,
    simple_national: raw.optante_simples_nacional,
    mei: raw.optante_mei,
    address: {
      municipality_code: raw.endereco.codigo_municipio,
      siafi_code: raw.endereco.codigo_siafi,
      ibge_code: raw.endereco.codigo_ibge,
      municipality_name: raw.endereco.nome_municipio,
      street: raw.endereco.logradouro,
      complement: raw.endereco.complemento,
      number: raw.endereco.numero,
      neighborhood: raw.endereco.bairro,
      zip_code: raw.endereco.cep,
      state: raw.endereco.uf
    }
  }
}

// ─── Municipality ─────────────────────────────────────────────────────────────

const NFSE_STATUS_MAP: Record<FocusNfeMunicipioStatusNfse, MunicipalityNfseStatus> = {
  ativo: 'active',
  fora_do_ar: 'offline',
  pausado: 'paused',
  em_implementacao: 'in_implementation',
  em_reimplementacao: 'in_reimplementation',
  inativo: 'inactive',
  nao_implementado: 'not_implemented'
}

export function mapMunicipalityResult(raw: FocusNfeMunicipio): MunicipalityResult {
  return {
    municipality_code: raw.codigo_municipio,
    municipality_name: raw.nome_municipio,
    state_code: raw.sigla_uf,
    state_name: raw.nome_uf,
    nfse_enabled: raw.nfse_habilitada,
    nfse_requires_certificate: raw.requer_certificado_nfse ?? null,
    nfse_has_sandbox: raw.possui_ambiente_homologacao_nfse ?? null,
    nfse_supports_cancellation: raw.possui_cancelamento_nfse ?? null,
    nfse_provider: raw.provedor_nfse ?? null,
    nfse_address_required: raw.endereco_obrigatorio_nfse ?? null,
    nfse_business_id_required: raw.cpf_cnpj_obrigatorio_nfse ?? null,
    nfse_cnae_required: raw.codigo_cnae_obrigatorio_nfse ?? null,
    nfse_service_item_required: raw.item_lista_servico_obrigatorio_nfse ?? null,
    nfse_tax_code_required: raw.codigo_tributario_municipio_obrigatorio_nfse ?? null,
    nfse_status: NFSE_STATUS_MAP[raw.status_nfse],
    nfse_reimplementation_date: raw.data_previsao_reimplementacao_nfse,
    last_nfse_issued_at: raw.ultima_emissao_nfse
  }
}

// ─── Service Item ─────────────────────────────────────────────────────────────

export function mapServiceItemResult(raw: FocusNfeMunicipioItemListaServico): ServiceItemResult {
  return {
    code: raw.codigo,
    description: raw.descricao,
    tax_rate: raw.tax_rate
  }
}

// ─── Tax Code ─────────────────────────────────────────────────────────────────

export function mapTaxCodeResult(raw: FocusNfeMunicipioCodigoTributario): TaxCodeResult {
  const { codigo, descricao, ...rest } = raw
  return { code: codigo, description: descricao, ...rest }
}

// ─── Company ──────────────────────────────────────────────────────────────────

export function mapCompanyResult(raw: FocusNfeEmpresaResponse): CompanyResult {
  return {
    id: raw.id,
    // Identity / address
    name: raw.nome,
    trade_name: raw.nome_fantasia,
    business_id: raw.cnpj,
    individual_id: raw.cpf,
    street: raw.logradouro,
    complement: raw.complemento,
    municipality: raw.municipio,
    neighborhood: raw.bairro,
    state: raw.uf,
    phone: raw.telefone,
    email: raw.email,
    accountant_id: raw.cpf_cnpj_contabilidade,
    contact_name: raw.nome_responsavel,
    contact_id: raw.cpf_responsavel,
    contact_login: raw.login_responsavel,
    nfe_receiving_start_date: raw.data_inicio_recebimento_nfe,
    cte_receiving_start_date: raw.data_inicio_recebimento_cte,
    // Feature flags
    send_email_to_recipient: raw.enviar_email_destinatario,
    itemize_taxes: raw.discrimina_impostos,
    nfe_enabled: raw.habilita_nfe,
    nfce_enabled: raw.habilita_nfce,
    nfse_enabled: raw.habilita_nfse,
    nfsen_production_enabled: raw.habilita_nfsen_producao,
    nfsen_sandbox_enabled: raw.habilita_nfsen_homologacao,
    cte_enabled: raw.habilita_cte,
    mdfe_enabled: raw.habilita_mdfe,
    manifestation_enabled: raw.habilita_manifestacao,
    cte_manifestation_enabled: raw.habilita_manifestacao_cte,
    nfcom_enabled: raw.habilita_nfcom,
    dce_enabled: raw.habilita_dce,
    nfce_offline_contingency_enabled: raw.habilita_contingencia_offline_nfce,
    nfce_contingency_reuse_number: raw.reaproveita_numero_nfce_contingencia,
    danfse_badge_visible: raw.mostrar_danfse_badge,
    send_sandbox_emails: raw.enviar_email_homologacao,
    nfe_sync: raw.nfe_sincrono,
    nfe_sync_sandbox: raw.nfe_sincrono_homologacao,
    mdfe_sync: raw.mdfe_sincrono,
    mdfe_sync_sandbox: raw.mdfe_sincrono_homologacao,
    contact_password_set: raw.senha_responsavel_preenchida,
    // DANFE display
    danfe_orientation: raw.orientacao_danfe,
    danfe_receipt: raw.recibo_danfe,
    danfe_always_show_ipi: raw.exibe_sempre_ipi_danfe,
    danfe_show_issqn: raw.exibe_issqn_danfe,
    danfe_show_additional_taxes: raw.exibe_impostos_adicionais_danfe,
    danfe_show_trace: raw.exibe_rastro_danfe,
    danfe_show_tax_unit: raw.exibe_unidade_tributaria_danfe,
    danfe_always_show_volumes: raw.exibe_sempre_volumes_danfe,
    mdfe_show_cargo_breakdown: raw.exibe_composicao_carga_mdfe,
    // SMTP
    smtp_host: raw.smtp_endereco,
    smtp_domain: raw.smtp_dominio,
    smtp_auth: raw.smtp_autenticacao,
    smtp_login: raw.smtp_login,
    smtp_sender: raw.smtp_remetente,
    smtp_reply_to: raw.smtp_responder_para,
    smtp_ssl_verification: raw.smtp_modo_verificacao_openssl,
    smtp_ssl: raw.smtp_ssl,
    smtp_tls: raw.smtp_tls,
    // NFCe CSC
    nfce_csc_production: raw.csc_nfce_producao,
    nfce_csc_sandbox: raw.csc_nfce_homologacao,
    // Series / next numbers
    nfe_next_number_production: raw.proximo_numero_nfe_producao,
    nfe_next_number_sandbox: raw.proximo_numero_nfe_homologacao,
    nfe_series_production: raw.serie_nfe_producao,
    nfe_series_sandbox: raw.serie_nfe_homologacao,
    nfce_next_number_production: raw.proximo_numero_nfce_producao,
    nfce_next_number_sandbox: raw.proximo_numero_nfce_homologacao,
    nfce_series_production: raw.serie_nfce_producao,
    nfce_series_sandbox: raw.serie_nfce_homologacao,
    nfse_next_number_production: raw.proximo_numero_nfse_producao,
    nfse_next_number_sandbox: raw.proximo_numero_nfse_homologacao,
    nfse_series_production: raw.serie_nfse_producao,
    nfse_series_sandbox: raw.serie_nfse_homologacao,
    nfsen_next_number_production: raw.proximo_numero_nfsen_producao,
    nfsen_next_number_sandbox: raw.proximo_numero_nfsen_homologacao,
    nfsen_series_production: raw.serie_nfsen_producao,
    nfsen_series_sandbox: raw.serie_nfsen_homologacao,
    cte_next_number_production: raw.proximo_numero_cte_producao,
    cte_next_number_sandbox: raw.proximo_numero_cte_homologacao,
    cte_series_production: raw.serie_cte_producao,
    cte_series_sandbox: raw.serie_cte_homologacao,
    cte_os_next_number_production: raw.proximo_numero_cte_os_producao,
    cte_os_next_number_sandbox: raw.proximo_numero_cte_os_homologacao,
    cte_os_series_production: raw.serie_cte_os_producao,
    cte_os_series_sandbox: raw.serie_cte_os_homologacao,
    mdfe_next_number_production: raw.proximo_numero_mdfe_producao,
    mdfe_next_number_sandbox: raw.proximo_numero_mdfe_homologacao,
    mdfe_series_production: raw.serie_mdfe_producao,
    mdfe_series_sandbox: raw.serie_mdfe_homologacao,
    nfcom_next_number_production: raw.proximo_numero_nfcom_producao,
    nfcom_next_number_sandbox: raw.proximo_numero_nfcom_homologacao,
    nfcom_series_production: raw.serie_nfcom_producao,
    nfcom_series_sandbox: raw.serie_nfcom_homologacao,
    dce_next_number_production: raw.proximo_numero_dce_producao,
    dce_next_number_sandbox: raw.proximo_numero_dce_homologacao,
    dce_series_production: raw.serie_dce_producao,
    dce_series_sandbox: raw.serie_dce_homologacao,
    // Response-only fields
    state_registration: raw.inscricao_estadual,
    municipal_registration: raw.inscricao_municipal,
    tax_regime: raw.regime_tributario,
    address_number: raw.numero,
    zip_code: raw.cep,
    smtp_port: raw.smtp_porta,
    nfce_token_id_production: raw.id_token_nfce_producao,
    nfce_token_id_sandbox: raw.id_token_nfce_homologacao,
    municipality_code: raw.codigo_municipio,
    country_code: raw.codigo_pais,
    state_code: raw.codigo_uf,
    country: raw.pais,
    contact_role: raw.cargo_responsavel,
    nfce_epec_contingency_enabled: raw.habilita_contingencia_epec_nfce,
    manifestation_sandbox_enabled: raw.habilita_manifestacao_homologacao,
    cte_manifestation_sandbox_enabled: raw.habilita_manifestacao_cte_homologacao,
    certificate_valid_until: raw.certificado_valido_ate,
    certificate_valid_from: raw.certificado_valido_de,
    certificate_business_id: raw.certificado_cnpj,
    certificate_specific: raw.certificado_especifico,
    last_issued_at: raw.data_ultima_emissao,
    logo_url: raw.caminho_logo,
    danfe_show_invoice: raw.exibe_fatura_danfe,
    danfe_show_item_discount: raw.exibe_desconto_itens,
    nfe_csrt_enabled: raw.habilita_csrt_nfe,
    smtp_starttls_enabled: raw.smtp_habilita_starttlls,
    token_production: raw.token_producao,
    token_sandbox: raw.token_homologacao
  }
}

export function mapCompanyInput(input: CompanyInput): FocusNfeEmpresaCreate {
  return {
    // Identity / address
    nome: input.name,
    nome_fantasia: input.trade_name,
    cnpj: input.business_id,
    cpf: input.individual_id,
    logradouro: input.street,
    complemento: input.complement,
    municipio: input.municipality,
    bairro: input.neighborhood,
    uf: input.state,
    telefone: input.phone,
    email: input.email,
    cpf_cnpj_contabilidade: input.accountant_id,
    nome_responsavel: input.contact_name,
    cpf_responsavel: input.contact_id,
    login_responsavel: input.contact_login,
    data_inicio_recebimento_nfe: input.nfe_receiving_start_date,
    data_inicio_recebimento_cte: input.cte_receiving_start_date,
    // Feature flags
    enviar_email_destinatario: input.send_email_to_recipient,
    discrimina_impostos: input.itemize_taxes,
    habilita_nfe: input.nfe_enabled,
    habilita_nfce: input.nfce_enabled,
    habilita_nfse: input.nfse_enabled,
    habilita_nfsen_producao: input.nfsen_production_enabled,
    habilita_nfsen_homologacao: input.nfsen_sandbox_enabled,
    habilita_cte: input.cte_enabled,
    habilita_mdfe: input.mdfe_enabled,
    habilita_manifestacao: input.manifestation_enabled,
    habilita_manifestacao_cte: input.cte_manifestation_enabled,
    habilita_nfcom: input.nfcom_enabled,
    habilita_dce: input.dce_enabled,
    habilita_contingencia_offline_nfce: input.nfce_offline_contingency_enabled,
    reaproveita_numero_nfce_contingencia: input.nfce_contingency_reuse_number,
    mostrar_danfse_badge: input.danfse_badge_visible,
    enviar_email_homologacao: input.send_sandbox_emails,
    nfe_sincrono: input.nfe_sync,
    nfe_sincrono_homologacao: input.nfe_sync_sandbox,
    mdfe_sincrono: input.mdfe_sync,
    mdfe_sincrono_homologacao: input.mdfe_sync_sandbox,
    senha_responsavel_preenchida: input.contact_password_set,
    // DANFE display
    orientacao_danfe: input.danfe_orientation,
    recibo_danfe: input.danfe_receipt,
    exibe_sempre_ipi_danfe: input.danfe_always_show_ipi,
    exibe_issqn_danfe: input.danfe_show_issqn,
    exibe_impostos_adicionais_danfe: input.danfe_show_additional_taxes,
    exibe_rastro_danfe: input.danfe_show_trace,
    exibe_unidade_tributaria_danfe: input.danfe_show_tax_unit,
    exibe_sempre_volumes_danfe: input.danfe_always_show_volumes,
    exibe_composicao_carga_mdfe: input.mdfe_show_cargo_breakdown,
    // SMTP
    smtp_endereco: input.smtp_host,
    smtp_dominio: input.smtp_domain,
    smtp_autenticacao: input.smtp_auth,
    smtp_login: input.smtp_login,
    smtp_remetente: input.smtp_sender,
    smtp_responder_para: input.smtp_reply_to,
    smtp_modo_verificacao_openssl: input.smtp_ssl_verification,
    smtp_ssl: input.smtp_ssl,
    smtp_tls: input.smtp_tls,
    // NFCe CSC
    csc_nfce_producao: input.nfce_csc_production,
    csc_nfce_homologacao: input.nfce_csc_sandbox,
    // Series / next numbers
    proximo_numero_nfe_producao: input.nfe_next_number_production,
    proximo_numero_nfe_homologacao: input.nfe_next_number_sandbox,
    serie_nfe_producao: input.nfe_series_production,
    serie_nfe_homologacao: input.nfe_series_sandbox,
    proximo_numero_nfce_producao: input.nfce_next_number_production,
    proximo_numero_nfce_homologacao: input.nfce_next_number_sandbox,
    serie_nfce_producao: input.nfce_series_production,
    serie_nfce_homologacao: input.nfce_series_sandbox,
    proximo_numero_nfse_producao: input.nfse_next_number_production,
    proximo_numero_nfse_homologacao: input.nfse_next_number_sandbox,
    serie_nfse_producao: input.nfse_series_production,
    serie_nfse_homologacao: input.nfse_series_sandbox,
    proximo_numero_nfsen_producao: input.nfsen_next_number_production,
    proximo_numero_nfsen_homologacao: input.nfsen_next_number_sandbox,
    serie_nfsen_producao: input.nfsen_series_production,
    serie_nfsen_homologacao: input.nfsen_series_sandbox,
    proximo_numero_cte_producao: input.cte_next_number_production,
    proximo_numero_cte_homologacao: input.cte_next_number_sandbox,
    serie_cte_producao: input.cte_series_production,
    serie_cte_homologacao: input.cte_series_sandbox,
    proximo_numero_cte_os_producao: input.cte_os_next_number_production,
    proximo_numero_cte_os_homologacao: input.cte_os_next_number_sandbox,
    serie_cte_os_producao: input.cte_os_series_production,
    serie_cte_os_homologacao: input.cte_os_series_sandbox,
    proximo_numero_mdfe_producao: input.mdfe_next_number_production,
    proximo_numero_mdfe_homologacao: input.mdfe_next_number_sandbox,
    serie_mdfe_producao: input.mdfe_series_production,
    serie_mdfe_homologacao: input.mdfe_series_sandbox,
    proximo_numero_nfcom_producao: input.nfcom_next_number_production,
    proximo_numero_nfcom_homologacao: input.nfcom_next_number_sandbox,
    serie_nfcom_producao: input.nfcom_series_production,
    serie_nfcom_homologacao: input.nfcom_series_sandbox,
    proximo_numero_dce_producao: input.dce_next_number_production,
    proximo_numero_dce_homologacao: input.dce_next_number_sandbox,
    serie_dce_producao: input.dce_series_production,
    serie_dce_homologacao: input.dce_series_sandbox,
    // Input-only number fields
    inscricao_estadual: input.state_registration,
    inscricao_municipal: input.municipal_registration,
    regime_tributario: input.tax_regime,
    numero: input.address_number,
    cep: input.zip_code,
    smtp_porta: input.smtp_port,
    id_token_nfce_producao: input.nfce_token_id_production,
    id_token_nfce_homologacao: input.nfce_token_id_sandbox,
    // Write-only
    arquivo_certificado_base64: input.certificate_base64,
    senha_certificado: input.certificate_password,
    arquivo_logo_base64: input.logo_base64,
    delete_logo: input.delete_logo,
    senha_responsavel: input.contact_password,
    smtp_senha: input.smtp_password,
    smtp_habilita_starttls: input.smtp_starttls_enabled,
    habilita_nfsen_recebidas_producao: input.nfsen_received_production_enabled,
    habilita_nfsen_recebidas_homologacao: input.nfsen_received_sandbox_enabled
  }
}

// ─── NFSe ─────────────────────────────────────────────────────────────────────

const NFSE_NOTE_STATUS_MAP: Record<string, NfseStatus> = {
  processando_autorizacao: 'processing_authorization',
  autorizado: 'authorized',
  cancelado: 'cancelled',
  erro_autorizacao: 'authorization_error'
}

export function mapNfseStatus(raw: FocusNfeNfseStatus): NfseStatus {
  return NFSE_NOTE_STATUS_MAP[raw] ?? 'processing_authorization'
}

export function mapNfseError(raw: FocusNfeNfseErro): NfseError {
  return { code: raw.codigo, message: raw.mensagem, correction: raw.correcao }
}

export function mapNfseResult(raw: FocusNfeNfseResponse): NfseResult {
  return {
    provider_business_id: raw.cnpj_prestador,
    reference: raw.ref,
    rps_number: raw.numero_rps,
    rps_series: raw.serie_rps,
    rps_type: raw.tipo_rps,
    status: mapNfseStatus(raw.status),
    number: raw.numero,
    verification_code: raw.codigo_verificacao,
    issued_at: raw.data_emissao,
    url: raw.url,
    xml_path: raw.caminho_xml_nota_fiscal,
    pdf_url: raw.url_danfse,
    cancellation_xml_path: raw.caminho_xml_cancelamento,
    errors: raw.erros?.map(mapNfseError)
  }
}

export function mapNfseCancelResult(raw: FocusNfeNfseCancelResponse): NfseCancelResult {
  return {
    status: raw.status === 'cancelado' ? 'cancelled' : 'cancellation_error',
    errors: raw.erros?.map(mapNfseError)
  }
}

export function mapWebhookTrigger(raw: FocusNfeHookTrigger): WebhookTrigger {
  return {
    id: raw.id,
    url: raw.url,
    authorization: raw.authorization,
    authorization_header: raw.authorization_header,
    event: raw.event,
    business_id: raw.cnpj,
    individual_id: raw.cpf
  }
}

export function mapNfseInput(input: NfseInput): FocusNfeNfseCreate {
  return {
    ref: input.reference,
    data_emissao: input.issued_at,
    cnpj_prestador: input.provider_business_id,
    cpf_prestador: input.provider_individual_id,
    natureza_operacao: input.operation_nature,
    regime_especial_tributacao: input.special_tax_regime,
    optante_simples_nacional: input.simple_national,
    incentivador_cultural: input.cultural_incentive,
    email: input.email,
    emails: input.emails,
    servico: {
      discriminacao: input.service.description,
      valor_servicos: input.service.service_value,
      valor_deducoes: input.service.deductions_value,
      valor_pis: input.service.pis_value,
      valor_cofins: input.service.cofins_value,
      valor_inss: input.service.inss_value,
      valor_ir: input.service.ir_value,
      valor_csll: input.service.csll_value,
      iss_retido: input.service.iss_withheld,
      valor_iss: input.service.iss_value,
      valor_iss_retido: input.service.iss_withheld_value,
      base_calculo: input.service.tax_base,
      aliquota: input.service.tax_rate,
      valor_liquido_nfse: input.service.net_value,
      outras_retencoes: input.service.other_deductions,
      desconto_incondicionado: input.service.unconditional_discount,
      desconto_condicionado: input.service.conditional_discount,
      item_lista_servico: input.service.service_list_item,
      codigo_tributario_municipio: input.service.municipal_tax_code,
      codigo_cnae: input.service.cnae_code,
      percentual_total_tributos: input.service.total_tax_rate,
      fonte_total_tributos: input.service.total_tax_source,
      codigo_municipio: input.service.municipality_code,
      codigo_pais: input.service.country_code
    },
    tomador: input.taker
      ? {
          cnpj: input.taker.business_id,
          cpf: input.taker.individual_id,
          inscricao_municipal: input.taker.municipal_registration,
          razao_social: input.taker.company_name,
          endereco: input.taker.address
            ? {
                logradouro: input.taker.address.street,
                numero: input.taker.address.number,
                complemento: input.taker.address.complement,
                bairro: input.taker.address.neighborhood,
                codigo_municipio: input.taker.address.municipality_code,
                uf: input.taker.address.state,
                cep: input.taker.address.zip_code,
                codigo_pais: input.taker.address.country_code
              }
            : undefined,
          contato: input.taker.contact
            ? {
                telefone: input.taker.contact.phone,
                email: input.taker.contact.email
              }
            : undefined
        }
      : undefined
  }
}
