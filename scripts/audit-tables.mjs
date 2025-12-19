import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const tableNames = [
  'products', 'product_variants', 'inventory', 'stock', 'stock_movements', 
  'suppliers', 'supplier_products', 'purchase_orders', 'purchase_order_items',
  'purchase_invoices', 'orders', 'order_items', 'shipments', 'tenants', 'users'
];

async function auditTables() {
  console.log('=== Supabase Schema Audit ===\n');
  
  for (const table of tableNames) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log('✓ EXISTS:', table);
    } else if (error.code === 'PGRST116') {
      console.log('✗ MISSING:', table);
    } else {
      console.log('? ERROR:', table, '-', error.message);
    }
  }
}

async function getColumns(table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) return null;
  
  // Get column names from the first row or empty object
  if (data && data.length > 0) {
    return Object.keys(data[0]);
  }
  
  // If no data, try to get structure from error
  return [];
}

async function auditWithColumns() {
  console.log('\n=== Detailed Column Audit ===\n');
  
  const existingTables = ['products', 'product_variants', 'orders', 'order_items', 'shipments', 'tenants'];
  
  for (const table of existingTables) {
    const { data } = await supabase.from(table).select('*').limit(1);
    if (data && data.length > 0) {
      console.log(`\n${table.toUpperCase()}:`);
      console.log(Object.keys(data[0]).join(', '));
    } else {
      // Try to insert and catch error to see columns
      const { error } = await supabase.from(table).select('id').limit(0);
      console.log(`\n${table.toUpperCase()}: (empty table)`);
    }
  }
}

auditTables().then(() => auditWithColumns());
