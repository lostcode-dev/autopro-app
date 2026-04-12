-- ============================================================
-- Migration: 20240101000026_create_business_analyses.sql
-- Description: Business analyses table for AutoPro
--              Stores AI-generated or manual business health
--              snapshots including score, strengths, improvement
--              areas, growth strategies, and financial/customer
--              analysis narratives.
-- ============================================================

-- ------------------------------------------------------------
-- TABLE: business_analyses
-- ------------------------------------------------------------
CREATE TABLE public.business_analyses (
    id                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
    organization_id     uuid                     NOT NULL,

    title               varchar(200)             NOT NULL,
    analysis_date       timestamptz              NOT NULL DEFAULT now(),

    -- Overall health score (0–100)
    business_score      int                      NOT NULL
                            CONSTRAINT business_analyses_score_range_check
                            CHECK (business_score BETWEEN 0 AND 100),

    executive_summary   text                     NOT NULL,

    -- JSON arrays / objects for structured insight data
    -- strengths: string[]
    strengths           jsonb,
    -- improvement_areas: string[]
    improvement_areas   jsonb,
    -- growth_strategies: [{title: string, description: string}]
    growth_strategies   jsonb,

    -- Free-text narrative sections
    financial_analysis  text,
    customer_analysis   text,

    -- Snapshot of the raw data used to produce this analysis
    -- (allows reproducibility / audit without re-querying live data)
    base_data           jsonb,

    -- Audit columns
    created_at          timestamptz              NOT NULL DEFAULT now(),
    created_by          varchar(200),
    updated_at          timestamptz              NOT NULL DEFAULT now(),
    updated_by          varchar(200),
    deleted_at          timestamptz,
    deleted_by          varchar(200),

    -- Constraints
    CONSTRAINT business_analyses_pkey
        PRIMARY KEY (id),
    CONSTRAINT business_analyses_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- COMMENTS
-- ------------------------------------------------------------
COMMENT ON TABLE  public.business_analyses                       IS 'Periodic business health analyses per organization (AI-generated or manual).';
COMMENT ON COLUMN public.business_analyses.business_score       IS 'Composite health score from 0 (critical) to 100 (excellent).';
COMMENT ON COLUMN public.business_analyses.strengths            IS 'JSON string array listing identified business strengths.';
COMMENT ON COLUMN public.business_analyses.improvement_areas    IS 'JSON string array listing areas that need improvement.';
COMMENT ON COLUMN public.business_analyses.growth_strategies    IS 'JSON array of objects: [{title: string, description: string}].';
COMMENT ON COLUMN public.business_analyses.base_data            IS 'Snapshot of KPIs and raw data used at analysis time for audit/reproducibility.';

-- ------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- ------------------------------------------------------------
CREATE TRIGGER trg_business_analyses_updated_at
    BEFORE UPDATE ON public.business_analyses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------

-- Org-scoped partial index (primary lookup, soft-delete aware)
CREATE INDEX idx_business_analyses_organization_id
    ON public.business_analyses (organization_id)
    WHERE deleted_at IS NULL;

-- Composite: filter by org + date (e.g., history timeline)
CREATE INDEX idx_business_analyses_org_analysis_date
    ON public.business_analyses (organization_id, analysis_date)
    WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
ALTER TABLE public.business_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_analyses_select_same_org"
    ON public.business_analyses
    FOR SELECT TO authenticated
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY "business_analyses_insert_same_org"
    ON public.business_analyses
    FOR INSERT TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "business_analyses_update_same_org"
    ON public.business_analyses
    FOR UPDATE TO authenticated
    USING  (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "business_analyses_delete_same_org"
    ON public.business_analyses
    FOR DELETE TO authenticated
    USING (organization_id = public.current_user_organization_id());
