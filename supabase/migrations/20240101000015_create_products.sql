-- =============================================================================
-- Migration: 20240101000015_create_products.sql
-- Description: Creates the products table for AutoPro multi-tenant SaaS.
--              Supports both simple unit products and grouped bundle products.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: products
-- Stores the product catalog per organization. Products can be of type 'unit'
-- (a single SKU) or 'group' (a bundle of items defined in group_items JSONB).
-- -----------------------------------------------------------------------------
CREATE TABLE public.products (
    -- Primary key
    id                      uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id         uuid            NOT NULL,

    -- Core fields
    name                    varchar(200)    NOT NULL,
    code                    varchar(50)     NOT NULL,

    -- 'unit'  → a single product tracked individually
    -- 'group' → a bundle; items are stored in group_items JSONB
    type                    varchar(10)     NOT NULL
                                CHECK (type IN ('unit', 'group')),

    -- Optional category (soft link — category can be deleted independently)
    category_id             uuid,

    -- Inventory control (applies to 'unit' products)
    track_inventory         boolean         NOT NULL DEFAULT false,
    initial_stock_quantity  int                      DEFAULT 0,

    -- Pricing
    unit_sale_price         numeric(15, 2),
    unit_cost_price         numeric(15, 2),

    -- Additional info
    notes                   text,

    -- Bundle definition (only meaningful when type = 'group')
    -- Expected element shape:
    -- {
    --   "description": "string",
    --   "quantity": number,
    --   "unit": "string",
    --   "cost_price": number,
    --   "sale_price": number,
    --   "track_inventory": boolean,
    --   "initial_stock_quantity": number
    -- }
    group_items             jsonb,

    -- Audit columns
    created_at              timestamptz     NOT NULL DEFAULT now(),
    created_by              varchar(200),
    updated_at              timestamptz     NOT NULL DEFAULT now(),
    updated_by              varchar(200),
    deleted_at              timestamptz,
    deleted_by              varchar(200),

    -- Constraints
    CONSTRAINT products_pkey
        PRIMARY KEY (id),

    CONSTRAINT products_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT products_category_id_fkey
        FOREIGN KEY (category_id)
        REFERENCES public.product_categories (id)
        ON DELETE SET NULL,

    -- Code must be unique within each organization
    CONSTRAINT products_organization_id_code_key
        UNIQUE (organization_id, code)
);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  public.products IS 'Product catalog per organization. Supports unit and group (bundle) product types.';
COMMENT ON COLUMN public.products.type         IS 'Product type: ''unit'' for single products, ''group'' for bundles.';
COMMENT ON COLUMN public.products.group_items  IS 'Bundle items array (only when type=''group''). Each element: {description, quantity, unit, cost_price, sale_price, track_inventory, initial_stock_quantity}.';
COMMENT ON COLUMN public.products.track_inventory IS 'Whether stock quantity is tracked for this product (applicable to unit products).';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant filter — most queries will scope by org and only look at active records
CREATE INDEX idx_products_organization_id
    ON public.products (organization_id)
    WHERE deleted_at IS NULL;

-- FK index for category joins / cascading lookups
CREATE INDEX idx_products_category_id
    ON public.products (category_id);

-- Useful for filtering the catalog by product type within an org
CREATE INDEX idx_products_organization_id_type
    ON public.products (organization_id, type)
    WHERE deleted_at IS NULL;

-- Useful for name-based search / autocomplete scoped to org
CREATE INDEX idx_products_name
    ON public.products (name)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: keep updated_at current on every row modification
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- SELECT: only rows belonging to the authenticated user's organization
CREATE POLICY "products_select_same_org"
    ON public.products
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

-- INSERT: enforce org scoping at write time
CREATE POLICY "products_insert_same_org"
    ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

-- UPDATE: enforce org scoping on both the existing row and the new values
CREATE POLICY "products_update_same_org"
    ON public.products
    FOR UPDATE
    TO authenticated
    USING  (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

-- DELETE: soft deletes are preferred, but hard-delete is also org-scoped
CREATE POLICY "products_delete_same_org"
    ON public.products
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());
