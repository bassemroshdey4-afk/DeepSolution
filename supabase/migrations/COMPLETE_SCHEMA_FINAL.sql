-- ============================================================
-- DeepSolution Complete Schema - Single File Execution
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- PART 1: Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PART 2: Enum Types (Safe Creation)
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled', 'returned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tenant_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PART 3: Core Tables

-- Tenants (FIRST - all tables depend on this)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  country VARCHAR(2),
  currency VARCHAR(3),
  language VARCHAR(5),
  timezone VARCHAR(50),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  name VARCHAR(255),
  avatar_url TEXT,
  default_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Users (Junction table)
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- PART 4: Subscriptions with Trial Support
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'trial',
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  trial_campaigns_limit INTEGER DEFAULT 1,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- PART 5: Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  budget DECIMAL(15,2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PART 6: Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100),
  price DECIMAL(15,2),
  cost DECIMAL(15,2),
  quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PART 7: Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number VARCHAR(50),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  shipping_address TEXT,
  status order_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  subtotal DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PART 8: Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- PART 9: RLS Policies

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Tenant users policies
DROP POLICY IF EXISTS "Users can view their tenant memberships" ON tenant_users;
CREATE POLICY "Users can view their tenant memberships" ON tenant_users
  FOR SELECT USING (auth.uid() = user_id);

-- Tenants policies
DROP POLICY IF EXISTS "Users can view tenants they belong to" ON tenants;
CREATE POLICY "Users can view tenants they belong to" ON tenants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = tenants.id AND tenant_users.user_id = auth.uid())
  );

-- Subscriptions policies
DROP POLICY IF EXISTS "Users can view their tenant subscriptions" ON subscriptions;
CREATE POLICY "Users can view their tenant subscriptions" ON subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = subscriptions.tenant_id AND tenant_users.user_id = auth.uid())
  );

-- Campaigns policies
DROP POLICY IF EXISTS "Users can manage their tenant campaigns" ON campaigns;
CREATE POLICY "Users can manage their tenant campaigns" ON campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = campaigns.tenant_id AND tenant_users.user_id = auth.uid())
  );

-- Products policies
DROP POLICY IF EXISTS "Users can manage their tenant products" ON products;
CREATE POLICY "Users can manage their tenant products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = products.tenant_id AND tenant_users.user_id = auth.uid())
  );

-- Orders policies
DROP POLICY IF EXISTS "Users can manage their tenant orders" ON orders;
CREATE POLICY "Users can manage their tenant orders" ON orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = orders.tenant_id AND tenant_users.user_id = auth.uid())
  );

-- Order items policies
DROP POLICY IF EXISTS "Users can manage their tenant order items" ON order_items;
CREATE POLICY "Users can manage their tenant order items" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN tenant_users tu ON tu.tenant_id = o.tenant_id
      WHERE o.id = order_items.order_id AND tu.user_id = auth.uid()
    )
  );

-- PART 10: Trial Helper Functions

-- Check if tenant is in active trial
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

-- Start trial for a tenant (7 days, 1 campaign limit)
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

-- Expire trial subscriptions
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

-- PART 11: Trial Campaign Limit Enforcement

-- Function to check campaign limit during trial
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

-- Create trigger for campaign limit
DROP TRIGGER IF EXISTS enforce_trial_campaign_limit ON campaigns;
CREATE TRIGGER enforce_trial_campaign_limit
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION check_trial_campaign_limit();

-- PART 12: Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- VERIFICATION QUERIES (Run separately after main execution)
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT typname, enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'subscription_status';
-- SELECT proname FROM pg_proc WHERE proname IN ('is_tenant_in_trial', 'start_tenant_trial', 'expire_trial_subscriptions');
-- SELECT tgname FROM pg_trigger WHERE tgname = 'enforce_trial_campaign_limit';
