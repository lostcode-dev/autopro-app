-- =============================================================================
-- FILE: 20240101000000_setup.sql
-- PROJECT: AutoPro — Automotive Workshop Management (Multi-Tenant SaaS)
-- PURPOSE: Install required PostgreSQL extensions and create shared helper
--          functions used across all subsequent migrations.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------

-- uuid-ossp: provides uuid_generate_v4() for primary key generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgcrypto: provides gen_random_bytes(), crypt(), etc. for hashing / tokens
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ---------------------------------------------------------------------------
-- FUNCTION: public.set_updated_at()
-- PURPOSE : Trigger function that automatically stamps updated_at with the
--           current timestamp whenever a row is modified.  Every table in
--           this schema attaches a BEFORE UPDATE trigger that calls this
--           function so callers never need to set updated_at manually.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Trigger function: sets updated_at = now() before every UPDATE. '
  'Attach via a BEFORE UPDATE FOR EACH ROW trigger on every table.';


-- ---------------------------------------------------------------------------
-- FUNCTION: public.current_user_organization_id()
-- PURPOSE : Returns the organization_id that belongs to the currently
--           authenticated Supabase user (auth.uid()).  Used inside RLS
--           policies to scope every query to the caller''s tenant without
--           requiring the application layer to pass the org ID explicitly.
--
-- SECURITY: SECURITY DEFINER so the function can read user_profiles even
--           when RLS on that table would otherwise block access.
--           search_path is pinned to "public" to prevent search-path attacks.
--
-- NOTE    : user_profiles is created in migration 20240101000036 (migration
--           37).  Because this function is resolved at call time (STABLE, not
--           IMMUTABLE), forward-referencing the table is safe — the table
--           will exist by the time any RLS policy actually fires.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organization_id
    INTO v_org_id
  FROM public.user_profiles
  WHERE user_id = (auth.uid())::text
    AND deleted_at IS NULL
  LIMIT 1;

  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION public.current_user_organization_id() IS
  'Returns the organization_id for the currently authenticated user. '
  'SECURITY DEFINER — reads user_profiles bypassing RLS. '
  'Used inside RLS USING / WITH CHECK expressions across all tenant-scoped tables.';
