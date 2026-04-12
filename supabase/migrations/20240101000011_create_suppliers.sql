-- =============================================================================
-- Migration: 20240101000011_create_suppliers.sql
-- Description: Creates the suppliers table for managing vendor/supplier records
--              per organization. Supports both PF (individual) and PJ (company)
--              suppliers, including address, contact info, category, and
--              commercial terms.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: suppliers
-- -----------------------------------------------------------------------------
CREATE TABLE public.suppliers (
  -- Primary key
  id                    uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant scoping
  organization_id       uuid          NOT NULL,

  -- Legal identification
  name                  varchar(200)  NOT NULL,   -- Legal / full name
  person_type           varchar(2)    NOT NULL,   -- 'pf' = individual, 'pj' = company
  trade_name            varchar(200),             -- Fantasia / DBA name
  tax_id                varchar(18),              -- CPF (11 digits) or CNPJ (14 digits)
  state_registration    varchar(20),              -- Inscrição estadual

  -- Contact
  phone                 varchar(20)   NOT NULL,
  whatsapp              varchar(20),
  email                 varchar(200),
  website               varchar(200),

  -- Address
  zip_code              varchar(9),
  street                varchar(200),
  address_number        varchar(10),
  address_complement    varchar(100),
  neighborhood          varchar(100),
  city                  varchar(100),
  state                 char(2),                  -- Brazilian UF code, e.g. 'SP'

  -- Primary contact person
  contact_name          varchar(200),
  contact_role          varchar(100),
  contact_phone         varchar(20),
  contact_email         varchar(200),

  -- Classification
  -- Allowed values: auto_parts, tools, equipment, services, consumables, other
  category              varchar(30),

  -- Commercial terms
  payment_term_days     int,                      -- Default payment term in days
  credit_limit          numeric(15,2),            -- Credit limit granted by this supplier

  -- Status
  is_active             boolean       NOT NULL DEFAULT true,

  -- Free-form notes
  notes                 text,

  -- Audit columns
  created_at            timestamptz   NOT NULL DEFAULT now(),
  created_by            varchar(200),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  updated_by            varchar(200),
  deleted_at            timestamptz,
  deleted_by            varchar(200),

  -- Constraints
  CONSTRAINT suppliers_pkey PRIMARY KEY (id),

  CONSTRAINT suppliers_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations (id)
    ON DELETE CASCADE,

  CONSTRAINT suppliers_person_type_check
    CHECK (person_type IN ('pf', 'pj')),

  CONSTRAINT suppliers_category_check
    CHECK (
      category IS NULL OR
      category IN ('auto_parts', 'tools', 'equipment', 'services', 'consumables', 'other')
    )
);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  public.suppliers                    IS 'Supplier / vendor records scoped per organization.';
COMMENT ON COLUMN public.suppliers.person_type        IS 'pf = Pessoa Física (individual), pj = Pessoa Jurídica (company).';
COMMENT ON COLUMN public.suppliers.tax_id             IS 'CPF (individuals) or CNPJ (companies) — stored without punctuation.';
COMMENT ON COLUMN public.suppliers.state_registration IS 'Inscrição Estadual (state tax registration number).';
COMMENT ON COLUMN public.suppliers.category           IS 'Primary supply category: auto_parts, tools, equipment, services, consumables, other.';
COMMENT ON COLUMN public.suppliers.payment_term_days  IS 'Default payment term negotiated with this supplier, in days.';
COMMENT ON COLUMN public.suppliers.credit_limit       IS 'Credit limit extended by this supplier to the organization.';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Org-scoped active-record index
CREATE INDEX idx_suppliers_organization_id
  ON public.suppliers (organization_id)
  WHERE deleted_at IS NULL;

-- Fast lookup by tax_id (CPF/CNPJ) within active records
CREATE INDEX idx_suppliers_tax_id
  ON public.suppliers (tax_id)
  WHERE deleted_at IS NULL;

-- Composite: list active suppliers per org
CREATE INDEX idx_suppliers_org_is_active
  ON public.suppliers (organization_id, is_active)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select_same_org"
  ON public.suppliers
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "suppliers_insert_same_org"
  ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "suppliers_update_same_org"
  ON public.suppliers
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "suppliers_delete_same_org"
  ON public.suppliers
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
