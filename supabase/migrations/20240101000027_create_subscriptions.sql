-- ============================================================
-- Migration: 20240101000027_create_subscriptions.sql
-- Description: Subscriptions table for AutoPro
--              Tracks Stripe-backed subscription state per
--              organization. Mutations are performed exclusively
--              via service_role (webhooks / backend functions);
--              authenticated users receive SELECT access only.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE: subscriptions
-- ------------------------------------------------------------
CREATE TABLE public.subscriptions (
    id                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
    organization_id         uuid                     NOT NULL,

    -- The email address associated with the Stripe customer
    user_email              varchar(200)             NOT NULL,

    status                  varchar(20)              NOT NULL
                                CONSTRAINT subscriptions_status_check
                                CHECK (status IN ('active', 'cancelled', 'suspended', 'trial')),

    -- Stripe identifiers (nullable until customer/subscription is created)
    stripe_customer_id      varchar(100),
    stripe_subscription_id  varchar(100),

    plan_name               varchar(100),
    monthly_amount          numeric(15, 2),

    -- Lifecycle dates
    start_date              timestamptz,
    next_payment_date       timestamptz,
    cancellation_date       timestamptz,

    -- Audit columns
    created_at              timestamptz              NOT NULL DEFAULT now(),
    created_by              varchar(200),
    updated_at              timestamptz              NOT NULL DEFAULT now(),
    updated_by              varchar(200),
    deleted_at              timestamptz,
    deleted_by              varchar(200),

    -- Constraints
    CONSTRAINT subscriptions_pkey
        PRIMARY KEY (id),
    CONSTRAINT subscriptions_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- COMMENTS
-- ------------------------------------------------------------
COMMENT ON TABLE  public.subscriptions                          IS 'Stripe subscription state per organization. Write access is reserved for service_role only.';
COMMENT ON COLUMN public.subscriptions.status                  IS 'Subscription lifecycle: trial → active → suspended/cancelled.';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id      IS 'Stripe customer object ID (cus_...).';
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id  IS 'Stripe subscription object ID (sub_...).';
COMMENT ON COLUMN public.subscriptions.monthly_amount          IS 'Recurring charge amount in the organization''s billing currency.';
COMMENT ON COLUMN public.subscriptions.next_payment_date       IS 'Next scheduled billing date, synced from Stripe webhooks.';

-- ------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- ------------------------------------------------------------
CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------

-- Org-scoped partial index (primary lookup, soft-delete aware)
CREATE INDEX idx_subscriptions_organization_id
    ON public.subscriptions (organization_id)
    WHERE deleted_at IS NULL;

-- Stripe lookups (used by webhook handlers)
CREATE INDEX idx_subscriptions_stripe_customer_id
    ON public.subscriptions (stripe_customer_id);

CREATE INDEX idx_subscriptions_stripe_subscription_id
    ON public.subscriptions (stripe_subscription_id);

-- Composite: filter active/trial subscriptions per org
CREATE INDEX idx_subscriptions_org_status
    ON public.subscriptions (organization_id, status)
    WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Authenticated users may only read their own org's subscription.
-- All writes (INSERT / UPDATE / DELETE) are handled by service_role,
-- which bypasses RLS entirely — no write policies are defined.
-- ------------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_same_org"
    ON public.subscriptions
    FOR SELECT TO authenticated
    USING (organization_id = public.current_user_organization_id());
