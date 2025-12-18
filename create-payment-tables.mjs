import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Payment Methods Table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'stripe', 'paypal', 'vodafone_cash', 'bank_transfer', etc.
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  description TEXT,
  description_ar TEXT,
  is_enabled BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}', -- Provider-specific configuration (encrypted sensitive data)
  supported_currencies TEXT[] DEFAULT ARRAY['USD', 'SAR', 'AED', 'EGP'],
  min_amount DECIMAL(15,2) DEFAULT 0,
  max_amount DECIMAL(15,2),
  fee_type VARCHAR(20) DEFAULT 'percentage', -- 'percentage', 'fixed', 'both'
  fee_percentage DECIMAL(5,2) DEFAULT 0,
  fee_fixed DECIMAL(15,2) DEFAULT 0,
  display_order INT DEFAULT 0,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  order_id UUID,
  customer_id UUID,
  payment_method_id UUID,
  external_id VARCHAR(255), -- Provider's transaction ID
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  fee_amount DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2),
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'
  type VARCHAR(30) NOT NULL DEFAULT 'payment', -- 'payment', 'refund', 'payout', 'chargeback'
  provider VARCHAR(50),
  provider_response JSONB,
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  error_code VARCHAR(50),
  ip_address INET,
  user_agent TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Proofs Table (for manual payments like Vodafone Cash)
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  transaction_id UUID,
  order_id UUID,
  customer_id UUID,
  proof_type VARCHAR(30) NOT NULL, -- 'receipt_image', 'transfer_reference', 'screenshot'
  proof_url TEXT, -- S3 URL for uploaded image
  reference_number VARCHAR(100),
  sender_phone VARCHAR(20),
  sender_name VARCHAR(100),
  amount_claimed DECIMAL(15,2),
  currency VARCHAR(3) DEFAULT 'EGP',
  notes TEXT,
  status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Events Table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  provider VARCHAR(50) NOT NULL, -- 'stripe', 'paypal', etc.
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255), -- Provider's event ID
  payload JSONB NOT NULL,
  headers JSONB,
  signature VARCHAR(500),
  is_verified BOOLEAN DEFAULT false,
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_provider ON public.payment_methods(provider);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON public.payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external ON public.payment_transactions(external_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_tenant ON public.payment_proofs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_transaction ON public.payment_proofs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON public.payment_proofs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(is_processed);
`;

async function createTables() {
  console.log('Creating payment tables...');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    // Try executing via raw SQL if RPC doesn't exist
    console.log('RPC not available, trying direct execution...');
    
    // Split SQL into individual statements
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (!statement.trim()) continue;
      
      const { error: stmtError } = await supabase.from('_exec').select('*').limit(0);
      // This won't work directly, we need to use the SQL editor
    }
    
    console.error('Error creating tables:', error.message);
    console.log('\nPlease run the following SQL in Supabase SQL Editor:\n');
    console.log(sql);
    return;
  }
  
  console.log('Payment tables created successfully!');
}

createTables();
