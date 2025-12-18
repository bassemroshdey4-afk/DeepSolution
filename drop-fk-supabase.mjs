import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function dropForeignKeys() {
  console.log('Attempting to drop foreign key constraints...');
  
  // Try to execute raw SQL via RPC
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
      ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_default_tenant_id_fkey;
    `
  });
  
  if (error) {
    console.error('RPC Error:', error.message);
    
    // Try alternative approach - just test if we can insert without FK
    console.log('\nTrying direct insert test...');
    const testId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: testId,
        open_id: 'test-' + Date.now(),
        name: 'Test User',
        email: 'test@example.com'
      });
    
    if (insertError) {
      console.error('Insert Error:', insertError.message);
      console.error('Full error:', JSON.stringify(insertError, null, 2));
    } else {
      console.log('Insert successful! FK constraint may have been dropped.');
      
      // Clean up test record
      await supabase.from('profiles').delete().eq('id', testId);
      console.log('Test record cleaned up.');
    }
  } else {
    console.log('SQL executed successfully:', data);
  }
}

dropForeignKeys().catch(console.error);
