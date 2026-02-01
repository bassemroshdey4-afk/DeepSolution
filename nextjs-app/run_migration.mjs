import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// Since we can't run ALTER TABLE via REST API, let's try a workaround
// We'll create a new table with all columns and migrate data

async function runMigration() {
  console.log('🔄 Starting migration workaround...');
  
  // Step 1: Check if columns already exist by trying to select them
  const { data: checkData, error: checkError } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .limit(1);
  
  if (!checkError) {
    console.log('✅ onboarding_completed column already exists!');
    return;
  }
  
  console.log('⚠️ Column does not exist, need DDL migration');
  console.log('Error:', checkError.message);
  
  // The REST API cannot run DDL statements
  // User needs to run this SQL manually in Supabase SQL Editor
  console.log('\n📋 Please run this SQL in Supabase SQL Editor:');
  console.log(`
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS language TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT,
ADD COLUMN IF NOT EXISTS monthly_order_volume TEXT,
ADD COLUMN IF NOT EXISTS recommended_plan TEXT;
  `);
}

runMigration().catch(console.error);
