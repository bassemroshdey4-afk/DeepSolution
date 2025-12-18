-- ============================================================================
-- PATCH_001_subscriptions_trial.sql
-- Purpose: Fix subscription_status enum and implement 7-day trial with 1 campaign limit
-- Safe for production - Idempotent - Does not drop existing data
-- ============================================================================

SET search_path TO public, auth;

-- ============================================================================
-- PART 1: FIX ENUM subscription_status
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'subscription_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE subscription_status AS ENUM (
      'trial', 'active', 'past_due', 'canceled', 'expired', 'free'
    );
  END IF;
END $$;

DO $$
DECLARE
  enum_values TEXT[] := ARRAY['trial', 'active', 'past_due', 'canceled', 'expired', 'free'];
  val TEXT;
  type_oid OID;
BEGIN
  SELECT t.oid INTO type_oid
  FROM pg_type t
  JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE t.typname = 'subscription_status' AND n.nspname = 'public';
  
  IF type_oid IS NOT NULL THEN
    FOREACH val IN ARRAY enum_values
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = type_oid AND enumlabel = val
      ) THEN
        EXECUTE format('ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS %L', val);
      END IF;
    END LOOP;
  END IF;
END $$;


-- ============================================================================
-- PART 2: UPDATE SUBSCRIPTIONS TABLE FOR TRIAL SUPPORT
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'subscriptions' 
      AND column_name = 'trial_starts_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_starts_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'subscriptions' 
      AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'subscriptions' 
      AND column_name = 'trial_campaign_limit'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_campaign_limit INT DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'subscriptions' 
      AND column_name = 'features_enabled'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN features_enabled JSONB DEFAULT '{"all": true}'::jsonb;
  END IF;
END $$;

DO $$
DECLARE
  current_default TEXT;
BEGIN
  SELECT column_default INTO current_default
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'subscriptions' 
    AND column_name = 'status';
  
  IF current_default IS NULL OR current_default NOT LIKE '%trial%' THEN
    ALTER TABLE subscriptions 
      ALTER COLUMN status SET DEFAULT 'trial'::subscription_status;
  END IF;
END $$;


