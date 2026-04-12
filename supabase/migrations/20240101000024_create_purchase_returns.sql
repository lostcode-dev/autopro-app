-- =============================================================================
-- Migration: 20240101000024_create_purchase_returns
-- Description: Creates the purchase_returns table for tracking parts returned
--              to suppliers after a purchase. Captures the return reason, status,
--              returned JSONB line-items, and optional financial credit metadata.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: purchase_returns
-- -----------------------------------------------------------------------------
CREATE TABLE public.purchase_returns (
    -- Primary key
    id                          uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id             uuid            NOT NULL,

    -- Core relationships
    purchase_id                 uuid            NOT NULL,
    supplier_id                 uuid            NOT NULL,
    financial_transaction_id    uuid,
    bank_account_id             uuid,

    -- Return details
    return_date                 date            NOT NULL,
    reason                      varchar(40)     NOT NULL,
    status                      varchar(20)     NOT NULL,
    total_returned_amount       numeric(15, 2)  NOT NULL,

    -- Line items returned to the supplier.
    -- Expected element shape:
    -- {
    --   "part_id":          uuid | null,
    --   "description":      string,
    --   "quantity":         number,
    --   "unit_cost_price":  number,
    --   "total_item_price": number
    -- }
    returned_items              jsonb           NOT NULL,

    -- Financial credit tracking
    generated_financial_credit  boolean         NOT NULL DEFAULT false,

    -- Free-text notes
    notes                       text,

    -- Audit columns
    created_at                  timestamptz     NOT NULL DEFAULT now(),
    created_by                  varchar(200),
    updated_at                  timestamptz     NOT NULL DEFAULT now(),
    updated_by                  varchar(200),
    deleted_at                  timestamptz,
    deleted_by                  varchar(200),

    -- Constraints
    CONSTRAINT purchase_returns_pkey
        PRIMARY KEY (id),

    CONSTRAINT purchase_returns_organization_fk
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT purchase_returns_purchase_fk
        FOREIGN KEY (purchase_id)
        REFERENCES public.purchases (id)
        ON DELETE RESTRICT,

    CONSTRAINT purchase_returns_supplier_fk
        FOREIGN KEY (supplier_id)
        REFERENCES public.suppliers (id)
        ON DELETE RESTRICT,

    CONSTRAINT purchase_returns_financial_transaction_fk
        FOREIGN KEY (financial_transaction_id)
        REFERENCES public.financial_transactions (id)
        ON DELETE SET NULL,

    CONSTRAINT purchase_returns_bank_account_fk
        FOREIGN KEY (bank_account_id)
        REFERENCES public.bank_accounts (id)
        ON DELETE SET NULL,

    CONSTRAINT purchase_returns_reason_check
        CHECK (reason IN (
            'warranty',
            'wrong_part',
            'manufacturing_defect',
            'damaged_product',
            'incompatible',
            'other'
        )),

    CONSTRAINT purchase_returns_status_check
        CHECK (status IN ('pending', 'completed'))
);

COMMENT ON TABLE public.purchase_returns IS
    'Tracks parts returned to suppliers after a purchase, including reason, status, financial credit generation, and JSONB line-items.';

COMMENT ON COLUMN public.purchase_returns.reason IS
    'warranty | wrong_part | manufacturing_defect | damaged_product | incompatible | other';

COMMENT ON COLUMN public.purchase_returns.status IS
    'pending | completed';

COMMENT ON COLUMN public.purchase_returns.returned_items IS
    'JSONB array of returned line items. Each element: {part_id, description, quantity, unit_cost_price, total_item_price}.';

COMMENT ON COLUMN public.purchase_returns.generated_financial_credit IS
    'True when a financial_transaction (credit/income) has been generated for this return.';

COMMENT ON COLUMN public.purchase_returns.purchase_id IS
    'Reference to the original purchase. ON DELETE RESTRICT — a purchase cannot be removed while returns exist against it.';

COMMENT ON COLUMN public.purchase_returns.supplier_id IS
    'The supplier the items were returned to. ON DELETE RESTRICT — supplier cannot be removed while returns reference it.';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_purchase_returns_org_id
    ON public.purchase_returns (organization_id)
    WHERE deleted_at IS NULL;

-- Original purchase lookups
CREATE INDEX idx_purchase_returns_purchase_id
    ON public.purchase_returns (purchase_id);

-- Supplier lookups
CREATE INDEX idx_purchase_returns_supplier_id
    ON public.purchase_returns (supplier_id);

-- Financial transaction back-reference
CREATE INDEX idx_purchase_returns_financial_transaction_id
    ON public.purchase_returns (financial_transaction_id);

-- Bank account lookups
CREATE INDEX idx_purchase_returns_bank_account_id
    ON public.purchase_returns (bank_account_id);

-- Org + status (e.g., "show all pending returns for org X")
CREATE INDEX idx_purchase_returns_org_status
    ON public.purchase_returns (organization_id, status)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_purchase_returns_updated_at
    BEFORE UPDATE ON public.purchase_returns
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_returns_select_same_org"
    ON public.purchase_returns
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY "purchase_returns_insert_same_org"
    ON public.purchase_returns
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "purchase_returns_update_same_org"
    ON public.purchase_returns
    FOR UPDATE
    TO authenticated
    USING (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "purchase_returns_delete_same_org"
    ON public.purchase_returns
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());
