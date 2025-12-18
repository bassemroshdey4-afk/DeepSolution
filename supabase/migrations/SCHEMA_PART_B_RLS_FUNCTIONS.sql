-- ============================================================
-- DeepSolution Schema PART B - RLS, Functions, Triggers
-- Run this AFTER PART A completes successfully
-- ============================================================

-- ============================================================
-- STEP 1: Enable RLS on all tables
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_cognitive_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_behavior_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_sla_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_profit_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_economics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_to_cash_journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_wisdom ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 2: RLS Policies - Core Tables
-- ============================================================

-- Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Tenant Users
DROP POLICY IF EXISTS "tenant_users_select" ON tenant_users;
CREATE POLICY "tenant_users_select" ON tenant_users FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tenant_users_insert" ON tenant_users;
CREATE POLICY "tenant_users_insert" ON tenant_users FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tenants
DROP POLICY IF EXISTS "tenants_select" ON tenants;
CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = tenants.id AND tenant_users.user_id = auth.uid())
);

DROP POLICY IF EXISTS "tenants_update" ON tenants;
CREATE POLICY "tenants_update" ON tenants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = tenants.id AND tenant_users.user_id = auth.uid() AND tenant_users.role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "tenants_insert" ON tenants;
CREATE POLICY "tenants_insert" ON tenants FOR INSERT WITH CHECK (true);

-- ============================================================
-- STEP 3: RLS Policies - Tenant-based tables (individual policies)
-- ============================================================

