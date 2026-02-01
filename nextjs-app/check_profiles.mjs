import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function check() {
  console.log('🔄 Checking profiles table...');
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log('📋 Current columns:', data ? Object.keys(data[0] || {}) : 'empty');
  console.log('📋 Sample data:', JSON.stringify(data, null, 2));
}

check().catch(console.error);
