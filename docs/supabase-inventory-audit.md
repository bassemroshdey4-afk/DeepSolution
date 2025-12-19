# Supabase Schema Audit - Inventory & Procurement

## 1. Existing Tables Analysis

### ✅ PRODUCTS (Reuse + Extend)
**Status:** EXISTS - Can be extended

**Current Columns:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants |
| name | string | ✓ |
| description | string | ✓ |
| sku | string | ✓ Already exists |
| price | number | Selling price |
| cost | number | ✓ Already exists (COGS) |
| quantity | number | ✓ Current stock |
| is_active | boolean | ✓ |
| barcode | string | ✓ |
| compare_at_price | number | ✓ |
| low_stock_threshold | number | ✓ Already exists (reorder_level) |
| weight | number | ✓ |
| weight_unit | string | ✓ |
| is_featured | boolean | ✓ |
| category | string | ✓ |
| tags | array | ✓ |
| images | array | ✓ |
| metadata | jsonb | ✓ Can store extra data |

**Needed Extensions:**
- `reserved_stock` (number) - Stock reserved by pending orders
- `available_stock` (computed: quantity - reserved_stock)

**Decision:** EXTEND - Add `reserved_stock` column only

---

### ✅ ORDERS (Reuse)
**Status:** EXISTS - Ready to use

**Current Columns:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK → tenants |
| order_number | string | ✓ |
| customer_* | various | ✓ |
| status | enum | pending/confirmed/processing/shipped/delivered/cancelled/returned |
| payment_status | enum | ✓ |
| total | number | ✓ |
| campaign_id | uuid | ✓ For ad attribution |

**Decision:** REUSE - No changes needed

---

### ✅ ORDER_ITEMS (Reuse)
**Status:** EXISTS - Ready to use

**Current Columns:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tenant_id | uuid | FK |
| order_id | uuid | FK → orders |
| product_id | uuid | FK → products |
| product_name | string | ✓ |
| quantity | number | ✓ |
| unit_price | number | ✓ |
| total_price | number | ✓ |

**Decision:** REUSE - No changes needed

---

### ✅ SHIPMENTS (Reuse)
**Status:** EXISTS - Ready to use

**Current Columns:**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| order_id | uuid | FK → orders |
| tenant_id | uuid | FK |
| provider_id | string | Carrier ID |
| tracking_number | string | ✓ |
| status | string | ✓ |
| shipped_at | timestamp | ✓ |
| delivered_at | timestamp | ✓ |
| shipping_cost | number | ✓ |
| tracking_events | jsonb | ✓ |

**Decision:** REUSE - No changes needed

---

### ❌ MISSING Tables

| Table | Status | Action |
|-------|--------|--------|
| stock_movements | MISSING | CREATE |
| suppliers | MISSING | CREATE |
| supplier_products | MISSING | CREATE |
| purchase_orders | MISSING | CREATE |
| purchase_order_items | MISSING | CREATE |
| purchase_invoices | MISSING | CREATE |

---

## 2. Proposed New Tables (Minimal)

### stock_movements
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id),
  type VARCHAR(20) NOT NULL, -- 'in', 'out', 'return', 'adjustment', 'purchase'
  quantity INTEGER NOT NULL, -- positive for in, negative for out
  reference_type VARCHAR(50), -- 'order', 'purchase_order', 'manual', 'return'
  reference_id UUID, -- order_id or po_id
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### suppliers
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  payment_terms VARCHAR(100), -- 'net_30', 'net_60', 'cod'
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### supplier_products
```sql
CREATE TABLE supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  product_id UUID NOT NULL REFERENCES products(id),
  supplier_sku VARCHAR(100),
  unit_cost DECIMAL(10,2) NOT NULL,
  min_order_qty INTEGER DEFAULT 1,
  lead_time_days INTEGER,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, product_id)
);
```

### purchase_orders
```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  po_number VARCHAR(50) NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'partially_received', 'received', 'cancelled'
  expected_delivery DATE,
  subtotal DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  other_charges DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### purchase_order_items
```sql
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  received_quantity INTEGER DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### purchase_invoices
```sql
CREATE TABLE purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  po_id UUID REFERENCES purchase_orders(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  shipping DECIMAL(10,2) DEFAULT 0,
  other_charges DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'partial', 'paid'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Column Extensions (Minimal)

### products table - Add 1 column:
```sql
ALTER TABLE products ADD COLUMN reserved_stock INTEGER DEFAULT 0;
```

---

## 4. Integration Points

### Orders → Stock (Automatic)
1. **Order Confirmed** → Reserve stock (increase `reserved_stock`)
2. **Order Shipped** → Deduct stock (decrease `quantity`, decrease `reserved_stock`)
3. **Order Cancelled** → Release reservation (decrease `reserved_stock`)
4. **Order Returned** → Add back stock (increase `quantity`)

### Purchase → Stock
1. **PO Received** → Increase stock (increase `quantity`)
2. **Invoice Paid** → Update `cost` if different from current

### Stock → Profit Intelligence (COGS)
- `products.cost` feeds directly into `order_costs.cogs`
- Already implemented in Profit Router

---

## 5. Multi-Tenant Isolation

All new tables include `tenant_id` with:
- Foreign key to `tenants(id)`
- Row Level Security (RLS) policies
- Index on `tenant_id` for performance

---

## 6. Summary

| Category | Reuse | Extend | Create |
|----------|-------|--------|--------|
| products | ✓ | +1 column | - |
| orders | ✓ | - | - |
| order_items | ✓ | - | - |
| shipments | ✓ | - | - |
| stock_movements | - | - | ✓ |
| suppliers | - | - | ✓ |
| supplier_products | - | - | ✓ |
| purchase_orders | - | - | ✓ |
| purchase_order_items | - | - | ✓ |
| purchase_invoices | - | - | ✓ |

**Total Changes:**
- 1 column added to existing table
- 6 new tables created
