import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsersTable() {
  console.log('Checking users table structure...');
  
  // Try to select from users table
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error querying users table:', error.message);
  } else {
    console.log('Users table exists. Sample data:', data);
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
    }
  }
  
  // Try to insert into users table first, then profiles
  console.log('\nTrying to insert into users table first...');
  const testId = crypto.randomUUID();
  
  const { error: usersError } = await supabase
    .from('users')
    .insert({
      id: testId,
      email: 'test-' + Date.now() + '@example.com'
    });
  
  if (usersError) {
    console.error('Users insert error:', usersError.message);
    console.error('Full error:', JSON.stringify(usersError, null, 2));
  } else {
    console.log('Users insert successful!');
    
    // Now try profiles
    const { error: profilesError } = await supabase
      .from('profiles')
      .insert({
        id: testId,
        open_id: 'test-' + Date.now(),
        name: 'Test User',
        email: 'test@example.com'
      });
    
    if (profilesError) {
      console.error('Profiles insert error:', profilesError.message);
    } else {
      console.log('Profiles insert successful!');
    }
    
    // Clean up
    await supabase.from('profiles').delete().eq('id', testId);
    await supabase.from('users').delete().eq('id', testId);
    console.log('Cleanup done.');
  }
}

checkUsersTable().catch(console.error);
