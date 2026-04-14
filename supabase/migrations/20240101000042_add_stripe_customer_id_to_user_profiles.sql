-- =============================================================================
-- Migration: 20240101000042_add_stripe_customer_id_to_user_profiles.sql
-- Description: Adds stripe_customer_id to user_profiles so each user can
--              have a Stripe customer tracked independently of having an
--              organization. This allows the checkout flow to reuse the same
--              Stripe customer across multiple checkout attempts and supports
--              subscription recovery without creating duplicate customers.
-- =============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(100);

COMMENT ON COLUMN public.user_profiles.stripe_customer_id IS
  'Stripe customer object ID (cus_...) associated with this user. '
  'Set by the checkout endpoint and reused on subsequent checkout sessions. '
  'Managed exclusively server-side via service_role.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id
  ON public.user_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
