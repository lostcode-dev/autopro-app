-- =============================================================================
-- Migration: 20240101000043_add_onboarding_to_organizations.sql
-- Description: Two adjustments to support the post-subscription onboarding:
--
--  1. Add onboarding_completed flag.
--     When a user subscribes, the webhook creates an organization with minimal
--     data (just a name). The user is then required to complete the onboarding
--     wizard (company details, phone, person type) before accessing /app.
--     This flag is set to true when they submit the onboarding form.
--
--  2. Add DEFAULT 'pj' to person_type.
--     The webhook creates organizations without knowing person_type upfront.
--     A default of 'pj' prevents the INSERT from failing; the user corrects
--     it during onboarding.
-- =============================================================================

-- 1. Onboarding completion flag
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.onboarding_completed IS
  'Set to true once the user completes the post-subscription onboarding wizard '
  '(fills in company name, phone, person_type, etc.). Until true, the user is '
  'held on /onboarding and cannot access /app.';

-- 2. Safe default for person_type so webhook INSERTs do not fail
ALTER TABLE public.organizations
  ALTER COLUMN person_type SET DEFAULT 'pj';

COMMENT ON COLUMN public.organizations.person_type IS
  'pf = Pessoa Física, pj = Pessoa Jurídica. Defaults to pj on creation; '
  'corrected by the user during onboarding.';
