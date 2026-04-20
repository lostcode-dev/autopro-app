-- =============================================================================
-- Migration: 20240101000052_create_support_system.sql
-- Description: Creates the support ticket tables (feedbacks, feedback_attachments,
--              feedback_responses) and the storage bucket for media attachments.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: feedbacks (support tickets)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id              uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         varchar(100)    NOT NULL,
    type            varchar(20)     NOT NULL DEFAULT 'suggestion'
                        CHECK (type IN ('bug', 'suggestion', 'improvement', 'praise')),
    title           varchar(200)    NOT NULL,
    description     text            NOT NULL,
    tech_context    jsonb,
    status          varchar(20)     NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted', 'in_review', 'resolved', 'closed')),
    priority        varchar(20)     NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id
    ON public.feedbacks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedbacks_status
    ON public.feedbacks (status);

-- -----------------------------------------------------------------------------
-- TABLE: feedback_attachments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_attachments (
    id              uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
    feedback_id     uuid            NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
    file_name       varchar(500)    NOT NULL,
    file_url        text            NOT NULL,
    file_type       varchar(100)    NOT NULL,
    file_size       bigint,
    created_at      timestamptz     NOT NULL DEFAULT now()
);

-- Add file_size column if table already existed without it
ALTER TABLE public.feedback_attachments
    ADD COLUMN IF NOT EXISTS file_size bigint;

CREATE INDEX IF NOT EXISTS idx_feedback_attachments_feedback_id
    ON public.feedback_attachments (feedback_id);

-- -----------------------------------------------------------------------------
-- TABLE: feedback_responses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_responses (
    id              uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
    feedback_id     uuid            NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
    user_id         varchar(100)    NOT NULL,
    content         text            NOT NULL,
    is_admin        boolean         NOT NULL DEFAULT false,
    created_at      timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_feedback_id
    ON public.feedback_responses (feedback_id, created_at ASC);

-- -----------------------------------------------------------------------------
-- TABLE: feedback_entity_links (kept for backwards compatibility)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_entity_links (
    id              uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
    feedback_id     uuid            NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
    entity_type     varchar(50)     NOT NULL,
    entity_id       varchar(100),
    external_url    text,
    created_at      timestamptz     NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- STORAGE BUCKET: support-attachments
-- Stores images (max 10 MB) and videos (max 100 MB) per attachment.
-- The server-side upload endpoint enforces per-type size limits.
-- MAX_ATTACHMENTS per ticket: configured in FeedbackCreateModal.vue (default: 5)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'support-attachments',
    'support-attachments',
    true,
    10485760,   -- 10 MB (bucket-level cap; per-type limits enforced in API)
    ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/quicktime'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- Public read (attachments are accessed via public URL)
CREATE POLICY "support-attachments public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'support-attachments');

CREATE POLICY "support-attachments service role insert"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'support-attachments');

CREATE POLICY "support-attachments service role update"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'support-attachments');

CREATE POLICY "support-attachments service role delete"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'support-attachments');
