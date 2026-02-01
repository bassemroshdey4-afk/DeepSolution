-- DeepSolution Onboarding Schema
-- Run this in Supabase SQL Editor
-- Version: 1.0.0

-- ============================================
-- TENANT_ONBOARDING TABLE
-- Stores onboarding progress and data for each tenant
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Progress tracking
  current_step INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  
  -- Step 0: Language & Country
  language TEXT DEFAULT 'ar',
  country TEXT,
  suggested_currency TEXT,
  suggested_timezone TEXT,
  
  -- Step 1: Company/Store Info
  company_name TEXT,
  company_slug TEXT,
  logo_url TEXT,
  
  -- Step 2: Currency & Timezone
  currency TEXT,
  timezone TEXT,
  default_language TEXT,
  
  -- Step 3: Monthly Orders (for plan recommendation)
  monthly_orders TEXT CHECK (monthly_orders IN ('0-50', '51-300', '301-1500', '1500+')),
  recommended_plan TEXT,
  
  -- Step 4: Industry & Sales Channels
  industry TEXT,
  sales_channels TEXT[], -- Array of channels: ['website', 'instagram', 'facebook', 'whatsapp', 'physical']
  
  -- Step 5: Basic Operations
  multi_warehouse BOOLEAN DEFAULT false,
  cod_enabled BOOLEAN DEFAULT true,
  team_size TEXT CHECK (team_size IN ('solo', '2-5', '6-20', '20+')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one onboarding record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_user ON tenant_onboarding(user_id);

-- Index for tenant lookup
CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON tenant_onboarding(tenant_id);

-- ============================================
-- ADD onboarding_completed TO PROFILES (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
      ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
    END IF;
  END IF;
END $$;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS update_tenant_onboarding_updated_at ON tenant_onboarding;
CREATE TRIGGER update_tenant_onboarding_updated_at
  BEFORE UPDATE ON tenant_onboarding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE tenant_onboarding ENABLE ROW LEVEL SECURITY;

-- Users can only see their own onboarding data
DROP POLICY IF EXISTS "Users can view own onboarding" ON tenant_onboarding;
CREATE POLICY "Users can view own onboarding" ON tenant_onboarding
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own onboarding data
DROP POLICY IF EXISTS "Users can insert own onboarding" ON tenant_onboarding;
CREATE POLICY "Users can insert own onboarding" ON tenant_onboarding
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own onboarding data
DROP POLICY IF EXISTS "Users can update own onboarding" ON tenant_onboarding;
CREATE POLICY "Users can update own onboarding" ON tenant_onboarding
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- HELPER FUNCTION: Get or create onboarding record
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_onboarding(p_user_id UUID)
RETURNS tenant_onboarding AS $$
DECLARE
  v_record tenant_onboarding;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_record FROM tenant_onboarding WHERE user_id = p_user_id;
  
  -- If not found, create new one
  IF v_record IS NULL THEN
    INSERT INTO tenant_onboarding (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_record;
  END IF;
  
  RETURN v_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
