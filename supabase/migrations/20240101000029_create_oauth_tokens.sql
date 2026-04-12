-- ============================================================
-- Migration: 20240101000029_create_oauth_tokens.sql
-- Description: OAuth tokens table for AutoPro
--              Stores server-side provider OAuth tokens
--              (e.g., Nuvem Fiscal client_credentials flow).
--              This table is NOT tenant-scoped — tokens are
--              global to the server process. RLS is enabled with
--              no policies for authenticated users; only
--              service_role (backend functions) can read/write.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE: oauth_tokens
-- ------------------------------------------------------------
CREATE TABLE public.oauth_tokens (
    id           uuid                     NOT NULL DEFAULT gen_random_uuid(),

    -- Provider identifier, e.g. 'nuvemfiscal', 'google', etc.
    provider     varchar(50)              NOT NULL,

    access_token text                     NOT NULL,
    expires_at   timestamptz              NOT NULL,

    -- Optional fields populated from the token response
    token_type   varchar(50),   -- typically 'Bearer'
    expires_in   int,           -- seconds until expiry (from token response)
    scope        varchar(300),  -- space-separated OAuth scopes granted

    -- Audit columns
    created_at   timestamptz              NOT NULL DEFAULT now(),
    created_by   varchar(200),
    updated_at   timestamptz              NOT NULL DEFAULT now(),
    updated_by   varchar(200),
    deleted_at   timestamptz,
    deleted_by   varchar(200),

    -- Constraints
    CONSTRAINT oauth_tokens_pkey
        PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- COMMENTS
-- ------------------------------------------------------------
COMMENT ON TABLE  public.oauth_tokens              IS 'Server-side OAuth access tokens for third-party providers (e.g., Nuvem Fiscal). Accessible only by service_role.';
COMMENT ON COLUMN public.oauth_tokens.provider     IS 'Provider slug, e.g. ''nuvemfiscal''. Used to look up the current valid token for a given integration.';
COMMENT ON COLUMN public.oauth_tokens.access_token IS 'Raw bearer token value. Treat as a secret; only accessible via service_role.';
COMMENT ON COLUMN public.oauth_tokens.expires_at   IS 'Absolute UTC timestamp after which the token must be refreshed before use.';
COMMENT ON COLUMN public.oauth_tokens.expires_in   IS 'Original TTL in seconds returned by the provider token endpoint (informational).';
COMMENT ON COLUMN public.oauth_tokens.scope        IS 'OAuth scopes granted by the provider, space-separated.';

-- ------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- ------------------------------------------------------------
CREATE TRIGGER trg_oauth_tokens_updated_at
    BEFORE UPDATE ON public.oauth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------

-- Provider lookup: find the current token for a given provider
CREATE INDEX idx_oauth_tokens_provider
    ON public.oauth_tokens (provider);

-- Expiry-based lookups: find tokens that are about to expire / already expired
CREATE INDEX idx_oauth_tokens_expires_at
    ON public.oauth_tokens (expires_at);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- RLS is enabled but NO policies are granted to the authenticated
-- role. Only service_role (which bypasses RLS) can access this
-- table. This ensures OAuth tokens are never exposed to client-
-- side queries, even if a user crafts a direct PostgREST request.
-- ------------------------------------------------------------
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- No policies for the authenticated role.
-- service_role bypasses RLS by design (Supabase default behavior).
