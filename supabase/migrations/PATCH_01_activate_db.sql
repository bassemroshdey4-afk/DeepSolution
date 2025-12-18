-- ============================================================
-- DeepSolution - PATCH_01_activate_db.sql
-- Phase 1B: Database Activation
-- ============================================================
-- Idempotent - Safe to run multiple times
-- No RAISE NOTICE outside functions
-- ============================================================

-- ============================================================
-- STEP 1: Verify and fix subscription_status enum
-- ============================================================
DO $$
BEGIN
  -- Add 'trial' if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'trial'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'trial';
  END IF;
  
  -- Add 'active' if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'active'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'active';
  END IF;
  
  -- Add 'canceled' if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'canceled'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'canceled';
  END IF;
  
  -- Add 'expired' if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'expired'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'expired';
  END IF;
  
  -- Add 'past_due' if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'past_due'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'past_due';
  END IF;
END $$;

-- ============================================================
-- STEP 2: Helper Functions for RLS
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
-- STEP 3: Trial Helper Functions
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
-- STEP 4: Trial Enforcement Trigger
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

CREATE TRIGGER enforce_trial_campaign_limit_trigger
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_trial_campaign_limit();

-- ============================================================
-- STEP 5: Trial Management Functions
-- ============================================================
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
-- STEP 6: Seed Default Tenant (Boss Commerce)
-- ============================================================
DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
BEGIN
  -- Check if tenant already exists
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE slug = 'boss-commerce';
  
  -- Create tenant if not exists
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (
      id,
      name,
      slug,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      'Boss Commerce',
      'boss-commerce',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_tenant_id;
  END IF;
  
  -- Get current user (if authenticated)
  -- Note: This will be NULL when running as postgres role
  v_user_id := auth.uid();
  
  -- If we have a user, link them to the tenant
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.tenant_users (
      tenant_id,
      user_id,
      role,
      created_at
    ) VALUES (
      v_tenant_id,
      v_user_id,
      'owner',
      NOW()
    )
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
    
    -- Update profile's default tenant
    UPDATE public.profiles
    SET default_tenant_id = v_tenant_id,
        updated_at = NOW()
    WHERE id = v_user_id
    AND (default_tenant_id IS NULL OR default_tenant_id != v_tenant_id);
  END IF;
  
  -- Start trial for the tenant
  PERFORM public.start_tenant_trial(v_tenant_id);
END $$;

-- ============================================================
-- STEP 7: Enable RLS on all tables
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  all_tables TEXT[] := ARRAY[
    'tenants', 'profiles', 'tenant_users', 'tenant_cognitive_profile', 
    'tenant_domains', 'subscriptions', 'products', 'product_variants',
    'product_intelligence', 'campaigns', 'campaign_intelligence', 
    'campaign_learnings', 'customer_segments', 'customer_behavior_patterns',
    'operational_capacity', 'operational_metrics_daily', 'orders', 
    'order_items', 'order_status_history', 'shipping_providers',
    'shipping_sla_rules', 'shipments', 'shipping_performance',
    'financial_transactions', 'order_profit_timeline', 'unit_economics_summary',
    'marketing_to_cash_journey', 'experiments', 'experiment_wisdom',
    'failure_events', 'failure_patterns', 'decisions', 'decision_outcomes',
    'trust_scores', 'events', 'event_subscriptions', 'templates',
    'template_rules', 'generated_content', 'ai_generation_jobs',
    'copy_performance', 'deployments', 'deployment_configs', 'audit_logs',
    'notifications', 'scheduled_tasks', 'api_keys', 'integrations'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

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
    'tenant_cognitive_profile', 'tenant_domains', 'subscriptions',
    'products', 'product_variants', 'product_intelligence',
    'campaigns', 'campaign_intelligence', 'campaign_learnings',
    'customer_segments', 'customer_behavior_patterns',
    'operational_capacity', 'operational_metrics_daily',
    'orders', 'order_items', 'order_status_history',
    'shipping_providers', 'shipping_sla_rules', 'shipments', 'shipping_performance',
    'financial_transactions', 'order_profit_timeline', 'unit_economics_summary',
    'marketing_to_cash_journey', 'experiments', 'experiment_wisdom',
    'failure_events', 'failure_patterns', 'decisions', 'decision_outcomes',
    'trust_scores', 'events', 'event_subscriptions',
    'generated_content', 'ai_generation_jobs', 'copy_performance',
    'deployments', 'deployment_configs', 'audit_logs',
    'notifications', 'scheduled_tasks', 'api_keys', 'integrations'
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
-- STEP 10: RLS Policies for Templates (system + tenant)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'templates') THEN
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
  END IF;
END $$;

-- ============================================================
-- STEP 11: RLS Policies for Template Rules
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'template_rules') THEN
    DROP POLICY IF EXISTS "template_rules_select" ON template_rules;
    CREATE POLICY "template_rules_select" ON template_rules FOR SELECT
      USING (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id));

    DROP POLICY IF EXISTS "template_rules_insert" ON template_rules;
    CREATE POLICY "template_rules_insert" ON template_rules FOR INSERT
      WITH CHECK (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id));

    DROP POLICY IF EXISTS "template_rules_update" ON template_rules;
    CREATE POLICY "template_rules_update" ON template_rules FOR UPDATE
      USING (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id));

    DROP POLICY IF EXISTS "template_rules_delete" ON template_rules;
    CREATE POLICY "template_rules_delete" ON template_rules FOR DELETE
      USING (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id));
  END IF;
