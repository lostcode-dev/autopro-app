-- =============================================================================
-- FILE: 20240101000001_create_organizations.sql
-- PROJECT: AutoPro — Automotive Workshop Management (Multi-Tenant SaaS)
-- PURPOSE: Creates the organizations table, which is the root tenant entity.
--          Every other tenant-scoped table references organizations(id).
--
-- NOTES:
--   - default_bank_account_id intentionally has NO FK constraint here to
--     avoid a circular dependency with the bank_accounts table (which itself
--     references organizations). The FK is added in the bank_accounts
--     migration via ALTER TABLE.
--   - RLS uses id = current_user_organization_id() instead of organization_id
--     because this table IS the organization root.
--   - INSERT / DELETE for authenticated users are intentionally omitted;
--     tenant creation and deletion are managed by the service role only.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE: public.organizations
-- ---------------------------------------------------------------------------

CREATE TABLE public.organizations (
  -- Primary key
  id                            uuid          NOT NULL DEFAULT uuid_generate_v4(),

  -- Core identity
  name                          varchar(200)  NOT NULL,
  business_type                 varchar(100),

  -- Status
  is_active                     boolean       NOT NULL DEFAULT true,

  -- Fiscal / legal
  person_type                   varchar(2)    NOT NULL
                                  CHECK (person_type IN ('pf', 'pj')),
  tax_id                        varchar(18),            -- CPF or CNPJ
  state_registration            varchar(20),            -- Inscrição Estadual

  -- Contact
  phone                         varchar(20),
  whatsapp                      varchar(20),
  email                         varchar(200),
  website                       varchar(200),

  -- Branding
  logo_url                      varchar(500),

  -- Address
  zip_code                      varchar(9),
  street                        varchar(200),
  address_number                varchar(10),
  address_complement            varchar(100),
  neighborhood                  varchar(100),
  city                          varchar(100),
  state                         char(2),
  municipality_code             varchar(10),   -- Código do município (IBGE)

  -- Operational settings
  initial_service_order_number  int           NOT NULL DEFAULT 1,

  -- Soft reference to bank_accounts — FK added later to avoid circular dep.
  default_bank_account_id       uuid,

  -- Free-form notes / observations
  notes                         text,

  -- Audit columns (standard across all tables)
  created_at  timestamptz  NOT NULL DEFAULT now(),
  created_by  varchar(200),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  updated_by  varchar(200),
  deleted_at  timestamptz,
  deleted_by  varchar(200),

  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.organizations IS 'Root tenant entity. One row per automotive workshop / company.';
COMMENT ON COLUMN public.organizations.person_type              IS 'pf = Pessoa Física (individual), pj = Pessoa Jurídica (company).';
COMMENT ON COLUMN public.organizations.tax_id                   IS 'CPF (11 digits) for pf, CNPJ (14 digits) for pj. Stored with formatting mask.';
COMMENT ON COLUMN public.organizations.municipality_code        IS 'IBGE municipality code — required for NFS-e (electronic service invoices).';
COMMENT ON COLUMN public.organizations.initial_service_order_number IS 'Sequence seed for service order numbering within this organization.';
COMMENT ON COLUMN public.organizations.default_bank_account_id  IS 'Soft reference to bank_accounts(id). FK constraint added in bank_accounts migration.';


-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Partial index: look up organizations by tax_id for active (non-deleted) rows
CREATE INDEX idx_organizations_tax_id
  ON public.organizations (tax_id)
  WHERE deleted_at IS NULL;

-- Partial index: filter active organizations efficiently
CREATE INDEX idx_organizations_is_active
  ON public.organizations (is_active)
  WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Authenticated users may only see their own organization's row
CREATE POLICY "organizations_select_own" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.current_user_organization_id());

-- Authenticated users may only update their own organization's row
CREATE POLICY "organizations_update_own" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.current_user_organization_id())
  WITH CHECK (id = public.current_user_organization_id());

-- INSERT and DELETE are intentionally restricted to service role only.
-- No authenticated policies for those operations.
