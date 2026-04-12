-- =============================================================================
-- Migration: 20240101000018_create_service_orders.sql
-- Description: Creates the service_orders table for AutoPro multi-tenant SaaS.
--              A service order is the central operational document tracking a
--              vehicle's visit through the workshop lifecycle — from estimate
--              through delivery — including labour/parts items, payments,
--              taxes, and NF-e / NFS-e fiscal document references.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: service_orders
-- Core entity of the AutoPro system. One service order per workshop job.
-- Items (labour + parts), commissions, and taxes are stored as JSONB to avoid
-- excessive join complexity for a document-style record.
--
-- FK notes:
--   • active_nfse_id / active_nfe_id reference fiscal document tables that are
--     created in later migrations (33 and 34). They are declared here as plain
--     uuid columns (no FK constraint) and the constraints are added by those
--     later migrations.
--   • employee_responsible_id is kept for legacy/deprecated purposes; the
--     current pattern uses the responsible_employees JSONB array.
-- -----------------------------------------------------------------------------
CREATE TABLE public.service_orders (
    -- Primary key
    id                          uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id             uuid            NOT NULL,

    -- Human-readable document number (unique per org, can include prefixes)
    number                      varchar(50)     NOT NULL,

    -- Parties
    client_id                   uuid            NOT NULL,
    vehicle_id                  uuid,

    -- Dates
    entry_date                  date            NOT NULL,
    expected_date               date,               -- promised delivery date
    expected_payment_date       date,
    completion_date             date,               -- actual completion date

    -- Optional links
    master_product_id           uuid,               -- FK → master_products.id (set null on delete)
    employee_responsible_id     uuid,               -- FK → employees.id (legacy / deprecated)
    appointment_id              uuid,               -- FK → appointments.id (set null on delete)

    -- Multiple responsible employees stored as a JSONB array
    -- Element shape: { "employee_id": "<uuid>" }
    responsible_employees       jsonb,

    -- Lifecycle status
    -- estimate      → initial quote, not yet a work order
    -- open          → accepted, work not yet started
    -- in_progress   → technician is actively working
    -- waiting_for_part → blocked on parts procurement
    -- completed     → work done, awaiting delivery
    -- delivered     → vehicle returned to client
    -- cancelled     → order was voided
    status                      varchar(30)     NOT NULL DEFAULT 'estimate'
                                    CHECK (status IN (
                                        'estimate',
                                        'open',
                                        'in_progress',
                                        'waiting_for_part',
                                        'completed',
                                        'delivered',
                                        'cancelled'
                                    )),

    -- Payment lifecycle
    payment_status              varchar(20)
                                    CHECK (payment_status IN ('pending', 'paid', 'partial')),

    payment_method              varchar(30)
                                    CHECK (payment_method IN (
                                        'pix',
                                        'cash',
                                        'credit_card',
                                        'debit_card',
                                        'check',
                                        'bank_slip',
                                        'transfer',
                                        'no_payment'
                                    )),

    is_installment              boolean         NOT NULL DEFAULT false,
    installment_count           int,

    -- Technical notes
    reported_defect             text,   -- defect as described by the client
    diagnosis                   text,   -- technician's diagnosis

    -- Line items (labour + parts)
    -- Element shape:
    -- {
    --   "product_id": "<uuid>",
    --   "description": "string",
    --   "quantity": number,
    --   "unit_price": number,
    --   "cost_price": number,
    --   "total_price": number,
    --   "total_commission": number,
    --   "commissions": [
    --     {
    --       "employee_id": "<uuid>",
    --       "amount": number,
    --       "type": "fixed|percentage",
    --       "base": number,
    --       "percentage": number
    --     }
    --   ]
    -- }
    items                       jsonb,

    -- Tax settings
    apply_taxes                 boolean         NOT NULL DEFAULT false,

    -- Applied taxes snapshot (rates captured at time of order creation)
    -- Element shape:
    -- {
    --   "tax_id": "<uuid>",
    --   "name": "string",
    --   "type": "string",
    --   "rate": number,
    --   "calculated_amount": number
    -- }
    selected_taxes              jsonb,

    -- Financial totals
    total_taxes_amount          numeric(15, 2)  DEFAULT 0,
    total_amount                numeric(15, 2)  NOT NULL DEFAULT 0,
    total_cost_amount           numeric(15, 2)  DEFAULT 0,
    discount                    numeric(15, 2)  DEFAULT 0,
    commission_amount           numeric(15, 2)  DEFAULT 0,
    terminal_fee_amount         numeric(15, 2)  DEFAULT 0,   -- card machine fee

    -- Fiscal document references (FK constraints added by migrations 33 and 34)
    -- NF-e (Nota Fiscal Eletrônica — goods)
    active_nfe_id               uuid,           -- currently active NF-e
    nfe_ids                     text,           -- JSON array of historical NF-e IDs

    -- NFS-e (Nota Fiscal de Serviços Eletrônica — services)
    active_nfse_id              uuid,           -- currently active NFS-e
    nfse_ids                    text,           -- JSON array of historical NFS-e IDs

    -- Additional notes
    notes                       text,

    -- Audit columns
    created_at                  timestamptz     NOT NULL DEFAULT now(),
    created_by                  varchar(200),
    updated_at                  timestamptz     NOT NULL DEFAULT now(),
    updated_by                  varchar(200),
    deleted_at                  timestamptz,
    deleted_by                  varchar(200),

    -- Constraints
    CONSTRAINT service_orders_pkey
        PRIMARY KEY (id),

    CONSTRAINT service_orders_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT service_orders_client_id_fkey
        FOREIGN KEY (client_id)
        REFERENCES public.clients (id)
        ON DELETE RESTRICT,     -- never silently lose a service order's client

    CONSTRAINT service_orders_vehicle_id_fkey
        FOREIGN KEY (vehicle_id)
        REFERENCES public.vehicles (id)
        ON DELETE SET NULL,

    CONSTRAINT service_orders_master_product_id_fkey
        FOREIGN KEY (master_product_id)
        REFERENCES public.master_products (id)
        ON DELETE SET NULL,

    CONSTRAINT service_orders_employee_responsible_id_fkey
        FOREIGN KEY (employee_responsible_id)
        REFERENCES public.employees (id)
        ON DELETE SET NULL,

    CONSTRAINT service_orders_appointment_id_fkey
        FOREIGN KEY (appointment_id)
        REFERENCES public.appointments (id)
        ON DELETE SET NULL,

    -- Order numbers must be unique within an organization
    CONSTRAINT service_orders_organization_id_number_key
        UNIQUE (organization_id, number)
);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  public.service_orders IS 'Central operational document for each workshop job. Tracks the full lifecycle from estimate to delivery.';
COMMENT ON COLUMN public.service_orders.number                  IS 'Human-readable order number, unique per organization. May include alphanumeric prefixes (e.g. OS-00123).';
COMMENT ON COLUMN public.service_orders.responsible_employees   IS 'JSONB array of responsible technicians. Element: {"employee_id": "<uuid>"}. Supersedes the deprecated employee_responsible_id column.';
COMMENT ON COLUMN public.service_orders.employee_responsible_id IS 'Deprecated legacy single-employee reference. Use responsible_employees JSONB array instead.';
COMMENT ON COLUMN public.service_orders.items                   IS 'Line items (labour and parts). Each element includes product_id, description, quantities, prices, and per-employee commission breakdowns.';
COMMENT ON COLUMN public.service_orders.selected_taxes          IS 'Snapshot of taxes applied at order creation time. Rates are captured to preserve historical accuracy.';
COMMENT ON COLUMN public.service_orders.active_nfe_id           IS 'Currently active NF-e fiscal document. FK constraint added by migration 20240101000033.';
COMMENT ON COLUMN public.service_orders.nfe_ids                 IS 'JSON array of all NF-e IDs ever issued for this order (audit trail).';
COMMENT ON COLUMN public.service_orders.active_nfse_id          IS 'Currently active NFS-e fiscal document. FK constraint added by migration 20240101000034.';
COMMENT ON COLUMN public.service_orders.nfse_ids                IS 'JSON array of all NFS-e IDs ever issued for this order (audit trail).';
COMMENT ON COLUMN public.service_orders.terminal_fee_amount     IS 'Card machine / POS terminal fee charged on the transaction, if applicable.';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant filter — base scan for all service order queries
CREATE INDEX idx_service_orders_organization_id
    ON public.service_orders (organization_id)
    WHERE deleted_at IS NULL;

