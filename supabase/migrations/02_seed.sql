-- ============================================================================
-- DeepSolution: 02_seed.sql
-- Purpose: Safe tenant seeding with diagnostics
-- Run Order: 3 of 3 (run AFTER 01_schema.sql)
-- ============================================================================
--
-- IMPORTANT:
-- - Replace 'YOUR_USER_ID' with actual auth.users.id from Supabase Auth
-- - Localization fields are NULLABLE - set per tenant during onboarding
-- - This script is IDEMPOTENT - safe to run multiple times
--
-- ============================================================================

SET search_path TO public, auth;

-- ============================================================================
-- PRE-SEED DIAGNOSTICS
-- ============================================================================

DO $$
DECLARE
  tenant_users_exists BOOLEAN;
  tenants_exists BOOLEAN;
  profiles_exists BOOLEAN;
BEGIN
  -- Check critical tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) INTO tenants_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tenant_users'
  ) INTO tenant_users_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) INTO profiles_exists;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRE-SEED DIAGNOSTICS';
  RAISE NOTICE '========================================';
  
  IF tenants_exists THEN
    RAISE NOTICE '✅ public.tenants EXISTS';
  ELSE
    RAISE EXCEPTION '❌ public.tenants DOES NOT EXIST - Run 01_schema.sql first!';
  END IF;
  
  IF tenant_users_exists THEN
    RAISE NOTICE '✅ public.tenant_users EXISTS';
  ELSE
    RAISE EXCEPTION '❌ public.tenant_users DOES NOT EXIST - Run 01_schema.sql first!';
  END IF;
  
  IF profiles_exists THEN
    RAISE NOTICE '✅ public.profiles EXISTS';
  ELSE
    RAISE EXCEPTION '❌ public.profiles DOES NOT EXIST - Run 01_schema.sql first!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'All required tables exist. Proceeding with seed...';
  RAISE NOTICE '';
  
END $$;


-- ============================================================================
-- SAFE TENANT SEEDING
-- ============================================================================

-- Create or get existing tenant
DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_subdomain VARCHAR(63) := 'demo';  -- Change this for your tenant
  v_tenant_name VARCHAR(255) := 'Demo Tenant';  -- Change this for your tenant
BEGIN

  -- =========================================================================
  -- STEP 1: Get or create tenant
  -- =========================================================================
  
  -- Check if tenant with this subdomain already exists
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE subdomain = v_subdomain;
  
  IF v_tenant_id IS NOT NULL THEN
    RAISE NOTICE '📌 Tenant with subdomain "%" already exists (ID: %)', v_subdomain, v_tenant_id;
  ELSE
    -- Create new tenant (localization fields are NULL - set during onboarding)
    INSERT INTO tenants (
      name,
      subdomain,
      plan,
      is_active
      -- country, currency, language, timezone are NULL by default
      -- Set them during onboarding based on user selection
    ) VALUES (
      v_tenant_name,
      v_subdomain,
      'free',
      true
    )
    RETURNING id INTO v_tenant_id;
    
    RAISE NOTICE '✅ Created new tenant "%" (ID: %)', v_tenant_name, v_tenant_id;
  END IF;
  
  -- =========================================================================
  -- STEP 2: Link user to tenant (if user exists)
  -- =========================================================================
  
  -- Try to get the first user from auth.users (for demo purposes)
  -- In production, replace this with specific user_id
  SELECT id INTO v_user_id
  FROM auth.users
  LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    -- Insert tenant_user link (ON CONFLICT DO NOTHING for idempotency)
    INSERT INTO tenant_users (
      tenant_id,
      user_id,
      role,
      is_active
    ) VALUES (
      v_tenant_id,
      v_user_id,
      'owner',
      true
    )
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
    
    RAISE NOTICE '✅ Linked user % to tenant % as owner', v_user_id, v_tenant_id;
    
    -- =========================================================================
    -- STEP 3: Update profile's default_tenant_id (if column exists)
    -- =========================================================================
    
    -- Check if default_tenant_id column exists in profiles
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'default_tenant_id'
    ) THEN
      -- Create profile if not exists
      INSERT INTO profiles (id, default_tenant_id)
      VALUES (v_user_id, v_tenant_id)
      ON CONFLICT (id) DO UPDATE SET default_tenant_id = v_tenant_id;
      
      RAISE NOTICE '✅ Updated profile default_tenant_id for user %', v_user_id;
    ELSE
      RAISE NOTICE '⚠️ profiles.default_tenant_id column does not exist - skipping';
    END IF;
    
  ELSE
    RAISE NOTICE '⚠️ No users found in auth.users - skipping tenant_users link';
    RAISE NOTICE '   To link a user later, run:';
    RAISE NOTICE '   INSERT INTO tenant_users (tenant_id, user_id, role, is_active)';
    RAISE NOTICE '   VALUES (''%'', ''YOUR_USER_ID'', ''owner'', true);', v_tenant_id;
  END IF;
  
  -- =========================================================================
  -- STEP 4: Create tenant cognitive profile
  -- =========================================================================
  
  INSERT INTO tenant_cognitive_profile (
    tenant_id,
    ai_communication_style,
    ai_autonomy_level,
    profile_confidence
  ) VALUES (
    v_tenant_id,
    'detailed',
    'suggest',
    0.5
  )
  ON CONFLICT (tenant_id) DO NOTHING;
  
  RAISE NOTICE '✅ Created tenant cognitive profile';
  
  -- =========================================================================
  -- STEP 5: Create subscription
  -- =========================================================================
  
  INSERT INTO subscriptions (
    tenant_id,
    plan_id,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    v_tenant_id,
    'free',
    'trial',
    NOW(),
    NOW() + INTERVAL '14 days'
  )
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE '✅ Created subscription';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SEED COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tenant ID: %', v_tenant_id;
  RAISE NOTICE 'Subdomain: %', v_subdomain;
  RAISE NOTICE '';
  
