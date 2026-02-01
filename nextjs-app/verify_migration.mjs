import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function verify() {
  console.log('🔄 Verifying migration...');
  
  // Try to select the new columns
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, onboarding_completed, onboarding_step, company_name, country, language, currency, monthly_order_volume, recommended_plan')
    .limit(1);
  
  if (error) {
    console.error('❌ Migration NOT applied:', error.message);
    return false;
  }
  
  console.log('✅ Migration SUCCESS! New columns exist.');
  console.log('📋 Current columns:', Object.keys(data[0] || {}));
  console.log('📋 Sample data:', JSON.stringify(data, null, 2));
  return true;
}

verify().catch(console.error);
