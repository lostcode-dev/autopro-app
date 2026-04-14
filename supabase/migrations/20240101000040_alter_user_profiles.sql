-- =============================================================================
-- Migration: 20240101000040_alter_user_profiles.sql
-- Description: Two adjustments to the user_profiles table to support the
--              real sign-up / on-boarding flow:
--
--  1. Make organization_id nullable.
--     A profile row is created immediately when a user signs up, before they
--     are linked to any organisation.  The FK constraint is kept so that any
--     non-NULL value must still reference a valid organisation.
--
--  2. Add an email column (pulled from auth.users at profile creation time).
--     Several server-side helpers look up profiles by email; without this
--     column those lookups always return NULL.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Make organization_id nullable
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ALTER COLUMN organization_id DROP NOT NULL;

COMMENT ON COLUMN public.user_profiles.organization_id IS
  'Tenant scope. NULL until the user completes onboarding and is linked to an '
  'organisation via POST /api/users/assign-organization.';

-- ---------------------------------------------------------------------------
-- 2. Add email column
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email varchar(320);

COMMENT ON COLUMN public.user_profiles.email IS
  'The user''s email address, copied from auth.users at profile-creation time. '
  'Used for lookups by email without crossing into the auth schema.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_email
  ON public.user_profiles (email);