END $$;

-- ============================================================
-- STEP 12: Ensure Events table has tracking columns
-- ============================================================
DO $$
BEGIN
  -- Add missing columns to events table if they don't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    -- store_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'store_id') THEN
      ALTER TABLE events ADD COLUMN store_id UUID;
    END IF;
    
    -- session_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'session_id') THEN
      ALTER TABLE events ADD COLUMN session_id VARCHAR(255);
    END IF;
    
    -- user_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'user_id') THEN
      ALTER TABLE events ADD COLUMN user_id UUID;
    END IF;
    
    -- product_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'product_id') THEN
      ALTER TABLE events ADD COLUMN product_id UUID;
    END IF;
    
    -- order_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'order_id') THEN
      ALTER TABLE events ADD COLUMN order_id UUID;
    END IF;
    
    -- source
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'source') THEN
      ALTER TABLE events ADD COLUMN source VARCHAR(100);
    END IF;
    
    -- UTM parameters
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'utm_source') THEN
      ALTER TABLE events ADD COLUMN utm_source VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'utm_campaign') THEN
      ALTER TABLE events ADD COLUMN utm_campaign VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'utm_content') THEN
      ALTER TABLE events ADD COLUMN utm_content VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'utm_term') THEN
      ALTER TABLE events ADD COLUMN utm_term VARCHAR(255);
    END IF;
    
    -- Ad tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'ad_platform') THEN
      ALTER TABLE events ADD COLUMN ad_platform VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'ad_account_id') THEN
      ALTER TABLE events ADD COLUMN ad_account_id VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'campaign_platform_id') THEN
      ALTER TABLE events ADD COLUMN campaign_platform_id VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'ad_id') THEN
      ALTER TABLE events ADD COLUMN ad_id VARCHAR(100);
    END IF;
    
    -- occurred_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'occurred_at') THEN
      ALTER TABLE events ADD COLUMN occurred_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- ============================================================
-- STEP 13: Performance Indexes
-- ============================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_composite ON tenant_users(tenant_id, user_id);

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Campaign indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);

-- Events indexes (critical for tracking)
CREATE INDEX IF NOT EXISTS idx_events_tenant_occurred ON events(tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_tenant_name_occurred ON events(tenant_id, event_name, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);

-- Deployment indexes
CREATE INDEX IF NOT EXISTS idx_deployments_tenant_id ON deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_id ON tenant_domains(tenant_id);

-- ============================================================
-- END OF PATCH
-- ============================================================