END $$;


-- ============================================================================
-- POST-SEED DIAGNOSTICS
-- ============================================================================

DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'tenants', 'profiles', 'tenant_users', 'tenant_cognitive_profile',
    'tenant_domains', 'subscriptions', 'products', 'product_variants',
    'product_intelligence', 'campaigns', 'campaign_intelligence',
    'campaign_learnings', 'customer_segments', 'customer_behavior_patterns',
    'operational_capacity', 'operational_metrics_daily', 'shipping_providers',
    'shipping_sla_rules', 'orders', 'order_items', 'order_status_history',
    'shipments', 'shipping_performance', 'financial_transactions',
    'order_profit_timeline', 'unit_economics_summary', 'marketing_to_cash_journey',
    'experiments', 'experiment_wisdom', 'failure_events', 'failure_patterns',
    'decisions', 'decision_outcomes', 'ai_trust_scores', 'insights',
    'workflow_runs', 'events', 'event_summaries_daily', 'template_categories',
    'blocks', 'templates', 'ai_template_rules', 'page_instances', 'page_versions',
    'ai_generation_jobs', 'ai_generated_copy', 'deployments', 'ai_conversations',
    'inventory_logs', 'files', 'audit_logs'
  ];
  missing_tables TEXT[] := '{}';
  tbl TEXT;
  table_exists BOOLEAN;
  total_expected INT;
  total_found INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POST-SEED DIAGNOSTICS';
  RAISE NOTICE '========================================';
  
  total_expected := array_length(expected_tables, 1);
  
  FOREACH tbl IN ARRAY expected_tables
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = tbl
    ) INTO table_exists;
    
    IF table_exists THEN
      total_found := total_found + 1;
    ELSE
      missing_tables := array_append(missing_tables, tbl);
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Tables found: % / %', total_found, total_expected;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '❌ MISSING TABLES:';
    FOREACH tbl IN ARRAY missing_tables
    LOOP
      RAISE NOTICE '   - %', tbl;
    END LOOP;
    RAISE NOTICE '';
    RAISE NOTICE 'ACTION: Re-run 01_schema.sql to create missing tables';
  ELSE
    RAISE NOTICE '✅ All expected tables exist';
  END IF;
  
  -- Check tenant_users specifically (the error from user)
  RAISE NOTICE '';
  RAISE NOTICE '--- tenant_users status ---';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenant_users') THEN
    RAISE NOTICE '✅ public.tenant_users EXISTS';
    
    -- Count rows
    EXECUTE 'SELECT COUNT(*) FROM tenant_users' INTO total_found;
    RAISE NOTICE '   Rows: %', total_found;
    
    -- Check RLS
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_users' AND rowsecurity = true) THEN
      RAISE NOTICE '   RLS: ENABLED';
    ELSE
      RAISE NOTICE '   RLS: DISABLED';
    END IF;
  ELSE
    RAISE NOTICE '❌ public.tenant_users DOES NOT EXIST';
    RAISE NOTICE '   This is the error you reported!';
    RAISE NOTICE '   ACTION: Run 01_schema.sql first';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNOSTICS COMPLETE';
  RAISE NOTICE '========================================';
  
END $$;


-- ============================================================================
-- QUICK VERIFICATION QUERY
-- ============================================================================

-- Uncomment to run verification:
/*
SELECT 
  'tenants' as table_name, 
  COUNT(*) as row_count 
FROM tenants
UNION ALL
SELECT 'tenant_users', COUNT(*) FROM tenant_users
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions;
*/


-- ============================================================================
-- HOW TO RUN
-- ============================================================================
/*

EXECUTION ORDER:
================
1. Run preflight FIRST:     00_preflight.sql
2. Run schema SECOND:       01_schema.sql  
3. Run this file THIRD:     02_seed.sql

INSTRUCTIONS:
=============
1. Open Supabase Dashboard → SQL Editor
2. Paste this entire file
3. Click "Run"
4. Check the "Messages" tab for results
5. All diagnostics should show ✅

CUSTOMIZATION:
==============
- Change v_subdomain and v_tenant_name in the seed block
- Localization (country, currency, language, timezone) is NULL by default
- Set localization during onboarding based on user selection

TROUBLESHOOTING:
================
If you see "relation tenant_users does not exist":
1. Run 00_preflight.sql first
2. Run 01_schema.sql second
3. Then run this file

*/
