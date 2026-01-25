-- ============================================================
-- SECURITY RLS HARDENING SCRIPT
-- DeepSolution - Critical Security Fix
-- ============================================================
-- 
-- PURPOSE: Ensure all tables have RLS enabled with proper tenant isolation
-- CRITICAL: Run this in Supabase SQL Editor
--
-- ============================================================

-- ============================================================
-- STEP 1: CHECK CURRENT RLS STATUS
-- ============================================================

-- View all tables and their RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- STEP 2: ENABLE RLS ON ALL CORE TABLES
-- ============================================================

-- Tenants table
ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenants FORCE ROW LEVEL SECURITY;

-- Profiles table
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles FORCE ROW LEVEL SECURITY;

-- Tenant Users table
ALTER TABLE IF EXISTS tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_users FORCE ROW LEVEL SECURITY;

-- Products table
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products FORCE ROW LEVEL SECURITY;

-- Orders table
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders FORCE ROW LEVEL SECURITY;

-- Order Items table
ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items FORCE ROW LEVEL SECURITY;

-- Campaigns table
ALTER TABLE IF EXISTS campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS campaigns FORCE ROW LEVEL SECURITY;

-- Wallets table
ALTER TABLE IF EXISTS wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallets FORCE ROW LEVEL SECURITY;

-- Wallet Transactions table
ALTER TABLE IF EXISTS wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_transactions FORCE ROW LEVEL SECURITY;

-- AI Conversations table
ALTER TABLE IF EXISTS ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_conversations FORCE ROW LEVEL SECURITY;

-- Landing Pages table
ALTER TABLE IF EXISTS landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS landing_pages FORCE ROW LEVEL SECURITY;

-- Shipments table
ALTER TABLE IF EXISTS shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shipments FORCE ROW LEVEL SECURITY;

-- Shipping Events table
ALTER TABLE IF EXISTS shipping_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shipping_events FORCE ROW LEVEL SECURITY;

-- Suppliers table
ALTER TABLE IF EXISTS suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers FORCE ROW LEVEL SECURITY;

-- Purchase Orders table
ALTER TABLE IF EXISTS purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_orders FORCE ROW LEVEL SECURITY;

-- Stock Movements table
ALTER TABLE IF EXISTS stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_movements FORCE ROW LEVEL SECURITY;

-- AI Usage Logs table
ALTER TABLE IF EXISTS ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_usage_logs FORCE ROW LEVEL SECURITY;

-- Tenant AI Subscriptions table
ALTER TABLE IF EXISTS tenant_ai_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_ai_subscriptions FORCE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: CREATE/UPDATE RLS POLICIES FOR TENANT ISOLATION
-- ============================================================

-- Helper function to get user's tenant_id
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM tenant_users 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================
-- PRODUCTS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "products_select_policy" ON products;
DROP POLICY IF EXISTS "products_insert_policy" ON products;
DROP POLICY IF EXISTS "products_update_policy" ON products;
DROP POLICY IF EXISTS "products_delete_policy" ON products;
DROP POLICY IF EXISTS "products_tenant_isolation" ON products;

-- Create strict tenant isolation policy
CREATE POLICY "products_tenant_isolation" ON products
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- ORDERS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "orders_select_policy" ON orders;
DROP POLICY IF EXISTS "orders_insert_policy" ON orders;
DROP POLICY IF EXISTS "orders_update_policy" ON orders;
DROP POLICY IF EXISTS "orders_delete_policy" ON orders;
DROP POLICY IF EXISTS "orders_tenant_isolation" ON orders;

CREATE POLICY "orders_tenant_isolation" ON orders
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- ORDER ITEMS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "order_items_tenant_isolation" ON order_items;

CREATE POLICY "order_items_tenant_isolation" ON order_items
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- CAMPAIGNS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "campaigns_tenant_isolation" ON campaigns;

CREATE POLICY "campaigns_tenant_isolation" ON campaigns
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- WALLETS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "wallets_tenant_isolation" ON wallets;

CREATE POLICY "wallets_tenant_isolation" ON wallets
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- WALLET TRANSACTIONS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "wallet_transactions_tenant_isolation" ON wallet_transactions;

CREATE POLICY "wallet_transactions_tenant_isolation" ON wallet_transactions
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- AI CONVERSATIONS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "ai_conversations_tenant_isolation" ON ai_conversations;

CREATE POLICY "ai_conversations_tenant_isolation" ON ai_conversations
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- LANDING PAGES POLICIES
-- ============================================================

DROP POLICY IF EXISTS "landing_pages_tenant_isolation" ON landing_pages;

CREATE POLICY "landing_pages_tenant_isolation" ON landing_pages
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- SHIPMENTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "shipments_tenant_isolation" ON shipments;

CREATE POLICY "shipments_tenant_isolation" ON shipments
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- SHIPPING EVENTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "shipping_events_tenant_isolation" ON shipping_events;

CREATE POLICY "shipping_events_tenant_isolation" ON shipping_events
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- SUPPLIERS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "suppliers_tenant_isolation" ON suppliers;

CREATE POLICY "suppliers_tenant_isolation" ON suppliers
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- PURCHASE ORDERS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "purchase_orders_tenant_isolation" ON purchase_orders;

CREATE POLICY "purchase_orders_tenant_isolation" ON purchase_orders
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- STOCK MOVEMENTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "stock_movements_tenant_isolation" ON stock_movements;

CREATE POLICY "stock_movements_tenant_isolation" ON stock_movements
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- AI USAGE LOGS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "ai_usage_logs_tenant_isolation" ON ai_usage_logs;

CREATE POLICY "ai_usage_logs_tenant_isolation" ON ai_usage_logs
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- TENANT AI SUBSCRIPTIONS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "tenant_ai_subscriptions_tenant_isolation" ON tenant_ai_subscriptions;

CREATE POLICY "tenant_ai_subscriptions_tenant_isolation" ON tenant_ai_subscriptions
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- TENANT USERS POLICIES (Special - users can only see their own memberships)
-- ============================================================

DROP POLICY IF EXISTS "tenant_users_select_own" ON tenant_users;
DROP POLICY IF EXISTS "tenant_users_tenant_isolation" ON tenant_users;

CREATE POLICY "tenant_users_select_own" ON tenant_users
    FOR SELECT
    USING (user_id = auth.uid());

-- ============================================================
-- PROFILES POLICIES (Users can only see/edit their own profile)
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================================
-- TENANTS POLICIES (Users can only see tenants they belong to)
-- ============================================================

DROP POLICY IF EXISTS "tenants_select_members" ON tenants;
DROP POLICY IF EXISTS "tenants_tenant_isolation" ON tenants;

CREATE POLICY "tenants_select_members" ON tenants
    FOR SELECT
    USING (
        id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================================
-- STEP 4: VERIFY RLS IS ENABLED
-- ============================================================

-- Check RLS status after changes
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- STEP 5: TEST ANON ACCESS (Should return 0 rows)
-- ============================================================

-- These queries should return 0 rows for anonymous users:
-- SELECT COUNT(*) FROM products;
-- SELECT COUNT(*) FROM orders;
-- SELECT COUNT(*) FROM campaigns;

-- ============================================================
-- END OF SECURITY HARDENING SCRIPT
-- ============================================================
