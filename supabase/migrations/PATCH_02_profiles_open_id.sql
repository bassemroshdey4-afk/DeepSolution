-- ============================================================
-- PATCH_02_profiles_open_id.sql
-- Purpose: Add open_id column to profiles for Manus OAuth integration
-- Idempotent: Safe to run multiple times
-- ============================================================

-- STEP 1: Add open_id column to profiles
-- This column stores the Manus OAuth openId (string format)
-- while keeping profiles.id as UUID for internal references
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS open_id TEXT;

-- STEP 2: Create unique index on open_id (partial - only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_open_id
  ON public.profiles(open_id)
  WHERE open_id IS NOT NULL;

-- STEP 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_open_id_lookup
  ON public.profiles(open_id);

-- STEP 4: Update existing profiles that have id as their open_id
-- (This handles any profiles created before this patch)
-- Skip this if you don't have legacy data
-- UPDATE public.profiles 
-- SET open_id = id::text 
-- WHERE open_id IS NULL;

-- ============================================================
-- VERIFICATION QUERIES (Run after patch to confirm)
-- ============================================================

-- Check column exists:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'open_id';

-- Check index exists:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'profiles' AND indexname LIKE '%open_id%';

-- ============================================================
-- HOW TO RUN:
-- 1. Open Supabase Dashboard -> SQL Editor
-- 2. Copy/Paste this entire file
-- 3. Click Run
-- ============================================================
