// ─── Shared fields (common between Create and Response) ──────────────────────
//
// Rules:
//  - Boolean flags that appear in both use `?: boolean`
//  - String fields use `?: string | null` so Create can pass `undefined` and
//    Response can carry `null` without losing compatibility
//  - Fields whose *type* differs between Create and Response (e.g. integer vs
//    string) are NOT included here; they are declared separately in each interface
//  - Write-only and read-only fields are also excluded from this base

export interface FocusNfeEmpresaFields {
  // ── Identity / address ──────────────────────────────────────────────────────
  nome?: string | null
  nome_fantasia?: string | null
  cnpj?: string | null
  cpf?: string | null
  logradouro?: string | null
  complemento?: string | null
  municipio?: string | null
  bairro?: string | null
  uf?: string | null
  telefone?: string | null
  email?: string | null
  cpf_cnpj_contabilidade?: string | null
  nome_responsavel?: string | null
  cpf_responsavel?: string | null
  login_responsavel?: string | null
  data_inicio_recebimento_nfe?: string | null
  data_inicio_recebimento_cte?: string | null

  // ── Feature flags ───────────────────────────────────────────────────────────
  enviar_email_destinatario?: boolean
  discrimina_impostos?: boolean
  habilita_nfe?: boolean
  habilita_nfce?: boolean
  habilita_nfse?: boolean
  habilita_nfsen_producao?: boolean
  habilita_nfsen_homologacao?: boolean
  habilita_cte?: boolean
  habilita_mdfe?: boolean
  habilita_manifestacao?: boolean
  habilita_manifestacao_cte?: boolean
  habilita_nfcom?: boolean
  habilita_dce?: boolean
  habilita_contingencia_offline_nfce?: boolean
  reaproveita_numero_nfce_contingencia?: boolean
  mostrar_danfse_badge?: boolean
  enviar_email_homologacao?: boolean
  nfe_sincrono?: boolean
  nfe_sincrono_homologacao?: boolean
  mdfe_sincrono?: boolean
  mdfe_sincrono_homologacao?: boolean
  senha_responsavel_preenchida?: boolean

  // ── DANFE display ───────────────────────────────────────────────────────────
  orientacao_danfe?: 'portrait' | 'landscape' | null
  recibo_danfe?: boolean
  exibe_sempre_ipi_danfe?: boolean
  exibe_issqn_danfe?: boolean
  exibe_impostos_adicionais_danfe?: boolean
  exibe_rastro_danfe?: boolean
  exibe_unidade_tributaria_danfe?: boolean
  exibe_sempre_volumes_danfe?: boolean
  exibe_composicao_carga_mdfe?: boolean

  // ── SMTP ────────────────────────────────────────────────────────────────────
  smtp_endereco?: string | null
  smtp_dominio?: string | null
  smtp_autenticacao?: string | null
  smtp_login?: string | null
  smtp_remetente?: string | null
  smtp_responder_para?: string | null
  smtp_modo_verificacao_openssl?: string | null
  smtp_ssl?: boolean
  smtp_tls?: boolean

  // ── NFCe CSC ────────────────────────────────────────────────────────────────
  csc_nfce_producao?: string | null
  csc_nfce_homologacao?: string | null

  // ── Series / next numbers ───────────────────────────────────────────────────
  proximo_numero_nfe_producao?: string | null
  proximo_numero_nfe_homologacao?: string | null
  serie_nfe_producao?: string | null
  serie_nfe_homologacao?: string | null
  proximo_numero_nfce_producao?: string | null
  proximo_numero_nfce_homologacao?: string | null
  serie_nfce_producao?: string | null
  serie_nfce_homologacao?: string | null
  proximo_numero_nfse_producao?: string | null
  proximo_numero_nfse_homologacao?: string | null
  serie_nfse_producao?: string | null
  serie_nfse_homologacao?: string | null
  proximo_numero_nfsen_producao?: string | null
  proximo_numero_nfsen_homologacao?: string | null
  serie_nfsen_producao?: string | null
  serie_nfsen_homologacao?: string | null
  proximo_numero_cte_producao?: string | null
  proximo_numero_cte_homologacao?: string | null
  serie_cte_producao?: string | null
  serie_cte_homologacao?: string | null
  proximo_numero_cte_os_producao?: string | null
  proximo_numero_cte_os_homologacao?: string | null
  serie_cte_os_producao?: string | null
  serie_cte_os_homologacao?: string | null
  proximo_numero_mdfe_producao?: string | null
  proximo_numero_mdfe_homologacao?: string | null
  serie_mdfe_producao?: string | null
  serie_mdfe_homologacao?: string | null
  proximo_numero_nfcom_producao?: string | null
  proximo_numero_nfcom_homologacao?: string | null
  serie_nfcom_producao?: string | null
  serie_nfcom_homologacao?: string | null
  proximo_numero_dce_producao?: string | null
  proximo_numero_dce_homologacao?: string | null
  serie_dce_producao?: string | null
  serie_dce_homologacao?: string | null
}

