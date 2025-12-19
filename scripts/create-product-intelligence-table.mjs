import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  // Check if table exists by trying to select from it
  const { data, error } = await supabase
    .from('product_intelligence')
    .select('id')
    .limit(1);

  if (error && error.code === '42P01') {
    console.log('Table does not exist, need to create it via Supabase Dashboard');
    console.log('Please run this SQL in Supabase SQL Editor:');
    console.log(`
CREATE TABLE IF NOT EXISTS product_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_name TEXT NOT NULL,
  product_description TEXT,
  product_image_url TEXT,
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  intelligence JSONB NOT NULL,
  language TEXT DEFAULT 'ar',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_intelligence_tenant ON product_intelligence(tenant_id);

-- Add product_intelligence_id to landing_pages and campaigns
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS product_intelligence_id UUID REFERENCES product_intelligence(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS product_intelligence_id UUID REFERENCES product_intelligence(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ad_content JSONB;
    `);
  } else if (error) {
    console.error('Error checking table:', error);
  } else {
    console.log('Table already exists!');
  }
}

createTable();
