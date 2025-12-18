-- ============================================================
-- DeepSolution - PATCH_01_activate_db_v3.sql
-- Phase 1B: Database Activation (FINAL FIX)
-- ============================================================
-- Idempotent - Safe to run multiple times
-- Uses CREATE OR REPLACE instead of DROP + CREATE
-- Adds missing columns before creating indexes
-- ============================================================

-- ============================================================
-- STEP 1: Verify and fix subscription_status enum
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'trial'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'trial';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'active'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'active';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'canceled'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'canceled';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'expired'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'expired';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'subscription_status' AND e.enumlabel = 'past_due'
  ) THEN
    ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'past_due';
  END IF;
END $$;

-- ============================================================
-- STEP 2: Helper Functions for RLS (CREATE OR REPLACE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE tenant_id = check_tenant_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT tenant_id FROM public.tenant_users
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- STEP 3: Trial Helper Functions (CREATE OR REPLACE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_tenant_in_trial(check_tenant_id UUID)
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

CREATE OR REPLACE FUNCTION public.count_tenant_campaigns(check_tenant_id UUID)
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

CREATE OR REPLACE FUNCTION public.enforce_trial_campaign_limit()
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
-- STEP 5: Trial Management Functions (CREATE OR REPLACE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_tenant_trial(p_tenant_id UUID)
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

CREATE OR REPLACE FUNCTION public.expire_trial_subscriptions()
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
-- STEP 6: Ensure Events table has ALL tracking columns
-- (Including event_name which was missing)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    -- event_name (CRITICAL - was missing)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'event_name') THEN
      ALTER TABLE events ADD COLUMN event_name VARCHAR(100);
    END IF;
    
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
-- STEP 7: Performance Indexes (IF NOT EXISTS)
-- Note: Indexes are created AFTER columns are added
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_composite ON tenant_users(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);

-- Events indexes (created AFTER event_name column is added)
CREATE INDEX IF NOT EXISTS idx_events_tenant_occurred ON events(tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_tenant_name_occurred ON events(tenant_id, event_name, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);

CREATE INDEX IF NOT EXISTS idx_deployments_tenant_id ON deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_id ON tenant_domains(tenant_id);

-- ============================================================
-- END OF PATCH v3
-- ============================================================