// ─── Request types ────────────────────────────────────────────────────────────

export interface FocusNfeEmpresaCreate extends FocusNfeEmpresaFields {
  // Overrides: sent as integer (returned as string in responses)
  inscricao_estadual?: number
  inscricao_municipal?: number
  regime_tributario?: number
  numero?: number
  cep?: number
  smtp_porta?: number
  id_token_nfce_producao?: number
  id_token_nfce_homologacao?: number

  // Overrides: narrowed to enum literals for Create
  smtp_autenticacao?: 'plain' | 'login' | 'cram_md5'
  smtp_modo_verificacao_openssl?: 'peer' | 'none'
  orientacao_danfe?: 'portrait' | 'landscape'

  // Write-only (not returned in responses)
  arquivo_certificado_base64?: string
  senha_certificado?: string
  arquivo_logo_base64?: string
  delete_logo?: boolean
  senha_responsavel?: string
  smtp_senha?: string
  smtp_habilita_starttls?: boolean
  habilita_nfsen_recebidas_producao?: boolean
  habilita_nfsen_recebidas_homologacao?: boolean
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface FocusNfeEmpresaResponse extends FocusNfeEmpresaFields {
  id: number

  // Overrides: integers in Create, strings in responses
  inscricao_estadual: string
  inscricao_municipal: string
  regime_tributario: string
  numero: string
  cep: string
  smtp_porta: string | null
  id_token_nfce_producao: string | null
  id_token_nfce_homologacao: string | null

  // Read-only fields (not in EmpresaCreate)
  codigo_municipio: string
  codigo_pais: string
  codigo_uf: string
  pais: string
  cargo_responsavel: string | null
  habilita_contingencia_epec_nfce: boolean
  habilita_manifestacao_homologacao: boolean
  habilita_manifestacao_cte_homologacao: boolean
  certificado_valido_ate: string | null
  certificado_valido_de: string | null
  certificado_cnpj: string | null
  certificado_especifico: boolean
  data_ultima_emissao: string | null
  caminho_logo: string | null
  exibe_fatura_danfe: boolean
  exibe_desconto_itens: boolean
  habilita_csrt_nfe: boolean
  /** API field name has intentional typo (double 'l') */
  smtp_habilita_starttlls: boolean
  token_producao: string
  token_homologacao: string
}

// ─── Error types ──────────────────────────────────────────────────────────────

export interface FocusNfeErrorResponse {
  codigo: string
  mensagem: string
}

export interface FocusNfeValidationDetail {
  codigo: string
  mensagem: string
  campo: string
}

export interface FocusNfeValidationErrorResponse {
  codigo: string
  mensagem: string
  erros: FocusNfeValidationDetail[]
}

// ─── CEP types ────────────────────────────────────────────────────────────────

export interface FocusNfeCepResponse {
  cep: string
  tipo: 'localidade' | 'logradouro' | 'unidade_operacional' | 'grande_usuario'
  nome: string
  uf: string
  nome_localidade: string
  codigo_ibge: string
  tipo_logradouro: string
  nome_logradouro: string
  bairro: string
  descricao: string
}

export interface FocusNfeCepQuery {
  codigo_ibge?: string
  uf?: string
  logradouro?: string
  localidade?: string
}

// ─── CNPJ types ───────────────────────────────────────────────────────────────

export interface FocusNfeCnpjEndereco {
  codigo_municipio: string
  codigo_siafi: string
  codigo_ibge: string
  nome_municipio: string
  logradouro: string
  complemento: string
  numero: string
  bairro: string
  cep: string
  uf: string
}

export interface FocusNfeCnpjResponse {
  razao_social: string
  cnpj: string
  situacao_cadastral: string
  cnae_principal: string
  optante_simples_nacional: boolean
  optante_mei: boolean
  endereco: FocusNfeCnpjEndereco
}

// ─── Municípios types ─────────────────────────────────────────────────────────

export type FocusNfeMunicipioStatusNfse = 'ativo' | 'fora_do_ar' | 'pausado' | 'em_implementacao' | 'em_reimplementacao' | 'inativo' | 'nao_implementado'

export interface FocusNfeMunicipio {
  codigo_municipio: string
  nome_municipio: string
  sigla_uf: string
  nome_uf: string
  nfse_habilitada: boolean
  requer_certificado_nfse: boolean | null
  possui_ambiente_homologacao_nfse: boolean | null
  possui_cancelamento_nfse: boolean | null
  provedor_nfse: string | null
  endereco_obrigatorio_nfse: boolean | null
  cpf_cnpj_obrigatorio_nfse: boolean | null
  codigo_cnae_obrigatorio_nfse: boolean | null
  item_lista_servico_obrigatorio_nfse: boolean | null
  codigo_tributario_municipio_obrigatorio_nfse: boolean | null
  status_nfse: FocusNfeMunicipioStatusNfse
  data_previsao_reimplementacao_nfse: string | null
  ultima_emissao_nfse: string | null
}

export interface FocusNfeMunicipioItemListaServico {
  codigo: string
  descricao: string
  tax_rate: string | null
}

export interface FocusNfeMunicipioCodigoTributario {
  codigo: string
  descricao: string
  [key: string]: unknown
}

// ─── NFSe types ───────────────────────────────────────────────────────────────

export type FocusNfeNfseStatus
  = | 'processando_autorizacao'
    | 'autorizado'
    | 'cancelado'
    | 'erro_autorizacao'

export interface FocusNfeNfseErro {
  codigo: string
  mensagem: string
  correcao: string | null
}

export interface FocusNfeNfseResponse {
  cnpj_prestador: string
  ref: string
  numero_rps: string | null
  serie_rps: string | null
  tipo_rps: string | null
  status: FocusNfeNfseStatus
  numero?: string | null
  codigo_verificacao?: string | null
  data_emissao?: string | null
  url?: string | null
  caminho_xml_nota_fiscal?: string | null
  url_danfse?: string | null
  caminho_xml_cancelamento?: string | null
  erros?: FocusNfeNfseErro[]
}

export interface FocusNfeNfseCancelResponse {
  status: 'cancelado' | 'erro_cancelamento'
  erros?: FocusNfeNfseErro[]
}

export interface FocusNfeHookTrigger {
  id: string
  url: string
  authorization: string | null
  authorization_header: string | null
  event: string
  cnpj?: string
  cpf?: string
}

export interface FocusNfeNfseServico {
  discriminacao: string
  valor_servicos: number
  valor_deducoes?: number
  valor_pis?: number
  valor_cofins?: number
  valor_inss?: number
  valor_ir?: number
  valor_csll?: number
  iss_retido?: boolean
  valor_iss?: number
  valor_iss_retido?: number
  base_calculo?: number
  aliquota?: number
  valor_liquido_nfse?: number
  outras_retencoes?: number
  desconto_incondicionado?: number
  desconto_condicionado?: number
  item_lista_servico?: string
  codigo_tributario_municipio?: string
  codigo_cnae?: string
  percentual_total_tributos?: number
  fonte_total_tributos?: string
  codigo_municipio?: string
  codigo_pais?: string
}

export interface FocusNfeNfseTomadorEndereco {
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  codigo_municipio?: string
  uf?: string
  cep?: string
  codigo_pais?: string
}

export interface FocusNfeNfseTomadorContato {
  telefone?: string
  email?: string
}

export interface FocusNfeNfseTomador {
  cnpj?: string
  cpf?: string
  inscricao_municipal?: string
  razao_social?: string
  endereco?: FocusNfeNfseTomadorEndereco
  contato?: FocusNfeNfseTomadorContato
}

export interface FocusNfeNfseCreate {
  ref: string
  data_emissao?: string
  cnpj_prestador?: string
  cpf_prestador?: string
  natureza_operacao?: number
  regime_especial_tributacao?: number
  optante_simples_nacional?: boolean
  incentivador_cultural?: boolean
  servico: FocusNfeNfseServico
  tomador?: FocusNfeNfseTomador
  email?: string
  emails?: string[]
}
