-- =============================================================================
-- Migration: 20240101000010_create_payment_terminals.sql
-- Description: Creates the payment_terminals table for managing card/payment
--              machine registrations per organization, including provider info,
--              linked bank account, receipt delay, and installment rate config.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: payment_terminals
-- -----------------------------------------------------------------------------
CREATE TABLE public.payment_terminals (
  -- Primary key
  id                   uuid         NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant scoping
  organization_id      uuid         NOT NULL,

  -- Terminal identification
  terminal_name        varchar(100) NOT NULL,
  provider_company     varchar(100),                -- e.g. "Stone", "Cielo", "PagSeguro"

  -- Linked bank account where settlements are deposited
  bank_account_id      uuid,

  -- How many days after transaction to receive funds (D+X)
  payment_receipt_days int,

  -- Whether this terminal is currently in use
  is_active            boolean      NOT NULL DEFAULT true,

  -- Installment fee table.
  -- Shape: [{"installment_number": 1, "rate_percentage": 2.5}, ...]
  -- installment_number = 1 represents debit / à vista (single payment)
  rates                jsonb,

  -- Audit columns
  created_at           timestamptz  NOT NULL DEFAULT now(),
  created_by           varchar(200),
  updated_at           timestamptz  NOT NULL DEFAULT now(),
  updated_by           varchar(200),
  deleted_at           timestamptz,
  deleted_by           varchar(200),

  -- Constraints
  CONSTRAINT payment_terminals_pkey PRIMARY KEY (id),

  CONSTRAINT payment_terminals_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations (id)
    ON DELETE CASCADE,

  CONSTRAINT payment_terminals_bank_account_id_fkey
    FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts (id)
    ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  public.payment_terminals                       IS 'Card / payment machine terminals registered per organization.';
COMMENT ON COLUMN public.payment_terminals.rates                 IS 'JSON array of installment rate entries: [{installment_number, rate_percentage}]. installment_number=1 means debit / à vista.';
COMMENT ON COLUMN public.payment_terminals.payment_receipt_days  IS 'Number of business days after transaction until funds are credited (D+X).';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Org-scoped active-record index (most frequent filter)
CREATE INDEX idx_payment_terminals_organization_id
  ON public.payment_terminals (organization_id)
  WHERE deleted_at IS NULL;

-- FK index: bank_account_id
CREATE INDEX idx_payment_terminals_bank_account_id
  ON public.payment_terminals (bank_account_id);

-- Composite: list active terminals per org
CREATE INDEX idx_payment_terminals_org_is_active
  ON public.payment_terminals (organization_id, is_active)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_payment_terminals_updated_at
  BEFORE UPDATE ON public.payment_terminals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.payment_terminals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_terminals_select_same_org"
  ON public.payment_terminals
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "payment_terminals_insert_same_org"
  ON public.payment_terminals
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "payment_terminals_update_same_org"
  ON public.payment_terminals
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "payment_terminals_delete_same_org"
  ON public.payment_terminals
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
