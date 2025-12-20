-- ============================================================================
-- 10_feature_flags.sql
-- Purpose: Feature Flags System for Private Alpha Deployment
-- Supports: Global, Tenant, and User-level flags
-- ============================================================================

SET search_path TO public, auth;

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE flag_level AS ENUM ('global', 'tenant', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE flag_status AS ENUM ('enabled', 'disabled', 'super_admin_only');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- FEATURE FLAGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_status flag_status NOT NULL DEFAULT 'disabled',
  category VARCHAR(50),
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);

-- ============================================================================
-- TENANT FEATURE FLAGS (Override per tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  status flag_status NOT NULL,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, flag_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_tenant ON tenant_feature_flags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_flag ON tenant_feature_flags(flag_id);

-- ============================================================================
-- USER FEATURE FLAGS (Override per user - for Super Admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  status flag_status NOT NULL,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, flag_id)
);

CREATE INDEX IF NOT EXISTS idx_user_feature_flags_user ON user_feature_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_flag ON user_feature_flags(flag_id);

-- ============================================================================
-- SUPER ADMIN TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_admins_user ON super_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_super_admins_active ON super_admins(user_id, is_active);

-- ============================================================================
-- AI USAGE LOGS (For cost tracking and kill-switch)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feature_key VARCHAR(100) NOT NULL,
  model VARCHAR(50),
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  estimated_cost_usd DECIMAL(10,6) DEFAULT 0,
  run_status VARCHAR(20) DEFAULT 'completed',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant ON ai_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature ON ai_usage_logs(feature_key);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);

-- ============================================================================
-- AUDIT LOGS (For Super Admin visibility)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================================
-- INSERT DEFAULT FEATURE FLAGS (Alpha Defaults)
-- ============================================================================

INSERT INTO feature_flags (flag_key, name, description, default_status, category, is_system) VALUES
  ('enable_public_signup', 'Public Signup', 'Allow new users to sign up publicly', 'disabled', 'auth', true),
  ('enable_deep_intelligence', 'Deep Intelligence™', 'AI-powered product intelligence and analytics', 'super_admin_only', 'ai', true),
  ('enable_marketing_decision_engine', 'Marketing Decision Engine', 'AI-powered marketing decisions and campaign optimization', 'super_admin_only', 'ai', true),
  ('enable_ad_creator', 'Ad Creator', 'AI-powered ad creative generation', 'super_admin_only', 'ai', true),
  ('enable_landing_builder', 'Landing Page Builder', 'AI-powered landing page generation', 'super_admin_only', 'ai', true),
  ('enable_shipping_ops', 'Shipping Operations', 'Advanced shipping management and optimization', 'super_admin_only', 'operations', true),
  ('enable_finance_profit_engine', 'Finance & Profit Engine', 'Profit analytics and financial intelligence', 'super_admin_only', 'finance', true),
  ('enable_integrations', 'Third-party Integrations', 'External platform integrations (n8n, APIs)', 'super_admin_only', 'integrations', true),
  ('enable_ai_calls', 'AI API Calls', 'Master switch for all AI API calls (kill-switch)', 'super_admin_only', 'system', true),
  ('enable_batch_ai_jobs', 'Batch AI Jobs', 'Allow scheduled batch AI processing', 'super_admin_only', 'system', true)
ON CONFLICT (flag_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_status = EXCLUDED.default_status,
  category = EXCLUDED.category,
  updated_at = NOW();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Feature flags are readable by all authenticated users
CREATE POLICY "feature_flags_read" ON feature_flags
  FOR SELECT TO authenticated USING (true);

-- Tenant flags readable by tenant members
CREATE POLICY "tenant_feature_flags_read" ON tenant_feature_flags
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true));

-- User flags readable by the user themselves
CREATE POLICY "user_feature_flags_read" ON user_feature_flags
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Super admins table - only super admins can read
CREATE POLICY "super_admins_read" ON super_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM super_admins WHERE is_active = true));

-- AI usage logs - users see their own, super admins see all
CREATE POLICY "ai_usage_logs_read" ON ai_usage_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR auth.uid() IN (SELECT user_id FROM super_admins WHERE is_active = true)
    OR tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role = 'owner')
  );

