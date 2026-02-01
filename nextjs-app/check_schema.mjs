import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('🔍 Checking profiles table columns...\n');
  
  // Get one row to see columns
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ Current columns in profiles:');
    console.log(Object.keys(data[0]).join(', '));
    console.log('\n📋 Sample data:');
    console.log(JSON.stringify(data[0], null, 2));
  }
  
  // Check tenant_setup table
  console.log('\n🔍 Checking tenant_setup table...');
  const { data: setupData, error: setupError } = await supabase
    .from('tenant_setup')
    .select('*')
    .limit(1);
  
  if (setupError) {
    console.log('❌ tenant_setup table error:', setupError.message);
  } else if (setupData && setupData.length > 0) {
    console.log('✅ tenant_setup columns:');
    console.log(Object.keys(setupData[0]).join(', '));
  } else {
    console.log('⚠️ tenant_setup table exists but is empty');
  }
}

checkSchema();
