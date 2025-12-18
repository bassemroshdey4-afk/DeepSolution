-- ============================================================
-- DeepSolution - VERIFICATION QUERIES
-- Run these after PATCH_01_activate_db.sql
-- ============================================================

-- ============================================================
-- QUERY 1: Count all tables in public schema
-- Expected: 48
-- ============================================================
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- ============================================================
-- QUERY 2: List all tables alphabetically
-- ============================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================
-- QUERY 3: Check subscription_status enum values
-- Expected: trial, active, canceled, expired, past_due (or similar)
-- ============================================================
SELECT enumlabel as status_value
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'subscription_status'
ORDER BY enumsortorder;

-- ============================================================
-- QUERY 4: Count all functions in public schema
-- ============================================================
SELECT COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

-- ============================================================
-- QUERY 5: List key functions
-- ============================================================
SELECT routine_name 
FROM information_schema.routines
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
AND routine_name IN (
  'user_has_tenant_access',
  'get_user_tenant_ids',
  'is_tenant_in_trial',
  'count_tenant_campaigns',
  'enforce_trial_campaign_limit',
  'start_tenant_trial',
  'expire_trial_subscriptions'
)
ORDER BY routine_name;

-- ============================================================
-- QUERY 6: Count triggers
-- ============================================================
SELECT COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- ============================================================
-- QUERY 7: List triggers
-- ============================================================
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- ============================================================
-- QUERY 8: Count RLS policies
-- ============================================================
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public';

-- ============================================================
-- QUERY 9: Check Boss Commerce tenant exists
-- ============================================================
SELECT id, name, slug, created_at
FROM tenants
WHERE slug = 'boss-commerce';

-- ============================================================
-- QUERY 10: Check events table columns for tracking
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'events'
AND column_name IN (
  'tenant_id', 'store_id', 'session_id', 'user_id', 
  'event_name', 'product_id', 'order_id', 'source',
  'utm_source', 'utm_campaign', 'utm_content', 'utm_term',
  'ad_platform', 'ad_account_id', 'campaign_platform_id', 'ad_id',
  'occurred_at'
)
ORDER BY column_name;

-- ============================================================
-- BONUS: Test Trial Campaign Limit
-- (Run this to test the trigger - should fail on second campaign)
-- ============================================================
-- First, get the tenant_id:
-- SELECT id FROM tenants WHERE slug = 'boss-commerce';
--
-- Then try to insert 2 campaigns:
-- INSERT INTO campaigns (tenant_id, name, status, created_at) 
-- VALUES ('YOUR_TENANT_ID', 'Test Campaign 1', 'draft', NOW());
--
-- INSERT INTO campaigns (tenant_id, name, status, created_at) 
-- VALUES ('YOUR_TENANT_ID', 'Test Campaign 2', 'draft', NOW());
-- ^ This should fail with "Trial limit reached" error
-- ============================================================