-- FK indexes
CREATE INDEX idx_service_orders_client_id
    ON public.service_orders (client_id);

CREATE INDEX idx_service_orders_vehicle_id
    ON public.service_orders (vehicle_id);

CREATE INDEX idx_service_orders_appointment_id
    ON public.service_orders (appointment_id);

CREATE INDEX idx_service_orders_employee_responsible_id
    ON public.service_orders (employee_responsible_id);

-- Operational board: filter orders by current lifecycle status
CREATE INDEX idx_service_orders_organization_id_status
    ON public.service_orders (organization_id, status)
    WHERE deleted_at IS NULL;

-- Accounts receivable: filter by payment status
CREATE INDEX idx_service_orders_organization_id_payment_status
    ON public.service_orders (organization_id, payment_status)
    WHERE deleted_at IS NULL;

-- Date-range reports: orders received in a period
CREATE INDEX idx_service_orders_organization_id_entry_date
    ON public.service_orders (organization_id, entry_date)
    WHERE deleted_at IS NULL;

-- Completion reports: orders finished in a period
CREATE INDEX idx_service_orders_organization_id_completion_date
    ON public.service_orders (organization_id, completion_date)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: keep updated_at current on every row modification
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_service_orders_updated_at
    BEFORE UPDATE ON public.service_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

-- SELECT: only rows belonging to the authenticated user's organization
CREATE POLICY "service_orders_select_same_org"
    ON public.service_orders
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

-- INSERT: enforce org scoping at write time
CREATE POLICY "service_orders_insert_same_org"
    ON public.service_orders
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

-- UPDATE: enforce org scoping on both the existing row and the new values
CREATE POLICY "service_orders_update_same_org"
    ON public.service_orders
    FOR UPDATE
    TO authenticated
    USING  (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

-- DELETE: soft deletes are preferred, but hard-delete is also org-scoped
CREATE POLICY "service_orders_delete_same_org"
    ON public.service_orders
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());
