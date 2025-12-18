import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  console.log('SUPABASE_URL:', supabaseUrl);
  console.log('SUPABASE_SERVICE_KEY:', supabaseKey ? 'exists' : 'missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const testId = crypto.randomUUID();
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: testId,
      email: 'test@example.com',
      name: 'Test User'
    })
    .select();
  
  if (error) {
    console.log('Insert Error:', error.message);
    console.log('Error details:', error);
  } else {
    console.log('Insert Success:', data);
    // Clean up
    await supabase.from('profiles').delete().eq('id', testId);
    console.log('Cleaned up test record');
  }
}

testInsert();
