-- Deep Solution RLS Policies
-- Run this AFTER 01_core_schema.sql
-- Version: 1.0.0

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Get user's tenant IDs
-- ============================================
CREATE OR REPLACE FUNCTION get_user_tenant_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TENANTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view their tenants" ON tenants;
CREATE POLICY "Users can view their tenants" ON tenants
  FOR SELECT
  USING (id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Owners can update their tenants" ON tenants;
CREATE POLICY "Owners can update their tenants" ON tenants
  FOR UPDATE
  USING (
    id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- TENANT_USERS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view tenant members" ON tenant_users;
CREATE POLICY "Users can view tenant members" ON tenant_users
  FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Admins can manage tenant members" ON tenant_users;
CREATE POLICY "Admins can manage tenant members" ON tenant_users
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- PRODUCTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view tenant products" ON products;
CREATE POLICY "Users can view tenant products" ON products
  FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Users can insert tenant products" ON products;
CREATE POLICY "Users can insert tenant products" ON products
  FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Users can update tenant products" ON products;
CREATE POLICY "Users can update tenant products" ON products
  FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Admins can delete tenant products" ON products;
CREATE POLICY "Admins can delete tenant products" ON products
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- ORDERS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view tenant orders" ON orders;
CREATE POLICY "Users can view tenant orders" ON orders
  FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Users can insert tenant orders" ON orders;
CREATE POLICY "Users can insert tenant orders" ON orders
  FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Users can update tenant orders" ON orders;
CREATE POLICY "Users can update tenant orders" ON orders
  FOR UPDATE
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Admins can delete tenant orders" ON orders;
CREATE POLICY "Admins can delete tenant orders" ON orders
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- ORDER_ITEMS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view order items" ON order_items;
CREATE POLICY "Users can view order items" ON order_items
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Users can insert order items" ON order_items;
CREATE POLICY "Users can insert order items" ON order_items
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

DROP POLICY IF EXISTS "Users can update order items" ON order_items;
CREATE POLICY "Users can update order items" ON order_items
  FOR UPDATE
  USING (
    order_id IN (
      SELECT id FROM orders WHERE tenant_id IN (SELECT get_user_tenant_ids())
    )
  );

-- ============================================
-- INVENTORY_MOVEMENTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view inventory movements" ON inventory_movements;
CREATE POLICY "Users can view inventory movements" ON inventory_movements
  FOR SELECT
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Users can insert inventory movements" ON inventory_movements;
CREATE POLICY "Users can insert inventory movements" ON inventory_movements
  FOR INSERT
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

-- ============================================
-- SERVICE ROLE BYPASS (for server-side operations)
-- ============================================
-- Note: Service role key automatically bypasses RLS
-- Use with caution and only for admin operations

-- ============================================
-- VERIFICATION QUERIES (Run separately)
-- ============================================
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- SELECT * FROM pg_policies WHERE tablename = 'products';
