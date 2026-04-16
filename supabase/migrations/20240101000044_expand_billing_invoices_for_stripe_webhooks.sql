-- ============================================================
-- Migration: 20240101000044_expand_billing_invoices_for_stripe_webhooks.sql
-- Description: Expands billing_invoices to cover the broader Stripe
--              invoice lifecycle handled by the webhook.
-- ============================================================

ALTER TABLE public.billing_invoices
  DROP CONSTRAINT IF EXISTS billing_invoices_status_check;

ALTER TABLE public.billing_invoices
  ADD CONSTRAINT billing_invoices_status_check
  CHECK (status IN (
    'draft',
    'open',
    'paid',
    'failed',
    'action_required',
    'pending',
    'overdue',
    'uncollectible',
    'voided',
    'finalization_failed',
    'cancelled'
  ));

ALTER TABLE public.billing_invoices
  ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(100),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_overpaid numeric(15, 2),
  ADD COLUMN IF NOT EXISTS collection_method varchar(50),
  ADD COLUMN IF NOT EXISTS period_start timestamptz,
  ADD COLUMN IF NOT EXISTS period_end timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_payment_attempt timestamptz,
  ADD COLUMN IF NOT EXISTS hosted_invoice_url varchar(500),
  ADD COLUMN IF NOT EXISTS raw_data jsonb;

CREATE INDEX IF NOT EXISTS idx_billing_invoices_stripe_customer_id
  ON public.billing_invoices (stripe_customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_invoices_stripe_invoice_id
  ON public.billing_invoices (stripe_invoice_id);

COMMENT ON COLUMN public.billing_invoices.status IS
  'Expanded invoice lifecycle synced from Stripe webhooks, including draft/open/payment and collection states.';

COMMENT ON COLUMN public.billing_invoices.stripe_customer_id IS
  'Stripe customer object ID (cus_...) associated with the invoice.';

COMMENT ON COLUMN public.billing_invoices.sent_at IS
  'Timestamp when Stripe marked the invoice as sent.';

COMMENT ON COLUMN public.billing_invoices.amount_overpaid IS
  'Amount paid above the invoice total, when applicable.';

COMMENT ON COLUMN public.billing_invoices.collection_method IS
  'Stripe collection method used for the invoice, such as charge_automatically or send_invoice.';

COMMENT ON COLUMN public.billing_invoices.period_start IS
  'Start timestamp of the billing period represented by the invoice.';

COMMENT ON COLUMN public.billing_invoices.period_end IS
  'End timestamp of the billing period represented by the invoice.';

COMMENT ON COLUMN public.billing_invoices.attempt_count IS
  'Number of payment attempts reported by Stripe for this invoice.';

COMMENT ON COLUMN public.billing_invoices.next_payment_attempt IS
  'Next scheduled payment attempt reported by Stripe.';

COMMENT ON COLUMN public.billing_invoices.hosted_invoice_url IS
  'Hosted Stripe URL where the customer can view and pay the invoice.';

COMMENT ON COLUMN public.billing_invoices.raw_data IS
  'Full Stripe invoice payload stored for audit/debugging purposes.';
