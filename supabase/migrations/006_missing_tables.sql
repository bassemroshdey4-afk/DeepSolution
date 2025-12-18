-- ============================================================================
-- DeepSolution: Missing Core Tables
-- Version: 2.1 - Complete foundation tables
-- ============================================================================

-- ============================================================================
-- PROFILES (linked to auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  phone VARCHAR(20),
  
  -- Preferences
  language VARCHAR(5) DEFAULT 'ar',
  timezone VARCHAR(50) DEFAULT 'Asia/Riyadh',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- No tenant_id - profiles are user-level, not tenant-level
-- RLS based on auth.uid()
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_can_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "users_can_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

-- ============================================================================
-- TENANT_USERS (membership table for RLS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role within tenant
  role VARCHAR(20) NOT NULL DEFAULT 'member' 
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Invitation
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX idx_tenant_users_active ON tenant_users(user_id, is_active);

-- RLS for tenant_users
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY "users_can_view_own_memberships" ON tenant_users
  FOR SELECT USING (user_id = auth.uid());

-- Admins/owners can manage tenant members
CREATE POLICY "admins_can_manage_members" ON tenant_users
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Plan info
  plan VARCHAR(20) NOT NULL DEFAULT 'free',
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  
  -- Billing
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  price_per_cycle INT DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  
  -- Dates
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Usage limits
  max_products INT DEFAULT 50,
  max_orders_per_month INT DEFAULT 100,
  max_team_members INT DEFAULT 1,
  max_ai_requests_per_month INT DEFAULT 100,
  
  -- Current usage
  current_products INT DEFAULT 0,
  current_orders_this_month INT DEFAULT 0,
  current_ai_requests_this_month INT DEFAULT 0,
  
  -- External
  external_subscription_id VARCHAR(255),
  external_customer_id VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON subscriptions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- ORDER_ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Product snapshot (in case product changes/deleted)
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  
  -- Pricing
  unit_price INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  discount_amount INT DEFAULT 0,
  total_price INT NOT NULL,
  
  -- Cost (for profit calculation)
  unit_cost INT DEFAULT 0,
  total_cost INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON order_items FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- ORDER_STATUS_HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Status change
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  
  -- Call status change (if applicable)
  from_call_status VARCHAR(30),
  to_call_status VARCHAR(30),
  
  -- Who/what made the change
  changed_by_user_id UUID REFERENCES auth.users(id),
  changed_by_system VARCHAR(50), -- 'n8n', 'api', 'manual'
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_status_history_tenant ON order_status_history(tenant_id);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_date ON order_status_history(tenant_id, changed_at);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON order_status_history FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- CONSTRAINTS (for Layer 15 - Constraint & Reality Memory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Constraint definition
  constraint_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Limits
  limit_value DECIMAL(15,2) NOT NULL,
  limit_unit VARCHAR(30) NOT NULL,
  
  -- Current state
  current_value DECIMAL(15,2) DEFAULT 0,
  current_utilization DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN limit_value > 0 THEN current_value / limit_value ELSE 0 END
  ) STORED,
  
  -- Thresholds
  warning_threshold DECIMAL(5,4) DEFAULT 0.8,
  critical_threshold DECIMAL(5,4) DEFAULT 0.95,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_hard_limit BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_constraints_tenant ON constraints(tenant_id);
CREATE INDEX idx_constraints_type ON constraints(tenant_id, constraint_type);

ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON constraints FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Constraint Violations (track when limits exceeded)
CREATE TABLE IF NOT EXISTS public.constraint_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  constraint_id UUID NOT NULL REFERENCES constraints(id) ON DELETE CASCADE,
  
  -- Violation details
  violation_type VARCHAR(30) NOT NULL, -- 'warning', 'critical', 'exceeded'
  value_at_violation DECIMAL(15,2) NOT NULL,
  limit_at_violation DECIMAL(15,2) NOT NULL,
  
  -- Context
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_constraint_violations_tenant ON constraint_violations(tenant_id);
CREATE INDEX idx_constraint_violations_constraint ON constraint_violations(constraint_id);

ALTER TABLE constraint_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON constraint_violations FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- PRODUCT_VARIANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Variant info
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  
  -- Options (e.g., size, color)
  options JSONB DEFAULT '{}'::jsonb,
  
  -- Pricing
  cost_price INT DEFAULT 0,
  selling_price INT NOT NULL,
  
  -- Inventory
  stock_quantity INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_variants_tenant ON product_variants(tenant_id);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON product_variants FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- INVENTORY_LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  
  -- Change details
  change_type VARCHAR(30) NOT NULL,
  quantity_before INT NOT NULL,
  quantity_change INT NOT NULL,
  quantity_after INT NOT NULL,
  
  -- Reference
  reference_type VARCHAR(30),
  reference_id UUID,
  
  -- Notes
  notes TEXT,
  
  -- Who made the change
  changed_by_user_id UUID REFERENCES auth.users(id),
  changed_by_system VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_logs_tenant ON inventory_logs(tenant_id);
CREATE INDEX idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_date ON inventory_logs(tenant_id, created_at);

ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON inventory_logs FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- FILES (for file storage metadata)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- File info
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255),
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  
  -- Storage
  storage_path VARCHAR(500) NOT NULL,
  storage_bucket VARCHAR(100) NOT NULL,
  public_url VARCHAR(500),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Ownership
  uploaded_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_tenant ON files(tenant_id);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON files FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- AUDIT_LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Action info
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  
  -- Actor
  actor_type VARCHAR(20) NOT NULL, -- 'user', 'system', 'api', 'n8n'
  actor_id UUID,
  actor_name VARCHAR(255),
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(tenant_id, created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON audit_logs FOR ALL USING (
  tenant_id IS NULL OR tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true
  )
);

-- ============================================================================
-- LANDING_PAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Page info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  
  -- Content (AI-generated)
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_content TEXT,
  
  -- Product association
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  
  -- Analytics
  views INT DEFAULT 0,
  conversions INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique slug per tenant
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_landing_pages_tenant ON landing_pages(tenant_id);
CREATE INDEX idx_landing_pages_product ON landing_pages(product_id);
CREATE INDEX idx_landing_pages_slug ON landing_pages(tenant_id, slug);

ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON landing_pages FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- AI_CONVERSATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Conversation
  title VARCHAR(255),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Context (what AI knows about this conversation)
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Token usage
  total_tokens_used INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_tenant ON ai_conversations(tenant_id);
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ai_conversations FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- STRATEGIC_GOALS (for Strategy Memory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.strategic_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Goal definition
  name VARCHAR(255) NOT NULL,
  description TEXT,
  goal_type VARCHAR(50) NOT NULL,
  
  -- Target
  target_metric VARCHAR(100) NOT NULL,
  target_value DECIMAL(15,2) NOT NULL,
  target_unit VARCHAR(30),
  
  -- Current progress
  current_value DECIMAL(15,2) DEFAULT 0,
  progress_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN target_value > 0 THEN LEAST(100, (current_value / target_value) * 100) ELSE 0 END
  ) STORED,
  
  -- Timeline
  start_date DATE,
  target_date DATE,
  
  -- Priority
  priority INT DEFAULT 5,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategic_goals_tenant ON strategic_goals(tenant_id);
CREATE INDEX idx_strategic_goals_status ON strategic_goals(tenant_id, status);

ALTER TABLE strategic_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON strategic_goals FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 
-- Added tables:
-- - profiles (user profiles, linked to auth.users)
-- - tenant_users (membership for RLS)
-- - subscriptions (billing and limits)
-- - order_items (order line items)
-- - order_status_history (status changes)
-- - constraints (operational constraints)
-- - constraint_violations (limit breaches)
-- - product_variants (product variations)
-- - inventory_logs (stock changes)
-- - files (file metadata)
-- - audit_logs (activity tracking)
-- - landing_pages (AI-generated pages)
-- - ai_conversations (chat history)
-- - strategic_goals (business goals)
-- 
-- ============================================================================
