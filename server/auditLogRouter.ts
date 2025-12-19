import { z } from "zod";
import { router, tenantProcedure, adminProcedure } from "./_core/trpc";
import { supabaseAdmin as supabase } from "./supabase";

/**
 * Audit Log Router
 * 
 * Provides read-only access to audit logs for:
 * - Wallet transactions
 * - Order changes
 * - Inventory movements
 * - AI usage
 * 
 * Tenant users see only their data.
 * Super Admin sees all data across tenants.
 */

// Types
interface AuditLogEntry {
  id: string;
  type: 'wallet' | 'order' | 'inventory' | 'ai_usage' | 'profit';
  action: string;
  entity_id: string;
  entity_type: string;
  details: Record<string, unknown>;
  user_id?: string;
  user_name?: string;
  tenant_id: string;
  tenant_name?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// In-memory fallback for audit logs
const auditLogsStore: Map<string, AuditLogEntry[]> = new Map();

// Helper to get tenant audit logs
async function getTenantAuditLogs(
  tenantId: string,
  filters: {
    type?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const logs: AuditLogEntry[] = [];
  
  // 1. Wallet transactions
  if (!filters.type || filters.type === 'wallet') {
    try {
      let query = supabase
        .from('wallet_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      
      const { data: transactions } = await query.limit(100);
      
      if (transactions) {
        for (const tx of transactions) {
          logs.push({
            id: `wallet-${tx.id}`,
            type: 'wallet',
            action: tx.type,
            entity_id: tx.id,
            entity_type: 'wallet_transaction',
            details: {
              amount: tx.amount,
              balance_before: tx.balance_before,
              balance_after: tx.balance_after,
              description: tx.description,
              reference: tx.reference,
            },
            tenant_id: tenantId,
            created_at: tx.created_at,
            metadata: tx.metadata,
          });
        }
      }
    } catch (e) {
      // Fallback to memory
    }
  }
  
  // 2. Order changes (from orders table)
  if (!filters.type || filters.type === 'order') {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false });
      
      if (filters.startDate) {
        query = query.gte('updated_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('updated_at', filters.endDate);
      }
      
      const { data: orders } = await query.limit(100);
      
      if (orders) {
        for (const order of orders) {
          logs.push({
            id: `order-${order.id}`,
            type: 'order',
            action: order.status,
            entity_id: order.id,
            entity_type: 'order',
            details: {
              order_number: order.order_number,
              status: order.status,
              total: order.total,
              customer_name: order.customer_name,
            },
            tenant_id: tenantId,
            created_at: order.updated_at || order.created_at,
          });
        }
      }
    } catch (e) {
      // Fallback to memory
    }
  }
  
  // 3. Inventory movements (from stock_movements table)
  if (!filters.type || filters.type === 'inventory') {
    try {
      // Get stock_movements
      let query = supabase
        .from('stock_movements')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      
      const { data: movements } = await query.limit(100);
      
      if (movements) {
        for (const movement of movements) {
          logs.push({
            id: `inventory-${movement.id}`,
            type: 'inventory',
            action: movement.type,
            entity_id: movement.id,
            entity_type: 'stock_movement',
            details: {
              product_id: movement.product_id,
              quantity: movement.quantity,
              type: movement.type,
              reference_type: movement.reference_type,
              reference_id: movement.reference_id,
              notes: movement.notes,
            },
            tenant_id: tenantId,
            created_at: movement.created_at,
          });
        }
      }
    } catch (e) {
      // Fallback to products if stock_movements doesn't exist
      try {
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('updated_at', { ascending: false })
          .limit(100);
        
        if (products) {
          for (const product of products) {
            logs.push({
              id: `inventory-${product.id}`,
              type: 'inventory',
              action: 'stock_update',
              entity_id: product.id,
              entity_type: 'product',
              details: {
                name: product.name,
                sku: product.sku,
                quantity: product.quantity,
              },
              tenant_id: tenantId,
              created_at: product.updated_at || product.created_at,
            });
          }
        }
      } catch (e2) {
        // Ignore
      }
    }
  }
  
  // 4. AI usage logs
  if (!filters.type || filters.type === 'ai_usage') {
    try {
      let query = supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      
      const { data: usageLogs } = await query.limit(100);
      
      if (usageLogs) {
        for (const log of usageLogs) {
          logs.push({
            id: `ai-${log.id}`,
            type: 'ai_usage',
            action: log.action || 'usage',
            entity_id: log.id,
            entity_type: 'ai_usage',
            details: {
              addon_id: log.addon_id,
              tokens_used: log.tokens_used,
              cost: log.cost,
            },
            tenant_id: tenantId,
            created_at: log.created_at,
            metadata: log.metadata,
          });
        }
      }
    } catch (e) {
      // Fallback to memory
    }
  }
  
  // 5. Profit P&L logs (from order_pnl table)
  if (!filters.type || filters.type === 'profit') {
    try {
      let query = supabase
        .from('order_pnl')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('computed_at', { ascending: false });
      
      if (filters.startDate) {
        query = query.gte('computed_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('computed_at', filters.endDate);
      }
      
      const { data: pnlLogs } = await query.limit(100);
      
      if (pnlLogs) {
        for (const pnl of pnlLogs) {
          logs.push({
            id: `profit-${pnl.order_id}`,
            type: 'profit',
            action: pnl.status,
            entity_id: pnl.order_id,
            entity_type: 'order_pnl',
            details: {
              revenue: pnl.revenue,
              total_cost: pnl.total_cost,
              net_profit: pnl.net_profit,
              margin: pnl.margin,
              status: pnl.status,
              loss_reasons: pnl.loss_reasons,
            },
            tenant_id: tenantId,
            created_at: pnl.computed_at || pnl.created_at,
          });
        }
      }
    } catch (e) {
      // Fallback to memory
    }
  }
  
  // Sort by created_at descending
  logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  // Apply pagination
  const total = logs.length;
  const offset = filters.offset || 0;
  const limit = filters.limit || 50;
  const paginatedLogs = logs.slice(offset, offset + limit);
  
  return { logs: paginatedLogs, total };
}

export const auditLogRouter = router({
  // Get audit logs for current tenant
  getLogs: tenantProcedure
    .input(z.object({
      type: z.enum(['wallet', 'order', 'inventory', 'ai_usage', 'profit']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const filters = input || { limit: 50, offset: 0 };
      const result = await getTenantAuditLogs(ctx.tenantId, filters);
      
      return {
        logs: result.logs,
        total: result.total,
        limit: filters.limit ?? 50,
        offset: filters.offset ?? 0,
      };
    }),
  
  // Get summary stats for audit logs
  getSummary: tenantProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const filters = input || {};
      
      // Get counts by type
      const walletResult = await getTenantAuditLogs(ctx.tenantId, { ...filters, type: 'wallet' });
      const orderResult = await getTenantAuditLogs(ctx.tenantId, { ...filters, type: 'order' });
      const inventoryResult = await getTenantAuditLogs(ctx.tenantId, { ...filters, type: 'inventory' });
      const aiResult = await getTenantAuditLogs(ctx.tenantId, { ...filters, type: 'ai_usage' });
      const profitResult = await getTenantAuditLogs(ctx.tenantId, { ...filters, type: 'profit' });
      
      return {
        wallet: walletResult.total,
        order: orderResult.total,
        inventory: inventoryResult.total,
        ai_usage: aiResult.total,
        profit: profitResult.total,
        total: walletResult.total + orderResult.total + inventoryResult.total + aiResult.total + profitResult.total,
      };
    }),
  
  // Super Admin: Get all audit logs across tenants
  adminGetAllLogs: adminProcedure
    .input(z.object({
      tenantId: z.string().optional(),
      type: z.enum(['wallet', 'order', 'inventory', 'ai_usage', 'profit']).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }: { input?: { tenantId?: string; type?: 'wallet' | 'order' | 'inventory' | 'ai_usage' | 'profit'; startDate?: string; endDate?: string; limit?: number; offset?: number } }) => {
      const filters = input || {} as {
        tenantId?: string;
        type?: 'wallet' | 'order' | 'inventory' | 'ai_usage' | 'profit';
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
      };
      
      if (filters.tenantId) {
        // Get logs for specific tenant
        const result = await getTenantAuditLogs(filters.tenantId, filters);
        return {
          logs: result.logs,
          total: result.total,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
        };
      }
      
      // Get all tenants and aggregate logs
      const allLogs: AuditLogEntry[] = [];
      
      try {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, name')
          .limit(100);
        
        if (tenants) {
          for (const tenant of tenants) {
            const result = await getTenantAuditLogs(tenant.id, { ...filters, limit: 20 });
            for (const log of result.logs) {
              log.tenant_name = tenant.name;
            }
            allLogs.push(...result.logs);
          }
        }
      } catch (e) {
        // Return empty if error
      }
      
      // Sort and paginate
      allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      const paginatedLogs = allLogs.slice(offset, offset + limit);
      
      return {
        logs: paginatedLogs,
        total: allLogs.length,
        limit,
        offset,
      };
    }),
  
  // Super Admin: Get platform-wide summary
  adminGetSummary: adminProcedure
    .query(async () => {
      let walletTotal = 0;
      let orderTotal = 0;
      let inventoryTotal = 0;
      let aiTotal = 0;
      let profitTotal = 0;
      let tenantCount = 0;
      
      try {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id')
          .limit(100);
        
        if (tenants) {
          tenantCount = tenants.length;
          
          for (const tenant of tenants) {
            const walletResult = await getTenantAuditLogs(tenant.id, { type: 'wallet', limit: 1000 });
            const orderResult = await getTenantAuditLogs(tenant.id, { type: 'order', limit: 1000 });
            const inventoryResult = await getTenantAuditLogs(tenant.id, { type: 'inventory', limit: 1000 });
            const aiResult = await getTenantAuditLogs(tenant.id, { type: 'ai_usage', limit: 1000 });
            const profitResult = await getTenantAuditLogs(tenant.id, { type: 'profit', limit: 1000 });
            
            walletTotal += walletResult.total;
            orderTotal += orderResult.total;
            inventoryTotal += inventoryResult.total;
            aiTotal += aiResult.total;
            profitTotal += profitResult.total;
          }
        }
      } catch (e) {
        // Return zeros if error
      }
      
      return {
        tenantCount,
        wallet: walletTotal,
        order: orderTotal,
        inventory: inventoryTotal,
        ai_usage: aiTotal,
        profit: profitTotal,
        total: walletTotal + orderTotal + inventoryTotal + aiTotal + profitTotal,
      };
    }),
});

export type AuditLogRouter = typeof auditLogRouter;