-- Audit logs - super admins only
CREATE POLICY "audit_logs_read" ON audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM super_admins WHERE is_active = true));

-- ============================================================================
-- HELPER FUNCTION: Check if user is Super Admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins 
    WHERE user_id = check_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Check Feature Flag Status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_feature_flag(
  p_flag_key VARCHAR(100),
  p_user_id UUID DEFAULT auth.uid(),
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_default_status flag_status;
  v_user_status flag_status;
  v_tenant_status flag_status;
  v_is_super_admin BOOLEAN;
BEGIN
  -- Check if user is super admin
  v_is_super_admin := is_super_admin(p_user_id);
  
  -- Get default status
  SELECT default_status INTO v_default_status
  FROM feature_flags WHERE flag_key = p_flag_key;
  
  IF v_default_status IS NULL THEN
    RETURN false; -- Flag doesn't exist
  END IF;
  
  -- Check user-level override first (highest priority)
  SELECT status INTO v_user_status
  FROM user_feature_flags uff
  JOIN feature_flags ff ON ff.id = uff.flag_id
  WHERE uff.user_id = p_user_id AND ff.flag_key = p_flag_key;
  
  IF v_user_status IS NOT NULL THEN
    IF v_user_status = 'enabled' THEN RETURN true;
    ELSIF v_user_status = 'disabled' THEN RETURN false;
    ELSIF v_user_status = 'super_admin_only' THEN RETURN v_is_super_admin;
    END IF;
  END IF;
  
  -- Check tenant-level override (if tenant provided)
  IF p_tenant_id IS NOT NULL THEN
    SELECT status INTO v_tenant_status
    FROM tenant_feature_flags tff
    JOIN feature_flags ff ON ff.id = tff.flag_id
    WHERE tff.tenant_id = p_tenant_id AND ff.flag_key = p_flag_key;
    
    IF v_tenant_status IS NOT NULL THEN
      IF v_tenant_status = 'enabled' THEN RETURN true;
      ELSIF v_tenant_status = 'disabled' THEN RETURN false;
      ELSIF v_tenant_status = 'super_admin_only' THEN RETURN v_is_super_admin;
      END IF;
    END IF;
  END IF;
  
  -- Fall back to default status
  IF v_default_status = 'enabled' THEN RETURN true;
  ELSIF v_default_status = 'disabled' THEN RETURN false;
  ELSIF v_default_status = 'super_admin_only' THEN RETURN v_is_super_admin;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Log AI Usage
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_ai_usage(
  p_feature_key VARCHAR(100),
  p_model VARCHAR(50),
  p_prompt_tokens INT,
  p_completion_tokens INT,
  p_estimated_cost_usd DECIMAL(10,6),
  p_run_status VARCHAR(20) DEFAULT 'completed',
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_tenant_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO ai_usage_logs (
    tenant_id, user_id, feature_key, model,
    prompt_tokens, completion_tokens, total_tokens,
    estimated_cost_usd, run_status, error_message, metadata
  ) VALUES (
    p_tenant_id, p_user_id, p_feature_key, p_model,
    p_prompt_tokens, p_completion_tokens, p_prompt_tokens + p_completion_tokens,
    p_estimated_cost_usd, p_run_status, p_error_message, p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Log Audit Event
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit(
  p_action VARCHAR(100),
  p_entity_type VARCHAR(50) DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    tenant_id, user_id, action, entity_type, entity_id,
    old_values, new_values
  ) VALUES (
    p_tenant_id, p_user_id, p_action, p_entity_type, p_entity_id,
    p_old_values, p_new_values
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON feature_flags TO authenticated;
GRANT SELECT ON tenant_feature_flags TO authenticated;
GRANT SELECT ON user_feature_flags TO authenticated;
GRANT SELECT ON super_admins TO authenticated;
GRANT SELECT, INSERT ON ai_usage_logs TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;

GRANT EXECUTE ON FUNCTION is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION check_feature_flag TO authenticated;
GRANT EXECUTE ON FUNCTION log_ai_usage TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit TO authenticated;
