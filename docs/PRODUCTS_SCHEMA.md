# Products Table Schema

## Columns

| Column | Type | Format | Required | Description |
|--------|------|--------|----------|-------------|
| `id` | string | uuid | ✅ Required | Primary key |
| `tenant_id` | string | uuid | ✅ Required | Foreign key to tenant |
| `name` | string | varchar | ✅ Required | Product name |
| `description` | string | text | Optional | Product description |
| `sku` | string | varchar | Optional | Stock Keeping Unit |
| `price` | number | numeric | Optional | Selling price |
| `cost` | number | numeric | Optional | Purchase cost |
| `quantity` | number | integer | Optional | Available quantity |
| `is_active` | boolean | boolean | Optional | Product status |
| `created_at` | string | timestamp with time zone | Optional | Creation timestamp |
| `updated_at` | string | timestamp with time zone | Optional | Last update timestamp |
| `barcode` | string | varchar | Optional | Product barcode |
| `compare_at_price` | number | numeric | Optional | Original price for discounts |
| `low_stock_threshold` | number | integer | Optional | Low stock alert threshold |
| `weight` | number | numeric | Optional | Product weight |
| `weight_unit` | string | varchar | Optional | Weight unit (kg, g, etc.) |
| `is_featured` | boolean | boolean | Optional | Featured product flag |
| `category` | string | varchar | Optional | Product category |
| `tags` | array | text[] | Optional | Product tags |
| `images` | json | jsonb | Optional | Product images array |
| `metadata` | json | jsonb | Optional | Additional metadata |

## Supabase API Examples

### Insert Product
```javascript
const { data, error } = await supabase
  .from('products')
  .insert([{
    tenant_id: 'uuid-here',
    name: 'Product Name',
    price: 100.00,
    cost: 50.00,
    quantity: 10,
    is_active: true
  }])
  .select()
```

### Read Products
```javascript
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('tenant_id', 'uuid-here')
```

### Update Product
```javascript
const { data, error } = await supabase
  .from('products')
  .update({ price: 120.00 })
  .eq('id', 'product-uuid')
  .select()
```

### Delete Product
```javascript
const { error } = await supabase
  .from('products')
  .delete()
  .eq('id', 'product-uuid')
```
