-- =============================================================================
-- Migration: 20240101000023_create_purchases
-- Description: Creates the purchases table for recording parts/supplies
--              bought from suppliers. Each purchase captures payment metadata,
--              an optional invoice number, and a JSONB line-item array.
--              Also resolves the deferred FK purchase_id on financial_transactions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: purchases
-- -----------------------------------------------------------------------------
CREATE TABLE public.purchases (
    -- Primary key
    id                          uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id             uuid            NOT NULL,

    -- Core relationships
    supplier_id                 uuid            NOT NULL,
    bank_account_id             uuid            NOT NULL,
    financial_transaction_id    uuid,

    -- Purchase details
    purchase_date               date            NOT NULL,
    total_amount                numeric(15, 2)  NOT NULL,
    payment_status              varchar(20)     NOT NULL,
    invoice_number              varchar(50),
    payment_date                date,
    due_date                    date,
    notes                       text,

    -- Line items stored as JSONB for flexibility.
    -- Expected element shape:
    -- {
    --   "part_id":          uuid | null,
    --   "description":      string,
    --   "quantity":         number,
    --   "unit_cost_price":  number,
    --   "unit_sale_price":  number,
    --   "total_item_price": number,
    --   "add_to_stock":     boolean
    -- }
    items                       jsonb,

    -- Audit columns
    created_at                  timestamptz     NOT NULL DEFAULT now(),
    created_by                  varchar(200),
    updated_at                  timestamptz     NOT NULL DEFAULT now(),
    updated_by                  varchar(200),
    deleted_at                  timestamptz,
    deleted_by                  varchar(200),

    -- Constraints
    CONSTRAINT purchases_pkey
        PRIMARY KEY (id),

    CONSTRAINT purchases_organization_fk
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT purchases_supplier_fk
        FOREIGN KEY (supplier_id)
        REFERENCES public.suppliers (id)
        ON DELETE RESTRICT,

    CONSTRAINT purchases_bank_account_fk
        FOREIGN KEY (bank_account_id)
        REFERENCES public.bank_accounts (id)
        ON DELETE RESTRICT,

    CONSTRAINT purchases_financial_transaction_fk
        FOREIGN KEY (financial_transaction_id)
        REFERENCES public.financial_transactions (id)
        ON DELETE SET NULL,

    CONSTRAINT purchases_payment_status_check
        CHECK (payment_status IN ('paid', 'pending'))
);

COMMENT ON TABLE public.purchases IS
    'Records purchases of parts and supplies from suppliers, including payment status, invoice reference, and itemised JSONB line-items.';

COMMENT ON COLUMN public.purchases.payment_status IS
    'paid | pending';

COMMENT ON COLUMN public.purchases.items IS
    'JSONB array of line items. Each element: {part_id, description, quantity, unit_cost_price, unit_sale_price, total_item_price, add_to_stock}.';

COMMENT ON COLUMN public.purchases.bank_account_id IS
    'The bank account that funded this purchase. ON DELETE RESTRICT — account cannot be removed while purchases reference it.';

COMMENT ON COLUMN public.purchases.supplier_id IS
    'The supplier this purchase was made with. ON DELETE RESTRICT — supplier cannot be removed while purchases reference it.';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_purchases_org_id
    ON public.purchases (organization_id)
    WHERE deleted_at IS NULL;

-- Supplier lookups
CREATE INDEX idx_purchases_supplier_id
    ON public.purchases (supplier_id);

-- Bank account lookups
CREATE INDEX idx_purchases_bank_account_id
    ON public.purchases (bank_account_id);

-- Financial transaction back-reference
CREATE INDEX idx_purchases_financial_transaction_id
    ON public.purchases (financial_transaction_id);

-- Org + payment_status (e.g., "show all pending purchases for org X")
CREATE INDEX idx_purchases_org_payment_status
    ON public.purchases (organization_id, payment_status)
    WHERE deleted_at IS NULL;

-- Org + purchase_date for time-range reports
CREATE INDEX idx_purchases_org_purchase_date
    ON public.purchases (organization_id, purchase_date)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_purchases_updated_at
    BEFORE UPDATE ON public.purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_select_same_org"
    ON public.purchases
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY "purchases_insert_same_org"
    ON public.purchases
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "purchases_update_same_org"
    ON public.purchases
    FOR UPDATE
    TO authenticated
    USING (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "purchases_delete_same_org"
    ON public.purchases
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

-- -----------------------------------------------------------------------------
-- DEFERRED FK: financial_transactions.purchase_id → purchases.id
-- financial_transactions was created in migration 21 before this table existed.
-- purchase_id was intentionally left as a plain uuid there; we close the loop now.
-- -----------------------------------------------------------------------------
ALTER TABLE public.financial_transactions
    ADD CONSTRAINT fk_ft_purchase
    FOREIGN KEY (purchase_id)
    REFERENCES public.purchases (id)
    ON DELETE SET NULL;

COMMENT ON CONSTRAINT fk_ft_purchase
    ON public.financial_transactions IS
    'Deferred FK added here (migration 23) — purchases table did not exist when financial_transactions was created.';