-- Subscriptions
DROP POLICY IF EXISTS "subscriptions_tenant_access" ON subscriptions;
CREATE POLICY "subscriptions_tenant_access" ON subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = subscriptions.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Products
DROP POLICY IF EXISTS "products_tenant_access" ON products;
CREATE POLICY "products_tenant_access" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = products.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Product Variants
DROP POLICY IF EXISTS "product_variants_tenant_access" ON product_variants;
CREATE POLICY "product_variants_tenant_access" ON product_variants FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = product_variants.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Product Intelligence
DROP POLICY IF EXISTS "product_intelligence_tenant_access" ON product_intelligence;
CREATE POLICY "product_intelligence_tenant_access" ON product_intelligence FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = product_intelligence.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Campaigns
DROP POLICY IF EXISTS "campaigns_tenant_access" ON campaigns;
CREATE POLICY "campaigns_tenant_access" ON campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = campaigns.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Campaign Intelligence
DROP POLICY IF EXISTS "campaign_intelligence_tenant_access" ON campaign_intelligence;
CREATE POLICY "campaign_intelligence_tenant_access" ON campaign_intelligence FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = campaign_intelligence.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Campaign Learnings
DROP POLICY IF EXISTS "campaign_learnings_tenant_access" ON campaign_learnings;
CREATE POLICY "campaign_learnings_tenant_access" ON campaign_learnings FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = campaign_learnings.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Customer Segments
DROP POLICY IF EXISTS "customer_segments_tenant_access" ON customer_segments;
CREATE POLICY "customer_segments_tenant_access" ON customer_segments FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = customer_segments.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Customer Behavior Patterns
DROP POLICY IF EXISTS "customer_behavior_patterns_tenant_access" ON customer_behavior_patterns;
CREATE POLICY "customer_behavior_patterns_tenant_access" ON customer_behavior_patterns FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = customer_behavior_patterns.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Operational Capacity
DROP POLICY IF EXISTS "operational_capacity_tenant_access" ON operational_capacity;
CREATE POLICY "operational_capacity_tenant_access" ON operational_capacity FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = operational_capacity.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Operational Metrics Daily
DROP POLICY IF EXISTS "operational_metrics_daily_tenant_access" ON operational_metrics_daily;
CREATE POLICY "operational_metrics_daily_tenant_access" ON operational_metrics_daily FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = operational_metrics_daily.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Orders
DROP POLICY IF EXISTS "orders_tenant_access" ON orders;
CREATE POLICY "orders_tenant_access" ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = orders.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Order Items
DROP POLICY IF EXISTS "order_items_tenant_access" ON order_items;
CREATE POLICY "order_items_tenant_access" ON order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = order_items.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Order Status History
DROP POLICY IF EXISTS "order_status_history_tenant_access" ON order_status_history;
CREATE POLICY "order_status_history_tenant_access" ON order_status_history FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = order_status_history.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Shipping Providers
DROP POLICY IF EXISTS "shipping_providers_tenant_access" ON shipping_providers;
CREATE POLICY "shipping_providers_tenant_access" ON shipping_providers FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = shipping_providers.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Shipping SLA Rules
DROP POLICY IF EXISTS "shipping_sla_rules_tenant_access" ON shipping_sla_rules;
CREATE POLICY "shipping_sla_rules_tenant_access" ON shipping_sla_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = shipping_sla_rules.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Shipments
DROP POLICY IF EXISTS "shipments_tenant_access" ON shipments;
CREATE POLICY "shipments_tenant_access" ON shipments FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = shipments.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Shipping Performance
DROP POLICY IF EXISTS "shipping_performance_tenant_access" ON shipping_performance;
CREATE POLICY "shipping_performance_tenant_access" ON shipping_performance FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = shipping_performance.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Financial Transactions
DROP POLICY IF EXISTS "financial_transactions_tenant_access" ON financial_transactions;
CREATE POLICY "financial_transactions_tenant_access" ON financial_transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = financial_transactions.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Order Profit Timeline
DROP POLICY IF EXISTS "order_profit_timeline_tenant_access" ON order_profit_timeline;
CREATE POLICY "order_profit_timeline_tenant_access" ON order_profit_timeline FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = order_profit_timeline.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Unit Economics Summary
DROP POLICY IF EXISTS "unit_economics_summary_tenant_access" ON unit_economics_summary;
CREATE POLICY "unit_economics_summary_tenant_access" ON unit_economics_summary FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = unit_economics_summary.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Marketing to Cash Journey
DROP POLICY IF EXISTS "marketing_to_cash_journey_tenant_access" ON marketing_to_cash_journey;
CREATE POLICY "marketing_to_cash_journey_tenant_access" ON marketing_to_cash_journey FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = marketing_to_cash_journey.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Experiments
DROP POLICY IF EXISTS "experiments_tenant_access" ON experiments;
CREATE POLICY "experiments_tenant_access" ON experiments FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = experiments.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Experiment Wisdom
DROP POLICY IF EXISTS "experiment_wisdom_tenant_access" ON experiment_wisdom;
CREATE POLICY "experiment_wisdom_tenant_access" ON experiment_wisdom FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = experiment_wisdom.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Failure Events
DROP POLICY IF EXISTS "failure_events_tenant_access" ON failure_events;
CREATE POLICY "failure_events_tenant_access" ON failure_events FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = failure_events.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Failure Patterns
DROP POLICY IF EXISTS "failure_patterns_tenant_access" ON failure_patterns;
CREATE POLICY "failure_patterns_tenant_access" ON failure_patterns FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = failure_patterns.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Decisions
DROP POLICY IF EXISTS "decisions_tenant_access" ON decisions;
CREATE POLICY "decisions_tenant_access" ON decisions FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = decisions.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Decision Outcomes
DROP POLICY IF EXISTS "decision_outcomes_tenant_access" ON decision_outcomes;
CREATE POLICY "decision_outcomes_tenant_access" ON decision_outcomes FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = decision_outcomes.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Trust Scores
DROP POLICY IF EXISTS "trust_scores_tenant_access" ON trust_scores;
CREATE POLICY "trust_scores_tenant_access" ON trust_scores FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = trust_scores.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Events
DROP POLICY IF EXISTS "events_tenant_access" ON events;
CREATE POLICY "events_tenant_access" ON events FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = events.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Event Subscriptions
DROP POLICY IF EXISTS "event_subscriptions_tenant_access" ON event_subscriptions;
CREATE POLICY "event_subscriptions_tenant_access" ON event_subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = event_subscriptions.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Tenant Cognitive Profile
DROP POLICY IF EXISTS "tenant_cognitive_profile_tenant_access" ON tenant_cognitive_profile;
CREATE POLICY "tenant_cognitive_profile_tenant_access" ON tenant_cognitive_profile FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = tenant_cognitive_profile.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Tenant Domains
DROP POLICY IF EXISTS "tenant_domains_tenant_access" ON tenant_domains;
CREATE POLICY "tenant_domains_tenant_access" ON tenant_domains FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = tenant_domains.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Generated Content
DROP POLICY IF EXISTS "generated_content_tenant_access" ON generated_content;
CREATE POLICY "generated_content_tenant_access" ON generated_content FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = generated_content.tenant_id AND tenant_users.user_id = auth.uid())
);

