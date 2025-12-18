-- ============================================================
-- DeepSolution - 03_rls_policies.sql
-- RLS Policies for all 48 tables
-- ============================================================
-- Prerequisites: Run 01_schema and 02_patch first
-- All policies are Idempotent (DROP IF EXISTS then CREATE)
-- ============================================================

-- ============================================================
-- STEP 1: Helper Function - Check tenant membership
-- ============================================================
DROP FUNCTION IF EXISTS public.user_has_tenant_access(UUID);
CREATE FUNCTION public.user_has_tenant_access(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = check_tenant_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- STEP 2: Helper Function - Get user's tenant IDs
-- ============================================================
DROP FUNCTION IF EXISTS public.get_user_tenant_ids();
CREATE FUNCTION public.get_user_tenant_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT tenant_id FROM public.tenant_users
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- STEP 3: Helper Function - Check if tenant is in trial
-- ============================================================
DROP FUNCTION IF EXISTS public.is_tenant_in_trial(UUID);
CREATE FUNCTION public.is_tenant_in_trial(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub_record RECORD;
BEGIN
  SELECT status, trial_ends_at INTO sub_record
  FROM public.subscriptions
  WHERE tenant_id = check_tenant_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF sub_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN sub_record.status = 'trial' 
    AND sub_record.trial_ends_at IS NOT NULL 
    AND sub_record.trial_ends_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- STEP 4: Helper Function - Count tenant campaigns
-- ============================================================
DROP FUNCTION IF EXISTS public.count_tenant_campaigns(UUID);
CREATE FUNCTION public.count_tenant_campaigns(check_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
  campaign_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO campaign_count
  FROM public.campaigns
  WHERE tenant_id = check_tenant_id;
  
  RETURN COALESCE(campaign_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- STEP 5: Trial Enforcement Function (for trigger)
-- ============================================================
DROP TRIGGER IF EXISTS enforce_trial_campaign_limit_trigger ON campaigns;
DROP FUNCTION IF EXISTS public.enforce_trial_campaign_limit();
CREATE FUNCTION public.enforce_trial_campaign_limit()
RETURNS TRIGGER AS $$
DECLARE
  is_trial BOOLEAN;
  campaign_count INTEGER;
  campaigns_limit INTEGER;
BEGIN
  SELECT public.is_tenant_in_trial(NEW.tenant_id) INTO is_trial;
  
  IF NOT is_trial THEN
    RETURN NEW;
  END IF;
  
  SELECT COALESCE(trial_campaigns_limit, 1) INTO campaigns_limit
  FROM public.subscriptions
  WHERE tenant_id = NEW.tenant_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  SELECT public.count_tenant_campaigns(NEW.tenant_id) INTO campaign_count;
  
  IF campaign_count >= campaigns_limit THEN
    RAISE EXCEPTION 'Trial limit reached: You can only create % campaign(s) during trial period. Please upgrade to create more campaigns.', campaigns_limit;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 6: Create Trial Enforcement Trigger
-- ============================================================
CREATE TRIGGER enforce_trial_campaign_limit_trigger
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_trial_campaign_limit();

-- ============================================================
-- STEP 7: Trial Management Functions
-- ============================================================

-- Start trial for a tenant
DROP FUNCTION IF EXISTS public.start_tenant_trial(UUID);
CREATE FUNCTION public.start_tenant_trial(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
  sub_id UUID;
BEGIN
  INSERT INTO public.subscriptions (
    tenant_id,
    plan,
    status,
    trial_starts_at,
    trial_ends_at,
    trial_campaigns_limit,
    created_at
  ) VALUES (
    p_tenant_id,
    'trial',
    'trial',
    NOW(),
    NOW() + INTERVAL '7 days',
    1,
    NOW()
  )
  RETURNING id INTO sub_id;
  
  RETURN sub_id;
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.subscriptions
    SET status = 'trial',
        trial_starts_at = NOW(),
        trial_ends_at = NOW() + INTERVAL '7 days',
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
    RETURNING id INTO sub_id;
    RETURN sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expire trial subscriptions (run via cron)
DROP FUNCTION IF EXISTS public.expire_trial_subscriptions();
CREATE FUNCTION public.expire_trial_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'trial'
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 8: RLS Policies for Core Tables
-- ============================================================

-- TENANTS
DROP POLICY IF EXISTS "tenants_select" ON tenants;
CREATE POLICY "tenants_select" ON tenants FOR SELECT
  USING (public.user_has_tenant_access(id));

DROP POLICY IF EXISTS "tenants_insert" ON tenants;
CREATE POLICY "tenants_insert" ON tenants FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "tenants_update" ON tenants;
CREATE POLICY "tenants_update" ON tenants FOR UPDATE
  USING (public.user_has_tenant_access(id));

DROP POLICY IF EXISTS "tenants_delete" ON tenants;
CREATE POLICY "tenants_delete" ON tenants FOR DELETE
  USING (public.user_has_tenant_access(id));

-- PROFILES
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- TENANT_USERS
DROP POLICY IF EXISTS "tenant_users_select" ON tenant_users;
CREATE POLICY "tenant_users_select" ON tenant_users FOR SELECT
  USING (user_id = auth.uid() OR public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "tenant_users_insert" ON tenant_users;
CREATE POLICY "tenant_users_insert" ON tenant_users FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "tenant_users_update" ON tenant_users;
CREATE POLICY "tenant_users_update" ON tenant_users FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "tenant_users_delete" ON tenant_users;
CREATE POLICY "tenant_users_delete" ON tenant_users FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- ============================================================
-- STEP 9: RLS Policies for Tenant-Scoped Tables
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tenant_tables TEXT[] := ARRAY[
    'tenant_cognitive_profile',
    'tenant_domains',
    'subscriptions',
    'products',
    'product_variants',
    'product_intelligence',
    'campaigns',
    'campaign_intelligence',
    'campaign_learnings',
    'customer_segments',
    'customer_behavior_patterns',
    'operational_capacity',
    'operational_metrics_daily',
    'orders',
    'order_items',
    'order_status_history',
    'shipping_providers',
    'shipping_sla_rules',
    'shipments',
    'shipping_performance',
    'financial_transactions',
    'order_profit_timeline',
    'unit_economics_summary',
    'marketing_to_cash_journey',
    'experiments',
    'experiment_wisdom',
    'failure_events',
    'failure_patterns',
    'decisions',
    'decision_outcomes',
    'trust_scores',
    'events',
    'event_subscriptions',
    'generated_content',
    'ai_generation_jobs',
    'copy_performance',
    'deployments',
    'deployment_configs',
    'audit_logs',
    'notifications',
    'scheduled_tasks',
    'api_keys',
    'integrations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id') THEN
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_select" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_tenant_select" ON %I FOR SELECT USING (public.user_has_tenant_access(tenant_id))', tbl, tbl);
        
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_insert" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_tenant_insert" ON %I FOR INSERT WITH CHECK (public.user_has_tenant_access(tenant_id))', tbl, tbl);
        
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_update" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_tenant_update" ON %I FOR UPDATE USING (public.user_has_tenant_access(tenant_id))', tbl, tbl);
        
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_delete" ON %I', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_tenant_delete" ON %I FOR DELETE USING (public.user_has_tenant_access(tenant_id))', tbl, tbl);
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- STEP 10: RLS Policies for Templates (special case)
-- ============================================================

DROP POLICY IF EXISTS "templates_select" ON templates;
CREATE POLICY "templates_select" ON templates FOR SELECT
  USING (
    is_system = TRUE 
    OR tenant_id IS NULL 
    OR public.user_has_tenant_access(tenant_id)
  );

DROP POLICY IF EXISTS "templates_insert" ON templates;
CREATE POLICY "templates_insert" ON templates FOR INSERT
  WITH CHECK (
    tenant_id IS NULL 
    OR public.user_has_tenant_access(tenant_id)
  );

DROP POLICY IF EXISTS "templates_update" ON templates;
CREATE POLICY "templates_update" ON templates FOR UPDATE
  USING (
    is_system = FALSE 
    AND (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id))
  );

DROP POLICY IF EXISTS "templates_delete" ON templates;
CREATE POLICY "templates_delete" ON templates FOR DELETE
  USING (
    is_system = FALSE 
    AND (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id))
  );

-- ============================================================
-- STEP 11: RLS Policies for Template Rules
-- ============================================================

DROP POLICY IF EXISTS "template_rules_select" ON template_rules;
CREATE POLICY "template_rules_select" ON template_rules FOR SELECT
  USING (
    tenant_id IS NULL 
    OR public.user_has_tenant_access(tenant_id)
  );

DROP POLICY IF EXISTS "template_rules_insert" ON template_rules;
CREATE POLICY "template_rules_insert" ON template_rules FOR INSERT
  WITH CHECK (
    tenant_id IS NULL 
    OR public.user_has_tenant_access(tenant_id)
  );

DROP POLICY IF EXISTS "template_rules_update" ON template_rules;
CREATE POLICY "template_rules_update" ON template_rules FOR UPDATE
  USING (
    tenant_id IS NULL 
    OR public.user_has_tenant_access(tenant_id)
  );

DROP POLICY IF EXISTS "template_rules_delete" ON template_rules;
CREATE POLICY "template_rules_delete" ON template_rules FOR DELETE
  USING (
    tenant_id IS NULL 
    OR public.user_has_tenant_access(tenant_id)
  );

-- ============================================================
-- STEP 12: Performance Indexes for RLS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_composite ON tenant_users(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON order_items(tenant_id);

-- ============================================================
-- END OF FILE
-- ============================================================
