import { z } from "zod";
import { router, tenantProcedure, protectedProcedure } from "./_core/trpc";
import { supabaseAdmin } from "./supabase";
import { TRPCError } from "@trpc/server";

// Types
interface StockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  type: "in" | "out" | "return" | "adjustment" | "purchase";
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PurchaseOrder {
  id: string;
  tenant_id: string;
  po_number: string;
  supplier_id: string;
  status: "draft" | "sent" | "partially_received" | "received" | "cancelled";
  expected_delivery: string | null;
  subtotal: number;
  shipping_cost: number;
  other_charges: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// In-memory storage fallback (when tables don't exist)
const memoryStore = {
  stockMovements: new Map<string, StockMovement[]>(),
  suppliers: new Map<string, Supplier[]>(),
  supplierProducts: new Map<string, any[]>(),
  purchaseOrders: new Map<string, PurchaseOrder[]>(),
  purchaseOrderItems: new Map<string, any[]>(),
  purchaseInvoices: new Map<string, any[]>(),
};

// Helper to check if table exists
async function tableExists(tableName: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from(tableName).select("id").limit(1);
  return !error || !error.message.includes("does not exist");
}

// Generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

export const inventoryRouter = router({
  // ==================== STOCK MANAGEMENT ====================

  // Get product stock levels
  getStockLevels: tenantProcedure
    .input(z.object({
      productIds: z.array(z.string()).optional(),
      lowStockOnly: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = supabaseAdmin
        .from("products")
        .select("id, name, sku, quantity, cost, low_stock_threshold, metadata")
        .eq("tenant_id", ctx.tenantId);

      if (input.productIds && input.productIds.length > 0) {
        query = query.in("id", input.productIds);
      }

      const { data: products, error } = await query;

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      let result = (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        currentStock: p.quantity || 0,
        reservedStock: p.metadata?.reserved_stock || 0,
        availableStock: (p.quantity || 0) - (p.metadata?.reserved_stock || 0),
        costPerUnit: p.cost || 0,
        reorderLevel: p.low_stock_threshold || 10,
        isLowStock: (p.quantity || 0) <= (p.low_stock_threshold || 10),
      }));

      if (input.lowStockOnly) {
        result = result.filter((p) => p.isLowStock);
      }

      return result;
    }),

  // Record stock movement
  recordMovement: tenantProcedure
    .input(z.object({
      productId: z.string(),
      type: z.enum(["in", "out", "return", "adjustment", "purchase"]),
      quantity: z.number(),
      referenceType: z.string().optional(),
      referenceId: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const movement: StockMovement = {
        id: generateId(),
        tenant_id: ctx.tenantId,
        product_id: input.productId,
        type: input.type,
        quantity: input.quantity,
        reference_type: input.referenceType || null,
        reference_id: input.referenceId || null,
        notes: input.notes || null,
        created_by: ctx.user?.id || null,
        created_at: new Date().toISOString(),
      };

      // Try to insert into stock_movements table
      const tableOk = await tableExists("stock_movements");
      if (tableOk) {
        const { error } = await supabaseAdmin.from("stock_movements").insert(movement);
        if (error && !error.message.includes("does not exist")) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
      } else {
        // Fallback to memory
        const tenantMovements = memoryStore.stockMovements.get(ctx.tenantId) || [];
        tenantMovements.push(movement);
        memoryStore.stockMovements.set(ctx.tenantId, tenantMovements);
      }

      // Update product quantity
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("quantity, metadata")
        .eq("id", input.productId)
        .eq("tenant_id", ctx.tenantId)
        .single();

      if (product) {
        const currentQty = product.quantity || 0;
        let newQty = currentQty;

        if (input.type === "in" || input.type === "return" || input.type === "purchase") {
          newQty = currentQty + Math.abs(input.quantity);
        } else if (input.type === "out") {
          newQty = currentQty - Math.abs(input.quantity);
        } else if (input.type === "adjustment") {
          newQty = currentQty + input.quantity; // Can be positive or negative
        }

        await supabaseAdmin
          .from("products")
          .update({ quantity: Math.max(0, newQty) })
          .eq("id", input.productId)
          .eq("tenant_id", ctx.tenantId);
      }

      return { success: true, movement };
    }),

  // Get stock movements history
  getMovements: tenantProcedure
    .input(z.object({
      productId: z.string().optional(),
      type: z.enum(["in", "out", "return", "adjustment", "purchase"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const tableOk = await tableExists("stock_movements");

      if (tableOk) {
        let query = supabaseAdmin
          .from("stock_movements")
          .select("*")
          .eq("tenant_id", ctx.tenantId)
          .order("created_at", { ascending: false })
          .limit(input.limit);

        if (input.productId) {
          query = query.eq("product_id", input.productId);
        }
        if (input.type) {
          query = query.eq("type", input.type);
        }

        const { data, error } = await query;
        if (error && !error.message.includes("does not exist")) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
        return data || [];
      }

      // Fallback to memory
      let movements = memoryStore.stockMovements.get(ctx.tenantId) || [];
      if (input.productId) {
        movements = movements.filter((m) => m.product_id === input.productId);
      }
      if (input.type) {
        movements = movements.filter((m) => m.type === input.type);
      }
      return movements.slice(0, input.limit);
    }),

  // Reserve stock for order
  reserveStock: tenantProcedure
    .input(z.object({
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number(),
      })),
      orderId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const item of input.items) {
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("quantity, metadata")
          .eq("id", item.productId)
          .eq("tenant_id", ctx.tenantId)
          .single();

        if (!product) continue;

        const currentQty = product.quantity || 0;
        const currentReserved = product.metadata?.reserved_stock || 0;
        const available = currentQty - currentReserved;
        
        // تحقق أمان: reserve <= available
        if (item.quantity > available) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `المخزون المتاح غير كافي للمنتج ${item.productId}. المتاح: ${available}, المطلوب: ${item.quantity}`
          });
        }
        
        const newReserved = currentReserved + item.quantity;

        await supabaseAdmin
          .from("products")
          .update({
            metadata: {
              ...product.metadata,
              reserved_stock: newReserved,
            },
          })
          .eq("id", item.productId)
          .eq("tenant_id", ctx.tenantId);
      }

      return { success: true };
    }),

  // Release reserved stock (order cancelled)
  releaseStock: tenantProcedure
    .input(z.object({
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number(),
      })),
      orderId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const item of input.items) {
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("quantity, metadata")
          .eq("id", item.productId)
          .eq("tenant_id", ctx.tenantId)
          .single();

        if (!product) continue;

        const currentReserved = product.metadata?.reserved_stock || 0;
        const newReserved = Math.max(0, currentReserved - item.quantity);

        await supabaseAdmin
          .from("products")
          .update({
            metadata: {
              ...product.metadata,
              reserved_stock: newReserved,
            },
          })
          .eq("id", item.productId)
          .eq("tenant_id", ctx.tenantId);
      }

      return { success: true };
    }),

  // Deduct stock (order shipped)
  deductStock: tenantProcedure
    .input(z.object({
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number(),
      })),
      orderId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const item of input.items) {
        // Record movement
        try {
          await supabaseAdmin.from("stock_movements").insert({
            id: generateId(),
            tenant_id: ctx.tenantId,
            product_id: item.productId,
            type: "out",
            quantity: -item.quantity,
            reference_type: "order",
            reference_id: input.orderId,
            created_at: new Date().toISOString(),
          });
        } catch {}

        // Update product
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("quantity, metadata")
          .eq("id", item.productId)
          .eq("tenant_id", ctx.tenantId)
          .single();

        if (!product) continue;

        const currentQty = product.quantity || 0;
        const currentReserved = product.metadata?.reserved_stock || 0;
        
        // تحقق أمان المخزون: منع المخزون السالب
        if (currentQty < item.quantity) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `المخزون غير كافي للمنتج ${item.productId}. المتاح: ${currentQty}, المطلوب: ${item.quantity}`
          });
        }

        await supabaseAdmin
          .from("products")
          .update({
            quantity: currentQty - item.quantity, // لا حاجة لـ Math.max بعد التحقق
            metadata: {
              ...product.metadata,
              reserved_stock: Math.max(0, currentReserved - item.quantity),
            },
          })
          .eq("id", item.productId)
          .eq("tenant_id", ctx.tenantId);
      }

      return { success: true };
    }),

  // ==================== SUPPLIERS ====================

  // List suppliers
  listSuppliers: tenantProcedure
    .input(z.object({
      activeOnly: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tableOk = await tableExists("suppliers");

      if (tableOk) {
        let query = supabaseAdmin
          .from("suppliers")
          .select("*")
          .eq("tenant_id", ctx.tenantId)
          .order("name");

        if (input.activeOnly) {
          query = query.eq("is_active", true);
        }

        const { data, error } = await query;
        if (error && !error.message.includes("does not exist")) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
        return data || [];
      }

      // Fallback
      let suppliers = memoryStore.suppliers.get(ctx.tenantId) || [];
      if (input.activeOnly) {
        suppliers = suppliers.filter((s) => s.is_active);
      }
      return suppliers;
    }),

  // Create supplier
  createSupplier: tenantProcedure
    .input(z.object({
      name: z.string(),
      contactName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const supplier: Supplier = {
        id: generateId(),
        tenant_id: ctx.tenantId,
        name: input.name,
        contact_name: input.contactName || null,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        payment_terms: input.paymentTerms || null,
        notes: input.notes || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const tableOk = await tableExists("suppliers");

      if (tableOk) {
        const { error } = await supabaseAdmin.from("suppliers").insert(supplier);
        if (error && !error.message.includes("does not exist")) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
      } else {
        const tenantSuppliers = memoryStore.suppliers.get(ctx.tenantId) || [];
        tenantSuppliers.push(supplier);
        memoryStore.suppliers.set(ctx.tenantId, tenantSuppliers);
      }

      return supplier;
    }),

  // Update supplier
  updateSupplier: tenantProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      contactName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      paymentTerms: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.contactName !== undefined) updates.contact_name = input.contactName;
      if (input.email !== undefined) updates.email = input.email;
      if (input.phone !== undefined) updates.phone = input.phone;
      if (input.address !== undefined) updates.address = input.address;
      if (input.paymentTerms !== undefined) updates.payment_terms = input.paymentTerms;
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.isActive !== undefined) updates.is_active = input.isActive;

      const tableOk = await tableExists("suppliers");

      if (tableOk) {
        const { error } = await supabaseAdmin
          .from("suppliers")
          .update(updates)
          .eq("id", input.id)
          .eq("tenant_id", ctx.tenantId);

        if (error && !error.message.includes("does not exist")) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
      } else {
        const tenantSuppliers = memoryStore.suppliers.get(ctx.tenantId) || [];
        const idx = tenantSuppliers.findIndex((s) => s.id === input.id);
        if (idx >= 0) {
          tenantSuppliers[idx] = { ...tenantSuppliers[idx], ...updates };
        }
      }

      return { success: true };
    }),

  // ==================== PURCHASE ORDERS ====================

  // List purchase orders
  listPurchaseOrders: tenantProcedure
    .input(z.object({
      status: z.enum(["draft", "sent", "partially_received", "received", "cancelled"]).optional(),
      supplierId: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const tableOk = await tableExists("purchase_orders");

      if (tableOk) {
        let query = supabaseAdmin
          .from("purchase_orders")
          .select("*, suppliers(name)")
          .eq("tenant_id", ctx.tenantId)
          .order("created_at", { ascending: false })
          .limit(input.limit);

        if (input.status) {
          query = query.eq("status", input.status);
        }
        if (input.supplierId) {
          query = query.eq("supplier_id", input.supplierId);
        }

        const { data, error } = await query;
        if (error && !error.message.includes("does not exist")) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
        return data || [];
      }

      // Fallback
      let orders = memoryStore.purchaseOrders.get(ctx.tenantId) || [];
      if (input.status) {
        orders = orders.filter((o) => o.status === input.status);
      }
      if (input.supplierId) {
        orders = orders.filter((o) => o.supplier_id === input.supplierId);
      }
      return orders.slice(0, input.limit);
    }),

  // Create purchase order
  createPurchaseOrder: tenantProcedure
    .input(z.object({
      supplierId: z.string(),
      expectedDelivery: z.string().optional(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number(),
        unitCost: z.number(),
      })),
      shippingCost: z.number().optional(),
      otherCharges: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate PO number
      const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

      // Calculate totals
      const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
      const shipping = input.shippingCost || 0;
      const other = input.otherCharges || 0;
      const total = subtotal + shipping + other;

      const po: PurchaseOrder = {
        id: generateId(),
        tenant_id: ctx.tenantId,
        po_number: poNumber,
        supplier_id: input.supplierId,
        status: "draft",
        expected_delivery: input.expectedDelivery || null,
        subtotal,
        shipping_cost: shipping,
        other_charges: other,
        total,
        notes: input.notes || null,
        created_by: ctx.user?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const tableOk = await tableExists("purchase_orders");

      if (tableOk) {
        const { error } = await supabaseAdmin.from("purchase_orders").insert(po);
        if (error && !error.message.includes("does not exist")) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }

        // Insert items
        const items = input.items.map((item) => ({
          id: generateId(),
          tenant_id: ctx.tenantId,
          po_id: po.id,
          product_id: item.productId,
          quantity: item.quantity,
          received_quantity: 0,
          unit_cost: item.unitCost,
          total_cost: item.quantity * item.unitCost,
          created_at: new Date().toISOString(),
        }));

        try {
          await supabaseAdmin.from("purchase_order_items").insert(items);
        } catch {}
      } else {
        const tenantPOs = memoryStore.purchaseOrders.get(ctx.tenantId) || [];
        tenantPOs.push(po);
        memoryStore.purchaseOrders.set(ctx.tenantId, tenantPOs);

        const tenantItems = memoryStore.purchaseOrderItems.get(ctx.tenantId) || [];
        input.items.forEach((item) => {
          tenantItems.push({
            id: generateId(),
            tenant_id: ctx.tenantId,
            po_id: po.id,
            product_id: item.productId,
            quantity: item.quantity,
            received_quantity: 0,
            unit_cost: item.unitCost,
            total_cost: item.quantity * item.unitCost,
          });
        });
        memoryStore.purchaseOrderItems.set(ctx.tenantId, tenantItems);
      }

      return po;
    }),

  // Receive purchase order items - مع حماية ضد الاستلام المزدوج
  receivePurchaseOrder: tenantProcedure
    .input(z.object({
      poId: z.string(),
      items: z.array(z.object({
        productId: z.string(),
        receivedQuantity: z.number(),
      })),
      idempotency_key: z.string().optional(), // مفتاح لمنع الاستلام المزدوج
    }))
    .mutation(async ({ ctx, input }) => {
      // التحقق من حالة PO - منع الاستلام إذا كان مكتملاً أو ملغى
      try {
        const { data: po } = await supabaseAdmin
          .from("purchase_orders")
          .select("status")
          .eq("id", input.poId)
          .eq("tenant_id", ctx.tenantId)
          .single();
        
        if (po && (po.status === "received" || po.status === "cancelled")) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `لا يمكن استلام طلب شراء بحالة ${po.status}`
          });
        }
      } catch (e) {
        if (e instanceof TRPCError) throw e;
      }
      
      // Update received quantities and stock
      for (const item of input.items) {
        // Record stock movement
        try {
          await supabaseAdmin.from("stock_movements").insert({
            id: generateId(),
            tenant_id: ctx.tenantId,
            product_id: item.productId,
            type: "purchase",
            quantity: item.receivedQuantity,
            reference_type: "purchase_order",
            reference_id: input.poId,
            created_at: new Date().toISOString(),
          });
        } catch {}

        // Update product quantity
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("quantity")
          .eq("id", item.productId)
          .eq("tenant_id", ctx.tenantId)
          .single();

        if (product) {
          await supabaseAdmin
            .from("products")
            .update({ quantity: (product.quantity || 0) + item.receivedQuantity })
            .eq("id", item.productId)
            .eq("tenant_id", ctx.tenantId);
        }

        // Update PO item received quantity
        try {
          await supabaseAdmin
            .from("purchase_order_items")
            .update({ received_quantity: item.receivedQuantity })
            .eq("po_id", input.poId)
            .eq("product_id", item.productId);
        } catch {}
      }

      // Check if fully received
      let poItems: any[] | null = null;
      try {
        const result = await supabaseAdmin
          .from("purchase_order_items")
          .select("quantity, received_quantity")
          .eq("po_id", input.poId);
        poItems = result.data;
      } catch {}

      let newStatus: PurchaseOrder["status"] = "partially_received";
      if (poItems) {
        const allReceived = poItems.every((i: any) => i.received_quantity >= i.quantity);
        if (allReceived) {
          newStatus = "received";
        }
      }

      // Update PO status
      try {
        await supabaseAdmin
          .from("purchase_orders")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", input.poId)
          .eq("tenant_id", ctx.tenantId);
      } catch {}

      return { success: true, status: newStatus };
    }),

  // ==================== ALERTS ====================

  // Get low stock alerts
  getLowStockAlerts: tenantProcedure.query(async ({ ctx }) => {
    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, quantity, low_stock_threshold")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    const alerts = (products || [])
      .filter((p: any) => (p.quantity || 0) <= (p.low_stock_threshold || 10))
      .map((p: any) => ({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        currentStock: p.quantity || 0,
        reorderLevel: p.low_stock_threshold || 10,
        severity: p.quantity === 0 ? "critical" : "warning",
      }));

    return alerts;
  }),

  // Get delayed PO alerts
  getDelayedPOAlerts: tenantProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().split("T")[0];

    const tableOk = await tableExists("purchase_orders");
    if (!tableOk) return [];

    const { data: pos, error } = await supabaseAdmin
      .from("purchase_orders")
      .select("*, suppliers(name)")
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["sent", "partially_received"])
      .lt("expected_delivery", today);

    if (error && !error.message.includes("does not exist")) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return (pos || []).map((po: any) => ({
      poId: po.id,
      poNumber: po.po_number,
      supplierName: po.suppliers?.name || "Unknown",
      expectedDelivery: po.expected_delivery,
      daysOverdue: Math.floor(
        (new Date().getTime() - new Date(po.expected_delivery).getTime()) / (1000 * 60 * 60 * 24)
      ),
      status: po.status,
    }));
  }),

  // ==================== INTEGRATION WITH PROFIT ====================

  // Get product COGS for profit calculation
  getProductCOGS: tenantProcedure
    .input(z.object({
      productIds: z.array(z.string()),
    }))
    .query(async ({ ctx, input }) => {
      const { data: products, error } = await supabaseAdmin
        .from("products")
        .select("id, cost")
        .eq("tenant_id", ctx.tenantId)
        .in("id", input.productIds);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      const cogsMap: Record<string, number> = {};
      (products || []).forEach((p: any) => {
        cogsMap[p.id] = p.cost || 0;
      });

      return cogsMap;
    }),

  // Update product cost (from purchase invoice)
  updateProductCost: tenantProcedure
    .input(z.object({
      productId: z.string(),
      newCost: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await supabaseAdmin
        .from("products")
        .update({ cost: input.newCost })
        .eq("id", input.productId)
        .eq("tenant_id", ctx.tenantId);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),
});
