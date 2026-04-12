-- =============================================================================
-- Migration: 20240101000005_create_bank_accounts.sql
-- Description: Creates the bank_accounts table for managing organization
--              bank accounts, cash registers, and payment accounts.
--              Also wires the deferred FK from organizations.default_bank_account_id.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: public.bank_accounts
-- -----------------------------------------------------------------------------
CREATE TABLE public.bank_accounts (
  -- Primary key
  id                       uuid            NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant scope
  organization_id          uuid            NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Core fields
  account_name             varchar(100)    NOT NULL,
  account_type             varchar(30)     NOT NULL
    CHECK (account_type IN ('checking', 'savings', 'salary', 'investment', 'cash')),
  initial_balance          numeric(15, 2)  NOT NULL DEFAULT 0,
  preferred_payment_method varchar(30)
    CHECK (preferred_payment_method IN (
      'pix', 'cash', 'credit_card', 'debit_card', 'check', 'transfer', 'bank_slip'
    )),

  -- Bank identifiers (optional for cash accounts)
  bank_name                varchar(100),
  branch                   varchar(20),
  account_number           varchar(20),

  -- Running balance (updated via triggers / financial transactions)
  current_balance          numeric(15, 2)  DEFAULT 0,

  -- Status & metadata
  is_active                boolean         NOT NULL DEFAULT true,
  notes                    text,
  change_history           jsonb,           -- audit log of balance or config changes

  -- Audit columns
  created_at               timestamptz     NOT NULL DEFAULT now(),
  created_by               varchar(200),
  updated_at               timestamptz     NOT NULL DEFAULT now(),
  updated_by               varchar(200),
  deleted_at               timestamptz,
  deleted_by               varchar(200),

  CONSTRAINT bank_accounts_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.bank_accounts                         IS 'Bank, cash, and payment accounts owned by an organization.';
COMMENT ON COLUMN public.bank_accounts.account_type            IS 'checking | savings | salary | investment | cash';
COMMENT ON COLUMN public.bank_accounts.preferred_payment_method IS 'Default payment method used when paying from this account.';
COMMENT ON COLUMN public.bank_accounts.initial_balance         IS 'Opening balance recorded when the account was created in AutoPro.';
COMMENT ON COLUMN public.bank_accounts.current_balance         IS 'Running balance, updated by financial transaction triggers.';
COMMENT ON COLUMN public.bank_accounts.change_history          IS 'JSON array of historical balance/config snapshots for audit purposes.';

-- -----------------------------------------------------------------------------
-- DEFERRED FOREIGN KEY: organizations.default_bank_account_id
-- Added here because bank_accounts must exist before this FK can be declared.
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD CONSTRAINT fk_organizations_default_bank_account
  FOREIGN KEY (default_bank_account_id)
  REFERENCES public.bank_accounts(id)
  ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: keep updated_at current on every row change
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant lookup (active records only) — used for account pickers / lists
CREATE INDEX idx_bank_accounts_organization_id
  ON public.bank_accounts (organization_id)
  WHERE deleted_at IS NULL;

-- Tenant + status composite — used for "active accounts" dropdown
CREATE INDEX idx_bank_accounts_organization_id_is_active
  ON public.bank_accounts (organization_id, is_active)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_select_same_org" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "bank_accounts_insert_same_org" ON public.bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "bank_accounts_update_same_org" ON public.bank_accounts
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "bank_accounts_delete_same_org" ON public.bank_accounts
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
