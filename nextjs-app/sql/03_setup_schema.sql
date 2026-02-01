-- DeepSolution Setup Schema
-- Run this in Supabase SQL Editor
-- Version: 1.0.0

-- ============================================
-- TENANT_SETUP TABLE (Core setup progress)
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  setup_completed BOOLEAN DEFAULT false,
  
  -- Step 1: Order Sources
  order_sources TEXT[] DEFAULT '{}',
  
  -- Step 2: Warehouses
  multi_warehouse BOOLEAN DEFAULT false,
  
  -- Step 3: Customer Support Mode
  support_mode TEXT DEFAULT 'human' CHECK (support_mode IN ('human', 'bot', 'hybrid')),
  
  -- Step 4: AI Bots Config
  ai_bots_enabled BOOLEAN DEFAULT false,
  whatsapp_bot_enabled BOOLEAN DEFAULT false,
  meta_bot_enabled BOOLEAN DEFAULT false,
  sales_agent_enabled BOOLEAN DEFAULT false,
  training_sources TEXT[] DEFAULT '{}',
  
  -- Step 5: Staff
  staff_count INTEGER DEFAULT 1,
  
  -- Step 6: Platforms
  platforms_enabled TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

-- Index for faster tenant queries
CREATE INDEX IF NOT EXISTS idx_tenant_setup_tenant ON tenant_setup(tenant_id);

-- ============================================
-- WAREHOUSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'SA',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON warehouses(tenant_id);

-- ============================================
-- STAFF_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent', 'warehouse', 'support')),
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_members_tenant ON staff_members(tenant_id);

-- ============================================
-- AI_BOT_SCENARIOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_bot_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('order_confirmation', 'sales', 'support', 'escalation', 'follow_up')),
  is_enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_bot_scenarios_tenant ON ai_bot_scenarios(tenant_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE tenant_setup ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_bot_scenarios ENABLE ROW LEVEL SECURITY;

-- tenant_setup policies
DROP POLICY IF EXISTS "tenant_setup_select" ON tenant_setup;
CREATE POLICY "tenant_setup_select" ON tenant_setup FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tenant_setup_insert" ON tenant_setup;
CREATE POLICY "tenant_setup_insert" ON tenant_setup FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tenant_setup_update" ON tenant_setup;
CREATE POLICY "tenant_setup_update" ON tenant_setup FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- warehouses policies
DROP POLICY IF EXISTS "warehouses_select" ON warehouses;
CREATE POLICY "warehouses_select" ON warehouses FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "warehouses_insert" ON warehouses;
CREATE POLICY "warehouses_insert" ON warehouses FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "warehouses_update" ON warehouses;
CREATE POLICY "warehouses_update" ON warehouses FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "warehouses_delete" ON warehouses;
CREATE POLICY "warehouses_delete" ON warehouses FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- staff_members policies
DROP POLICY IF EXISTS "staff_members_select" ON staff_members;
CREATE POLICY "staff_members_select" ON staff_members FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_members_insert" ON staff_members;
CREATE POLICY "staff_members_insert" ON staff_members FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "staff_members_update" ON staff_members;
CREATE POLICY "staff_members_update" ON staff_members FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

-- ai_bot_scenarios policies
DROP POLICY IF EXISTS "ai_bot_scenarios_select" ON ai_bot_scenarios;
CREATE POLICY "ai_bot_scenarios_select" ON ai_bot_scenarios FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ai_bot_scenarios_insert" ON ai_bot_scenarios;
CREATE POLICY "ai_bot_scenarios_insert" ON ai_bot_scenarios FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ai_bot_scenarios_update" ON ai_bot_scenarios;
CREATE POLICY "ai_bot_scenarios_update" ON ai_bot_scenarios FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
