-- ============================================================
-- Migration: 20240101000028_create_billing_invoices.sql
-- Description: Billing invoices table for AutoPro
--              Stores Stripe invoice records synced via webhooks.
--              Authenticated users receive SELECT access only;
--              all writes are performed by service_role.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE: billing_invoices
-- ------------------------------------------------------------
CREATE TABLE public.billing_invoices (
    id                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
    organization_id         uuid                     NOT NULL,

    -- The email address associated with the billed customer
    user_email              varchar(200)             NOT NULL,

    -- Stripe invoice identifier — required and unique per invoice
    stripe_invoice_id       varchar(100)             NOT NULL,

    amount                  numeric(15, 2)           NOT NULL,

    status                  varchar(20)              NOT NULL
                                CONSTRAINT billing_invoices_status_check
                                CHECK (status IN ('paid', 'pending', 'failed', 'cancelled')),

    -- Optional link to the local subscription record
    subscription_id         uuid,

    -- Stripe subscription ID (denormalized for fast webhook lookups)
    stripe_subscription_id  varchar(100),

    -- Human-readable invoice reference
    invoice_number          varchar(50),

    -- Lifecycle dates
    issue_date              timestamptz,
    due_date                timestamptz,
    payment_date            timestamptz,

    -- Hosted invoice PDF URL from Stripe
    pdf_url                 varchar(500),

    description             text,

    -- Audit columns
    created_at              timestamptz              NOT NULL DEFAULT now(),
    created_by              varchar(200),
    updated_at              timestamptz              NOT NULL DEFAULT now(),
    updated_by              varchar(200),
    deleted_at              timestamptz,
    deleted_by              varchar(200),

    -- Constraints
    CONSTRAINT billing_invoices_pkey
        PRIMARY KEY (id),
    CONSTRAINT billing_invoices_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,
    CONSTRAINT billing_invoices_subscription_id_fkey
        FOREIGN KEY (subscription_id)
        REFERENCES public.subscriptions (id)
        ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- COMMENTS
-- ------------------------------------------------------------
COMMENT ON TABLE  public.billing_invoices                          IS 'Stripe invoice records synced per organization. Write access is reserved for service_role only.';
COMMENT ON COLUMN public.billing_invoices.stripe_invoice_id        IS 'Stripe invoice object ID (in_...). Used as the authoritative external reference.';
COMMENT ON COLUMN public.billing_invoices.status                   IS 'Invoice payment lifecycle: pending → paid / failed / cancelled.';
COMMENT ON COLUMN public.billing_invoices.subscription_id          IS 'Local FK to subscriptions; nullable to handle invoices before subscription is recorded.';
COMMENT ON COLUMN public.billing_invoices.stripe_subscription_id   IS 'Denormalized Stripe subscription ID for fast webhook correlation.';
COMMENT ON COLUMN public.billing_invoices.pdf_url                  IS 'Hosted PDF URL provided by Stripe (may expire; refresh from webhook if needed).';

-- ------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- ------------------------------------------------------------
CREATE TRIGGER trg_billing_invoices_updated_at
    BEFORE UPDATE ON public.billing_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------

-- Org-scoped partial index (primary lookup, soft-delete aware)
CREATE INDEX idx_billing_invoices_organization_id
    ON public.billing_invoices (organization_id)
    WHERE deleted_at IS NULL;

-- FK index
CREATE INDEX idx_billing_invoices_subscription_id
    ON public.billing_invoices (subscription_id);

-- Stripe lookups (used by webhook handlers)
CREATE INDEX idx_billing_invoices_stripe_invoice_id
    ON public.billing_invoices (stripe_invoice_id);

-- Composite: filter by org + status (e.g., "show failed invoices")
CREATE INDEX idx_billing_invoices_org_status
    ON public.billing_invoices (organization_id, status)
    WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Authenticated users may only read their own org's invoices.
-- All writes (INSERT / UPDATE / DELETE) are handled by service_role,
-- which bypasses RLS entirely — no write policies are defined.
-- ------------------------------------------------------------
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_invoices_select_same_org"
    ON public.billing_invoices
    FOR SELECT TO authenticated
    USING (organization_id = public.current_user_organization_id());
