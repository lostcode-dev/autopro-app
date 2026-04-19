-- =============================================================================
-- Migration: 20240101000049_add_photo_url_to_employees.sql
-- Description: Adds photo_url column to employees table so that profile
--              pictures uploaded by users are also reflected on their
--              employee record (used for avatars in employee listings).
-- =============================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS photo_url varchar(500);

COMMENT ON COLUMN public.employees.photo_url IS
  'Fully-qualified URL to the employee profile picture (e.g. Supabase Storage URL).';
