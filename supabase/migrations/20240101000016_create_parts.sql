-- =============================================================================
-- Migration: 20240101000016_create_parts.sql
-- Description: Creates the parts table for AutoPro multi-tenant SaaS.
--              Tracks physical inventory of parts and consumables in stock,
--              including pricing, sourcing, and storage location.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: parts
-- Represents individual stock-keeping units (SKUs) physically held in the
-- workshop's inventory. A part may optionally be linked to a catalog product.
-- -----------------------------------------------------------------------------
CREATE TABLE public.parts (
    -- Primary key
    id                  uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id     uuid            NOT NULL,

    -- Optional link to the product catalog
    -- Nullable: a part can exist in inventory without a catalog product entry
    product_id          uuid,

    -- Identification
    code                varchar(50)     NOT NULL,
    description         varchar(200)    NOT NULL,

    -- Stock levels
    stock_quantity      int             NOT NULL DEFAULT 0,
    minimum_quantity    int                      DEFAULT 0,   -- alert threshold

    -- Pricing
    sale_price          numeric(15, 2)  NOT NULL DEFAULT 0,
    cost_price          numeric(15, 2),

    -- Classification
    -- Allowed categories align with common automotive part families
    category            varchar(30)
                            CHECK (category IN (
                                'engine',
                                'suspension',
                                'brakes',
                                'transmission',
                                'electrical',
                                'body',
                                'filters',
                                'oils',
                                'tires',
                                'other'
                            )),
    brand               varchar(100),

    -- Sourcing & storage (denormalized for fast display — no FK to suppliers)
    supplier_name       varchar(200),
    location            varchar(100),   -- e.g. "Shelf A3", "Bin 07"

    -- Additional info
    notes               text,

    -- Audit columns
    created_at          timestamptz     NOT NULL DEFAULT now(),
    created_by          varchar(200),
    updated_at          timestamptz     NOT NULL DEFAULT now(),
    updated_by          varchar(200),
    deleted_at          timestamptz,
    deleted_by          varchar(200),

    -- Constraints
    CONSTRAINT parts_pkey
        PRIMARY KEY (id),

    CONSTRAINT parts_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT parts_product_id_fkey
        FOREIGN KEY (product_id)
        REFERENCES public.products (id)
        ON DELETE SET NULL,

    -- Part codes must be unique per organization
    CONSTRAINT parts_organization_id_code_key
        UNIQUE (organization_id, code)
);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  public.parts IS 'Physical inventory of parts and consumables held by each workshop organization.';
COMMENT ON COLUMN public.parts.product_id       IS 'Optional reference to the product catalog entry for this part.';
COMMENT ON COLUMN public.parts.stock_quantity   IS 'Current on-hand quantity. Updated by purchase receipts and service order consumption.';
COMMENT ON COLUMN public.parts.minimum_quantity IS 'Low-stock alert threshold. When stock_quantity falls below this value a reorder alert should be triggered.';
COMMENT ON COLUMN public.parts.supplier_name    IS 'Denormalized supplier name for quick display without a join to the suppliers table.';
COMMENT ON COLUMN public.parts.location         IS 'Physical storage location within the workshop (e.g. shelf, bin, rack).';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant filter — primary scan for all inventory queries
CREATE INDEX idx_parts_organization_id
    ON public.parts (organization_id)
    WHERE deleted_at IS NULL;

-- FK index for joins back to the product catalog
CREATE INDEX idx_parts_product_id
    ON public.parts (product_id);

-- Category-based browsing scoped to org (e.g. "show me all brake parts")
CREATE INDEX idx_parts_organization_id_category
    ON public.parts (organization_id, category)
    WHERE deleted_at IS NULL;

-- Low-stock alert queries: filter by org + quantity thresholds
CREATE INDEX idx_parts_organization_id_stock_quantity
    ON public.parts (organization_id, stock_quantity)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: keep updated_at current on every row modification
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_parts_updated_at
    BEFORE UPDATE ON public.parts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

-- SELECT: only rows belonging to the authenticated user's organization
CREATE POLICY "parts_select_same_org"
    ON public.parts
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

-- INSERT: enforce org scoping at write time
CREATE POLICY "parts_insert_same_org"
    ON public.parts
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

-- UPDATE: enforce org scoping on both the existing row and the new values
CREATE POLICY "parts_update_same_org"
    ON public.parts
    FOR UPDATE
    TO authenticated
    USING  (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

-- DELETE: soft deletes are preferred, but hard-delete is also org-scoped
CREATE POLICY "parts_delete_same_org"
    ON public.parts
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());
