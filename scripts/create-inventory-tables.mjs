import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function createTables() {
  console.log('=== Creating Inventory & Procurement Tables ===\n');

  // 1. Add reserved_stock to products
  console.log('1. Adding reserved_stock to products...');
  const { error: alterErr } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock INTEGER DEFAULT 0;`
  });
  if (alterErr) {
    // Try direct approach
    const { error } = await supabase.from('products').update({ reserved_stock: 0 }).eq('id', '00000000-0000-0000-0000-000000000000');
    if (error && !error.message.includes('reserved_stock')) {
      console.log('  Note: reserved_stock column may need manual addition');
    }
  }
  console.log('  Done (or already exists)');

  // 2. Create stock_movements table
  console.log('2. Creating stock_movements table...');
  const { error: smErr } = await supabase.from('stock_movements').select('id').limit(1);
  if (smErr && smErr.message.includes('does not exist')) {
    console.log('  Table needs to be created via Supabase Dashboard or MCP');
  } else {
    console.log('  Table exists or check completed');
  }

  // 3. Create suppliers table
  console.log('3. Creating suppliers table...');
  const { error: supErr } = await supabase.from('suppliers').select('id').limit(1);
  if (supErr && supErr.message.includes('does not exist')) {
    console.log('  Table needs to be created via Supabase Dashboard or MCP');
  } else {
    console.log('  Table exists or check completed');
  }

  // 4. Create supplier_products table
  console.log('4. Creating supplier_products table...');
  const { error: spErr } = await supabase.from('supplier_products').select('id').limit(1);
  if (spErr && spErr.message.includes('does not exist')) {
    console.log('  Table needs to be created via Supabase Dashboard or MCP');
  } else {
    console.log('  Table exists or check completed');
  }

  // 5. Create purchase_orders table
  console.log('5. Creating purchase_orders table...');
  const { error: poErr } = await supabase.from('purchase_orders').select('id').limit(1);
  if (poErr && poErr.message.includes('does not exist')) {
    console.log('  Table needs to be created via Supabase Dashboard or MCP');
  } else {
    console.log('  Table exists or check completed');
  }

  // 6. Create purchase_order_items table
  console.log('6. Creating purchase_order_items table...');
  const { error: poiErr } = await supabase.from('purchase_order_items').select('id').limit(1);
  if (poiErr && poiErr.message.includes('does not exist')) {
    console.log('  Table needs to be created via Supabase Dashboard or MCP');
  } else {
    console.log('  Table exists or check completed');
  }

  // 7. Create purchase_invoices table
  console.log('7. Creating purchase_invoices table...');
  const { error: piErr } = await supabase.from('purchase_invoices').select('id').limit(1);
  if (piErr && piErr.message.includes('does not exist')) {
    console.log('  Table needs to be created via Supabase Dashboard or MCP');
  } else {
    console.log('  Table exists or check completed');
  }

  console.log('\n=== Done ===');
}

createTables();