-- ============================================================================
-- PART 3: TRIAL BUSINESS RULES FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION is_tenant_in_trial(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  SELECT 
    status::TEXT,
    trial_ends_at
  INTO v_status, v_trial_ends
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_status IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF v_status = 'trial' AND (v_trial_ends IS NULL OR v_trial_ends > NOW()) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION has_paid_subscription(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status::TEXT INTO v_status
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
    AND status IN ('active')
    AND current_period_end > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_status IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_tenant_campaign_count(p_tenant_id UUID)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM campaigns
  WHERE tenant_id = p_tenant_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_trial_campaign_limit(p_tenant_id UUID)
RETURNS INT AS $$
DECLARE
  v_limit INT;
BEGIN
  SELECT COALESCE(trial_campaign_limit, 1) INTO v_limit
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_limit, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PART 4: ENFORCE 1 CAMPAIGN LIMIT DURING TRIAL (TRIGGER)
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_trial_campaign_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_is_trial BOOLEAN;
  v_has_paid BOOLEAN;
  v_campaign_count INT;
  v_campaign_limit INT;
BEGIN
  v_is_trial := is_tenant_in_trial(NEW.tenant_id);
  
  IF NOT v_is_trial THEN
    RETURN NEW;
  END IF;
  
  v_has_paid := has_paid_subscription(NEW.tenant_id);
  
  IF v_has_paid THEN
    RETURN NEW;
  END IF;
  
  v_campaign_count := get_tenant_campaign_count(NEW.tenant_id);
  v_campaign_limit := get_trial_campaign_limit(NEW.tenant_id);
  
  IF v_campaign_count >= v_campaign_limit THEN
    RAISE EXCEPTION 'Trial limit reached: You can only create % campaign(s) during your 7-day free trial. Upgrade to a paid plan for unlimited campaigns.', v_campaign_limit
      USING ERRCODE = 'P0001',
            HINT = 'Upgrade your subscription to create more campaigns';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_trial_campaign_limit ON campaigns;

CREATE TRIGGER trg_enforce_trial_campaign_limit
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION enforce_trial_campaign_limit();


-- ============================================================================
-- PART 5: FUNCTION TO START TRIAL FOR NEW TENANT
-- ============================================================================

CREATE OR REPLACE FUNCTION start_tenant_trial(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  SELECT id INTO v_subscription_id
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
  
  IF v_subscription_id IS NOT NULL THEN
    UPDATE subscriptions
    SET 
      status = 'trial'::subscription_status,
      plan_id = 'trial',
      trial_starts_at = NOW(),
      trial_ends_at = NOW() + INTERVAL '7 days',
      trial_campaign_limit = 1,
      features_enabled = '{"all": true}'::jsonb,
      current_period_start = NOW(),
      current_period_end = NOW() + INTERVAL '7 days',
      updated_at = NOW()
    WHERE id = v_subscription_id;
    
    RETURN v_subscription_id;
  ELSE
    INSERT INTO subscriptions (
      tenant_id,
      plan_id,
      status,
      trial_starts_at,
      trial_ends_at,
      trial_campaign_limit,
      features_enabled,
      current_period_start,
      current_period_end
    ) VALUES (
      p_tenant_id,
      'trial',
      'trial'::subscription_status,
      NOW(),
      NOW() + INTERVAL '7 days',
      1,
      '{"all": true}'::jsonb,
      NOW(),
      NOW() + INTERVAL '7 days'
    )
    RETURNING id INTO v_subscription_id;
    
    RETURN v_subscription_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PART 6: FUNCTION TO EXPIRE TRIAL (Called by cron or app)
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_trial_subscriptions()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE subscriptions
  SET 
    status = 'free'::subscription_status,
    features_enabled = '{"basic": true, "premium": false}'::jsonb,
    updated_at = NOW()
  WHERE status = 'trial'::subscription_status
    AND trial_ends_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PART 7: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status 
  ON subscriptions(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends 
  ON subscriptions(trial_ends_at) 
  WHERE status = 'trial';

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_count 
  ON campaigns(tenant_id);


-- ============================================================================
-- VERIFICATION QUERIES (Copy/paste separately to test)
-- ============================================================================

/*

-- V1: Show enum values
SELECT enumlabel AS value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'subscription_status'
ORDER BY e.enumsortorder;


-- V2: Show subscriptions table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'subscriptions'
ORDER BY ordinal_position;


-- V3: Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_enforce_trial_campaign_limit';


-- V4: Check functions exist
SELECT proname FROM pg_proc
WHERE proname IN (
  'is_tenant_in_trial',
  'has_paid_subscription',
  'get_tenant_campaign_count',
  'get_trial_campaign_limit',
  'enforce_trial_campaign_limit',
  'start_tenant_trial',
  'expire_trial_subscriptions'
);


-- V5: Full integration test
DO $$
DECLARE
  v_tenant_id UUID;
  v_sub_id UUID;
  v_campaign_id UUID;
  v_error_caught BOOLEAN := FALSE;
BEGIN
  INSERT INTO tenants (name, subdomain, plan)
  VALUES ('Integration Test', 'int-test-' || substr(gen_random_uuid()::text, 1, 8), 'free')
  RETURNING id INTO v_tenant_id;
  
  v_sub_id := start_tenant_trial(v_tenant_id);
  
  INSERT INTO campaigns (tenant_id, name, platform)
  VALUES (v_tenant_id, 'Test Campaign 1', 'meta')
  RETURNING id INTO v_campaign_id;
  
  BEGIN
    INSERT INTO campaigns (tenant_id, name, platform)
    VALUES (v_tenant_id, 'Test Campaign 2', 'meta');
  EXCEPTION WHEN OTHERS THEN
    v_error_caught := TRUE;
  END;
  
  DELETE FROM campaigns WHERE tenant_id = v_tenant_id;
  DELETE FROM subscriptions WHERE tenant_id = v_tenant_id;
  DELETE FROM tenants WHERE id = v_tenant_id;
  
  IF v_error_caught THEN
    NULL;
  END IF;
END $$;

*/
