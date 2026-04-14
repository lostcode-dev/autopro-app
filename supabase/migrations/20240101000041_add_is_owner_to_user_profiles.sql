-- =============================================================================
-- Migration: 20240101000041_add_is_owner_to_user_profiles.sql
-- Description: Adds an is_owner flag to user_profiles to identify the system
--              owner/admin who bypasses the subscription/onboarding flow and
--              is redirected directly to the /admin area after login.
--
--              This flag is managed exclusively by the service_role (never
--              self-assignable by authenticated users via RLS policies).
-- =============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.is_owner IS
  'When true, identifies this user as the system owner/admin. '
  'Owners bypass the subscription flow and are routed to /admin. '
  'This flag must only be set server-side via the service_role.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_owner
  ON public.user_profiles (is_owner)
  WHERE is_owner = true;