-- AI Generation Jobs
DROP POLICY IF EXISTS "ai_generation_jobs_tenant_access" ON ai_generation_jobs;
CREATE POLICY "ai_generation_jobs_tenant_access" ON ai_generation_jobs FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = ai_generation_jobs.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Copy Performance
DROP POLICY IF EXISTS "copy_performance_tenant_access" ON copy_performance;
CREATE POLICY "copy_performance_tenant_access" ON copy_performance FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = copy_performance.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Deployments
DROP POLICY IF EXISTS "deployments_tenant_access" ON deployments;
CREATE POLICY "deployments_tenant_access" ON deployments FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = deployments.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Deployment Configs
DROP POLICY IF EXISTS "deployment_configs_tenant_access" ON deployment_configs;
CREATE POLICY "deployment_configs_tenant_access" ON deployment_configs FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = deployment_configs.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Audit Logs
DROP POLICY IF EXISTS "audit_logs_tenant_access" ON audit_logs;
CREATE POLICY "audit_logs_tenant_access" ON audit_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = audit_logs.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Notifications
DROP POLICY IF EXISTS "notifications_tenant_access" ON notifications;
CREATE POLICY "notifications_tenant_access" ON notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = notifications.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Scheduled Tasks
DROP POLICY IF EXISTS "scheduled_tasks_tenant_access" ON scheduled_tasks;
CREATE POLICY "scheduled_tasks_tenant_access" ON scheduled_tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = scheduled_tasks.tenant_id AND tenant_users.user_id = auth.uid())
);

-- API Keys
DROP POLICY IF EXISTS "api_keys_tenant_access" ON api_keys;
CREATE POLICY "api_keys_tenant_access" ON api_keys FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = api_keys.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Integrations
DROP POLICY IF EXISTS "integrations_tenant_access" ON integrations;
CREATE POLICY "integrations_tenant_access" ON integrations FOR ALL USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = integrations.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Templates (can be system-wide or tenant-specific)
DROP POLICY IF EXISTS "templates_access" ON templates;
CREATE POLICY "templates_access" ON templates FOR SELECT USING (
  is_system = TRUE OR tenant_id IS NULL OR
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = templates.tenant_id AND tenant_users.user_id = auth.uid())
);

DROP POLICY IF EXISTS "templates_modify" ON templates;
CREATE POLICY "templates_modify" ON templates FOR ALL USING (
  tenant_id IS NOT NULL AND
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = templates.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Template Rules
DROP POLICY IF EXISTS "template_rules_access" ON template_rules;
CREATE POLICY "template_rules_access" ON template_rules FOR SELECT USING (
  tenant_id IS NULL OR
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = template_rules.tenant_id AND tenant_users.user_id = auth.uid())
);

DROP POLICY IF EXISTS "template_rules_modify" ON template_rules;
CREATE POLICY "template_rules_modify" ON template_rules FOR ALL USING (
  tenant_id IS NOT NULL AND
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = template_rules.tenant_id AND tenant_users.user_id = auth.uid())
);

-- ============================================================
-- STEP 4: Trial Functions
-- ============================================================

CREATE OR REPLACE FUNCTION is_tenant_in_trial(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status subscription_status;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  SELECT status, trial_ends_at INTO v_status, v_trial_ends
  FROM subscriptions WHERE tenant_id = p_tenant_id;
  
  IF v_status = 'trial' AND v_trial_ends > NOW() THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION start_tenant_trial(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  INSERT INTO subscriptions (tenant_id, plan, status, trial_starts_at, trial_ends_at, trial_campaigns_limit)
  VALUES (p_tenant_id, 'trial', 'trial', NOW(), NOW() + INTERVAL '7 days', 1)
  ON CONFLICT (tenant_id) DO UPDATE SET
    status = 'trial',
    trial_starts_at = NOW(),
    trial_ends_at = NOW() + INTERVAL '7 days',
    trial_campaigns_limit = 1,
    updated_at = NOW()
  RETURNING id INTO v_sub_id;
  
  RETURN v_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION expire_trial_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'trial' AND trial_ends_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 5: Trial Campaign Limit Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION check_trial_campaign_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_status subscription_status;
  v_trial_ends TIMESTAMPTZ;
  v_campaign_limit INTEGER;
  v_current_count INTEGER;
BEGIN
  SELECT status, trial_ends_at, trial_campaigns_limit
  INTO v_status, v_trial_ends, v_campaign_limit
  FROM subscriptions WHERE tenant_id = NEW.tenant_id;
  
  IF v_status = 'trial' AND v_trial_ends > NOW() THEN
    SELECT COUNT(*) INTO v_current_count
    FROM campaigns WHERE tenant_id = NEW.tenant_id;
    
    IF v_current_count >= COALESCE(v_campaign_limit, 1) THEN
      RAISE EXCEPTION 'Trial limit reached: You can only create % campaign(s) during your trial period. Please upgrade to create more campaigns.', v_campaign_limit;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_trial_campaign_limit ON campaigns;
CREATE TRIGGER enforce_trial_campaign_limit
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION check_trial_campaign_limit();

-- ============================================================
-- STEP 6: Performance Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(tenant_id, customer_email);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(tenant_id, user_id, is_read);

-- ============================================================
-- PART B COMPLETE
-- Verification: Run the following query to check table count:
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 48
-- ============================================================
