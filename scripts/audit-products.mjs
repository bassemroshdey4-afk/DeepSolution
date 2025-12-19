import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function audit() {
  // Get existing tenant
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  if (!tenants || tenants.length === 0) {
    console.log('No tenants found');
    return;
  }
  
  const tenantId = tenants[0].id;
  console.log('Using tenant:', tenantId);
  
  // Insert a test product
  const { data, error } = await supabase.from('products').insert({
    tenant_id: tenantId,
    name: 'test_audit_product',
    price: 100
  }).select();
  
  if (data && data[0]) {
    console.log('\nPRODUCTS columns:');
    Object.keys(data[0]).forEach(k => console.log(' -', k, ':', data[0][k]));
    // Delete test
    await supabase.from('products').delete().eq('id', data[0].id);
  } else {
    console.log('Error:', error?.message);
  }
  
  // Check shipments structure - create order first
  console.log('\n--- SHIPMENTS ---');
  const { data: orderData } = await supabase.from('orders').insert({
    tenant_id: tenantId,
    order_number: 'TEST-AUDIT-001',
    customer_name: 'Test',
    customer_phone: '0500000000',
    total: 100
  }).select();
  
  if (orderData && orderData[0]) {
    const { data: shipData, error: shipErr } = await supabase.from('shipments').insert({
      tenant_id: tenantId,
      order_id: orderData[0].id
    }).select();
    
    if (shipData && shipData[0]) {
      console.log('SHIPMENTS columns:');
      Object.keys(shipData[0]).forEach(k => console.log(' -', k, ':', shipData[0][k]));
      await supabase.from('shipments').delete().eq('id', shipData[0].id);
    } else {
      console.log('Shipments error:', shipErr?.message);
    }
    await supabase.from('orders').delete().eq('id', orderData[0].id);
  }
}

audit();
