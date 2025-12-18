-- ============================================================================
-- 02_patch_trial.sql
-- Purpose: Add trial functionality with 7-day duration and 1 campaign limit
-- Run Order: 3 of 3 (after 01_schema_core.sql)
-- ============================================================================
-- TRIAL RULES:
-- - Duration: 7 days
-- - Features: ALL enabled during trial
-- - Limit: 1 campaign only during trial
-- - After expiry: Downgrade to free (no new campaigns)
-- ============================================================================

SET search_path TO public, auth;

-- ============================================================================
-- PART 1: ENSURE ENUM HAS 'trial' VALUE
-- ============================================================================

DO $$
DECLARE
  type_oid OID;
BEGIN
  SELECT t.oid INTO type_oid
  FROM pg_type t
  JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE t.typname = 'subscription_status' AND n.nspname = 'public';
  
  IF type_oid IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = type_oid AND enumlabel = 'trial') THEN
      EXECUTE 'ALTER TYPE subscription_status ADD VALUE ''trial''';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = type_oid AND enumlabel = 'active') THEN
      EXECUTE 'ALTER TYPE subscription_status ADD VALUE ''active''';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = type_oid AND enumlabel = 'past_due') THEN
      EXECUTE 'ALTER TYPE subscription_status ADD VALUE ''past_due''';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = type_oid AND enumlabel = 'canceled') THEN
      EXECUTE 'ALTER TYPE subscription_status ADD VALUE ''canceled''';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = type_oid AND enumlabel = 'expired') THEN
      EXECUTE 'ALTER TYPE subscription_status ADD VALUE ''expired''';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = type_oid AND enumlabel = 'free') THEN
      EXECUTE 'ALTER TYPE subscription_status ADD VALUE ''free''';
    END IF;
  END IF;
END $$;


-- ============================================================================
-- PART 2: ADD TRIAL COLUMNS TO SUBSCRIPTIONS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'trial_starts_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_starts_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'trial_campaign_limit'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_campaign_limit INT DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'trial_campaign_used'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_campaign_used BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'features_enabled'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN features_enabled JSONB DEFAULT '{"all": true}'::jsonb;
  END IF;
END $$;


-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS is_tenant_in_trial(UUID);
CREATE FUNCTION is_tenant_in_trial(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  SELECT status::TEXT, trial_ends_at
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


DROP FUNCTION IF EXISTS has_paid_subscription(UUID);
CREATE FUNCTION has_paid_subscription(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
    AND current_period_end > NOW();
  
  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP FUNCTION IF EXISTS get_tenant_campaign_count(UUID);
CREATE FUNCTION get_tenant_campaign_count(p_tenant_id UUID)
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


DROP FUNCTION IF EXISTS get_trial_campaign_limit(UUID);
CREATE FUNCTION get_trial_campaign_limit(p_tenant_id UUID)
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
-- PART 4: TRIAL CAMPAIGN LIMIT ENFORCEMENT TRIGGER
-- ============================================================================

DROP FUNCTION IF EXISTS enforce_trial_campaign_limit() CASCADE;
CREATE FUNCTION enforce_trial_campaign_limit()
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
-- PART 5: START TRIAL FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS start_tenant_trial(UUID);
CREATE FUNCTION start_tenant_trial(p_tenant_id UUID)
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
      trial_campaign_used = false,
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
      trial_campaign_used,
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
      false,
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
-- PART 6: EXPIRE TRIAL FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS expire_trial_subscriptions();
CREATE FUNCTION expire_trial_subscriptions()
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status ON subscriptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends ON subscriptions(trial_ends_at) WHERE status = 'trial';
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_count ON campaigns(tenant_id);


-- ============================================================================
-- VERIFICATION QUERIES (run separately after execution)
-- ============================================================================

-- V1: Check enum has 'trial' value
-- SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'subscription_status';

-- V2: Check subscriptions has trial columns
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name LIKE 'trial%';

-- V3: Check trigger exists
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_enforce_trial_campaign_limit';

-- V4: Check functions exist
-- SELECT proname FROM pg_proc WHERE proname IN ('is_tenant_in_trial', 'has_paid_subscription', 'start_tenant_trial', 'expire_trial_subscriptions', 'enforce_trial_campaign_limit');

-- V5: Integration test (creates and cleans up test data)
-- DO $$
-- DECLARE
--   v_tenant_id UUID;
--   v_sub_id UUID;
--   v_campaign_id UUID;
--   v_error_caught BOOLEAN := FALSE;
-- BEGIN
--   INSERT INTO tenants (name, subdomain, plan)
--   VALUES ('Test Tenant', 'test-' || substr(gen_random_uuid()::text, 1, 8), 'free')
--   RETURNING id INTO v_tenant_id;
--   
--   v_sub_id := start_tenant_trial(v_tenant_id);
--   
--   INSERT INTO campaigns (tenant_id, name, platform)
--   VALUES (v_tenant_id, 'Campaign 1', 'meta')
--   RETURNING id INTO v_campaign_id;
--   
--   BEGIN
--     INSERT INTO campaigns (tenant_id, name, platform)
--     VALUES (v_tenant_id, 'Campaign 2', 'meta');
--   EXCEPTION WHEN OTHERS THEN
--     v_error_caught := TRUE;
--   END;
--   
--   DELETE FROM campaigns WHERE tenant_id = v_tenant_id;
--   DELETE FROM subscriptions WHERE tenant_id = v_tenant_id;
--   DELETE FROM tenants WHERE id = v_tenant_id;
--   
--   IF NOT v_error_caught THEN
--     RAISE EXCEPTION 'Test failed: second campaign was not blocked';
--   END IF;
-- END $$;
