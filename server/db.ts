import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  tenants,
  products,
  orders,
  orderItems,
  campaigns,
  landingPages,
  aiConversations,
  inventoryLogs,
  type InsertTenant,
  type InsertProduct,
  type InsertOrder,
  type InsertOrderItem,
  type InsertCampaign,
  type InsertLandingPage,
  type InsertAIConversation,
  type InsertInventoryLog,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== Users ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.tenantId !== undefined) {
      values.tenantId = user.tenantId;
      updateSet.tenantId = user.tenantId;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "owner";
      updateSet.role = "owner";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserTenant(userId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ tenantId }).where(eq(users.id, userId));
}

// ==================== Tenants ====================

export async function createTenant(tenant: InsertTenant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(tenants).values(tenant);
  return Number(result[0].insertId);
}

export async function getTenantById(tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTenantByDomain(domain: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(tenants).where(eq(tenants.domain, domain)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTenant(tenantId: number, data: Partial<InsertTenant>) {
  const db = await getDb();
  if (!db) return;

  await db.update(tenants).set(data).where(eq(tenants.id, tenantId));
}

// ==================== Products ====================

export async function getProductsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(products).where(eq(products.tenantId, tenantId)).orderBy(desc(products.createdAt));
}

export async function getProductById(productId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(product: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(products).values(product);
  return Number(result[0].insertId);
}

export async function updateProduct(productId: number, tenantId: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) return;

  await db.update(products).set(data).where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));
}

export async function deleteProduct(productId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(products).where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));
}

// ==================== Orders ====================

export async function getOrdersByTenant(tenantId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(orders).where(eq(orders.tenantId, tenantId)).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function getOrderById(orderId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderWithItems(orderId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const order = await getOrderById(orderId, tenantId);
  if (!order) return undefined;

  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.tenantId, tenantId)));

  return { ...order, items };
}

export async function createOrder(order: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(orders).values(order);
  return Number(result[0].insertId);
}

export async function createOrderItem(item: InsertOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(orderItems).values(item);
  return Number(result[0].insertId);
}

export async function updateOrder(orderId: number, tenantId: number, data: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) return;

  await db.update(orders).set(data).where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
}

export async function getOrdersByCampaign(campaignId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(orders)
    .where(and(eq(orders.campaignId, campaignId), eq(orders.tenantId, tenantId)));
}

// ==================== Campaigns ====================

export async function getCampaignsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId)).orderBy(desc(campaigns.createdAt));
}

export async function getCampaignById(campaignId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCampaign(campaign: InsertCampaign) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(campaigns).values(campaign);
  return Number(result[0].insertId);
}

export async function updateCampaign(campaignId: number, tenantId: number, data: Partial<InsertCampaign>) {
  const db = await getDb();
  if (!db) return;

  await db.update(campaigns).set(data).where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)));
}

export async function deleteCampaign(campaignId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)));
}

// ==================== Landing Pages ====================

export async function getLandingPagesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(landingPages).where(eq(landingPages.tenantId, tenantId)).orderBy(desc(landingPages.createdAt));
}

export async function getLandingPageById(pageId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(landingPages)
    .where(and(eq(landingPages.id, pageId), eq(landingPages.tenantId, tenantId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLandingPage(page: InsertLandingPage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(landingPages).values(page);
  return Number(result[0].insertId);
}

export async function updateLandingPage(pageId: number, tenantId: number, data: Partial<InsertLandingPage>) {
  const db = await getDb();
  if (!db) return;

  await db.update(landingPages).set(data).where(and(eq(landingPages.id, pageId), eq(landingPages.tenantId, tenantId)));
}

export async function deleteLandingPage(pageId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return;

  await db.delete(landingPages).where(and(eq(landingPages.id, pageId), eq(landingPages.tenantId, tenantId)));
}

// ==================== AI Conversations ====================

export async function getConversationsByTenant(tenantId: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];

  const conditions = userId
    ? and(eq(aiConversations.tenantId, tenantId), eq(aiConversations.userId, userId))
    : eq(aiConversations.tenantId, tenantId);

  return db.select().from(aiConversations).where(conditions).orderBy(desc(aiConversations.updatedAt));
}

export async function getConversationById(conversationId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.tenantId, tenantId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createConversation(conversation: InsertAIConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(aiConversations).values(conversation);
  return Number(result[0].insertId);
}

export async function updateConversation(conversationId: number, tenantId: number, data: Partial<InsertAIConversation>) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(aiConversations)
    .set(data)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.tenantId, tenantId)));
}

// ==================== Inventory Logs ====================

export async function getInventoryLogsByProduct(productId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(inventoryLogs)
    .where(and(eq(inventoryLogs.productId, productId), eq(inventoryLogs.tenantId, tenantId)))
    .orderBy(desc(inventoryLogs.createdAt));
}

export async function createInventoryLog(log: InsertInventoryLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(inventoryLogs).values(log);
  return Number(result[0].insertId);
}

// ==================== Analytics & Stats ====================

export async function getTenantStats(tenantId: number) {
  const db = await getDb();
  if (!db) return null;

  const [productsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.tenantId, tenantId));

  const [ordersCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.tenantId, tenantId));

  const [campaignsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaigns)
    .where(eq(campaigns.tenantId, tenantId));

  const [totalRevenue] = await db
    .select({ total: sql<number>`sum(${orders.totalAmount})` })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.status, "delivered")));

  return {
    productsCount: productsCount?.count || 0,
    ordersCount: ordersCount?.count || 0,
    campaignsCount: campaignsCount?.count || 0,
    totalRevenue: totalRevenue?.total || 0,
  };
}
