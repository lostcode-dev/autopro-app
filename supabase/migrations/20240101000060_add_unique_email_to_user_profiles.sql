-- =============================================================================
-- Migration: 20240101000060_add_unique_email_to_user_profiles.sql
-- Description: Enforces uniqueness of the email column in user_profiles.
--
--  1. Removes duplicate rows: for each email that appears more than once,
--     keeps the row with organization_id set (or the most recently created
--     one if none has organization_id), and deletes the orphaned duplicates.
--
--  2. Adds a partial unique index on email (NULL values are excluded so
--     profiles without email — created before migration 040 — are not
--     affected).
--
-- Root cause addressed: if a Supabase auth user was deleted but their
-- user_profiles row was not, a subsequent grant-access call for the same
-- email would create a second auth user + a second profile row, since the
-- UPSERT in ensureUserProvisioned only conflicts on user_id.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Remove duplicate profiles, keeping the most useful row per email
-- ---------------------------------------------------------------------------
DELETE FROM public.user_profiles
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY email
        ORDER BY
          (organization_id IS NOT NULL) DESC,
          created_at DESC
      ) AS rn
    FROM public.user_profiles
    WHERE email IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- ---------------------------------------------------------------------------
-- 2. Add partial unique index — only enforces uniqueness for non-NULL emails
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email_unique
  ON public.user_profiles (email)
  WHERE email IS NOT NULL;

COMMENT ON INDEX public.idx_user_profiles_email_unique IS
  'Ensures one active profile per email address. NULL emails (legacy rows) are excluded.';
