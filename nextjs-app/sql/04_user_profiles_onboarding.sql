-- =====================================================
-- DeepSolution: User Profiles + Mandatory Onboarding
-- File: 04_user_profiles_onboarding.sql
-- Purpose: Create user_profiles table with onboarding tracking
-- =====================================================

-- =====================================================
-- 1. CREATE user_profiles TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Company/Business Info (from onboarding)
    company_name TEXT,
    country TEXT,
    language TEXT,
    currency TEXT,
    monthly_orders INTEGER,
    plan_recommendation TEXT,
    
    -- Onboarding Status (Source of Truth)
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    onboarding_step INTEGER NOT NULL DEFAULT 1,
    
    -- Setup Wizard Data
    order_sources TEXT[] DEFAULT '{}',
    multi_warehouse BOOLEAN DEFAULT FALSE,
    support_mode TEXT DEFAULT 'human' CHECK (support_mode IN ('human', 'bot', 'hybrid')),
    ai_bots_enabled BOOLEAN DEFAULT FALSE,
    whatsapp_bot_enabled BOOLEAN DEFAULT FALSE,
    meta_bot_enabled BOOLEAN DEFAULT FALSE,
    sales_agent_enabled BOOLEAN DEFAULT FALSE,
    training_sources TEXT[] DEFAULT '{}',
    staff_count INTEGER DEFAULT 1,
    platforms_enabled TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. CREATE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding 
ON public.user_profiles(onboarding_completed);

-- =====================================================
-- 3. ENABLE RLS
-- =====================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================
-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- Users can only read their own profile
CREATE POLICY "Users can view own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (for edge cases)
CREATE POLICY "Users can insert own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- =====================================================
-- 5. AUTO-CREATE PROFILE TRIGGER
-- =====================================================
-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, created_at, updated_at)
    VALUES (NEW.id, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 6. UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 7. MIGRATION: Create profiles for existing users
-- =====================================================
INSERT INTO public.user_profiles (id, onboarding_completed, onboarding_step, created_at, updated_at)
SELECT 
    id,
    FALSE,  -- Force onboarding for existing users
    1,
    COALESCE(created_at, NOW()),
    NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES (Run after execution)
-- =====================================================
-- SELECT COUNT(*) as total_profiles FROM public.user_profiles;
-- SELECT id, onboarding_completed, onboarding_step FROM public.user_profiles LIMIT 10;
-- SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
