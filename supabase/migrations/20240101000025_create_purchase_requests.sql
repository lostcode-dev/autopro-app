-- ============================================================
-- Migration: 20240101000025_create_purchase_requests.sql
-- Description: Purchase requests table for AutoPro
--              Tracks internal requests to purchase parts/supplies
--              from suppliers, optionally linked to service orders.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE: purchase_requests
-- ------------------------------------------------------------
CREATE TABLE public.purchase_requests (
    id                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
    organization_id       uuid                     NOT NULL,
    request_number        varchar(50)              NOT NULL,
    request_date          timestamptz              NOT NULL DEFAULT now(),
    supplier_id           uuid                     NOT NULL,
    status                varchar(20)              NOT NULL DEFAULT 'waiting'
                              CONSTRAINT purchase_requests_status_check
                              CHECK (status IN ('waiting', 'authorized', 'rejected', 'purchased')),

    -- Items array: [{description, code, vehicle_id, quantity,
    --                estimated_unit_price, estimated_total_price, notes}]
    items                 jsonb                    NOT NULL,

    total_request_amount  numeric(15, 2)           NOT NULL DEFAULT 0,
    requester             varchar(200)             NOT NULL,

    -- Optional link to a service order that originated this request
    service_order_id      uuid,

    justification         text,
    notes                 text,

    -- Authorization fields (populated when status moves to 'authorized')
    authorization_date    timestamptz,
    authorized_by         varchar(200),

    -- Rejection fields (populated when status moves to 'rejected')
    rejection_reason      text,

    -- Link to the actual purchase created from this request
    purchase_id           uuid,

    -- Audit columns
    created_at            timestamptz              NOT NULL DEFAULT now(),
    created_by            varchar(200),
    updated_at            timestamptz              NOT NULL DEFAULT now(),
    updated_by            varchar(200),
    deleted_at            timestamptz,
    deleted_by            varchar(200),

    -- Constraints
    CONSTRAINT purchase_requests_pkey
        PRIMARY KEY (id),
    CONSTRAINT purchase_requests_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,
    CONSTRAINT purchase_requests_supplier_id_fkey
        FOREIGN KEY (supplier_id)
        REFERENCES public.suppliers (id)
        ON DELETE RESTRICT,
    CONSTRAINT purchase_requests_service_order_id_fkey
        FOREIGN KEY (service_order_id)
        REFERENCES public.service_orders (id)
        ON DELETE SET NULL,
    CONSTRAINT purchase_requests_purchase_id_fkey
        FOREIGN KEY (purchase_id)
        REFERENCES public.purchases (id)
        ON DELETE SET NULL,

    -- Each org has unique request numbers
    CONSTRAINT purchase_requests_org_request_number_unique
        UNIQUE (organization_id, request_number)
);

-- ------------------------------------------------------------
-- COMMENTS
-- ------------------------------------------------------------
COMMENT ON TABLE  public.purchase_requests                       IS 'Internal purchase requests sent to suppliers, optionally tied to a service order or resulting purchase.';
COMMENT ON COLUMN public.purchase_requests.status               IS 'Lifecycle: waiting → authorized/rejected → purchased';
COMMENT ON COLUMN public.purchase_requests.items                IS 'JSON array of line items: [{description, code, vehicle_id, quantity, estimated_unit_price, estimated_total_price, notes}]';
COMMENT ON COLUMN public.purchase_requests.total_request_amount IS 'Sum of all estimated_total_price values in items.';
COMMENT ON COLUMN public.purchase_requests.purchase_id          IS 'Populated once a purchase record is created from this request.';

-- ------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- ------------------------------------------------------------
CREATE TRIGGER trg_purchase_requests_updated_at
    BEFORE UPDATE ON public.purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------

-- Org-scoped partial index (primary lookup, soft-delete aware)
CREATE INDEX idx_purchase_requests_organization_id
    ON public.purchase_requests (organization_id)
    WHERE deleted_at IS NULL;

-- Foreign keys
CREATE INDEX idx_purchase_requests_supplier_id
    ON public.purchase_requests (supplier_id);

CREATE INDEX idx_purchase_requests_service_order_id
    ON public.purchase_requests (service_order_id);

CREATE INDEX idx_purchase_requests_purchase_id
    ON public.purchase_requests (purchase_id);

-- Composite: filter by org + status (e.g., "show all waiting requests")
CREATE INDEX idx_purchase_requests_org_status
    ON public.purchase_requests (organization_id, status)
    WHERE deleted_at IS NULL;

-- Composite: filter by org + date (e.g., date-range reports)
CREATE INDEX idx_purchase_requests_org_request_date
    ON public.purchase_requests (organization_id, request_date)
    WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_requests_select_same_org"
    ON public.purchase_requests
    FOR SELECT TO authenticated
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY "purchase_requests_insert_same_org"
    ON public.purchase_requests
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "purchase_requests_update_same_org"
    ON public.purchase_requests
    FOR UPDATE TO authenticated
    USING  (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "purchase_requests_delete_same_org"
    ON public.purchase_requests
    FOR DELETE TO authenticated
    USING (organization_id = public.current_user_organization_id());
