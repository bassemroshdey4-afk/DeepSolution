import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function test() {
  // Get an existing tenant
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
  if (!tenants || tenants.length === 0) {
    console.log('No tenants found');
    return;
  }
  const tenantId = tenants[0].id;
  console.log('Using tenant:', tenantId);
  
  // First check what columns orders has
  const { error: colErr } = await supabase.from('orders').insert({ tenant_id: tenantId });
  console.log('Orders required columns error:', colErr?.message);
  
  // Try minimal order
  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    tenant_id: tenantId,
  }).select().single();
  
  if (orderErr) {
    console.log('Order error:', orderErr.message);
    return;
  }
  console.log('Created order:', order.id);
  
  // Now try to insert shipment
  const { data: shipment, error: shipErr } = await supabase.from('shipments').insert({
    tenant_id: tenantId,
    order_id: order.id,
  }).select();
  
  if (shipErr) {
    console.log('Shipment error:', shipErr.message);
  } else {
    console.log('Shipment columns:', Object.keys(shipment[0]));
    console.log('Shipment data:', JSON.stringify(shipment[0], null, 2));
    // Clean up
    await supabase.from('shipments').delete().eq('id', shipment[0].id);
  }
  
  // Clean up order
  await supabase.from('orders').delete().eq('id', order.id);
  console.log('Cleanup done');
}

test();
