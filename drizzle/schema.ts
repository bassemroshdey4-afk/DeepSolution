import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, index, boolean } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * جدول المستأجرين (Tenants)
 * كل مستأجر يمثل شركة/متجر مستقل مع بياناته المعزولة
 */
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 100 }).notNull().unique(), // نطاق فرعي فريد
  plan: mysqlEnum("plan", ["free", "pro", "enterprise"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "suspended", "trial"]).default("trial").notNull(),
  settings: json("settings").$type<{
    currency?: string;
    timezone?: string;
    language?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * جدول المستخدمين
 * مرتبط بمستأجر واحد مع أدوار مختلفة
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  tenantId: int("tenantId").references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["owner", "admin", "agent", "viewer"]).default("viewer").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_users_tenant").on(table.tenantId),
}));

/**
 * جدول المنتجات
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: int("price").notNull(), // السعر بالقروش/فلس (cents)
  cost: int("cost"), // التكلفة بالقروش/فلس
  sku: varchar("sku", { length: 100 }),
  barcode: varchar("barcode", { length: 100 }),
  imageUrl: text("imageUrl"),
  stock: int("stock").default(0).notNull(),
  status: mysqlEnum("status", ["active", "draft", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_products_tenant").on(table.tenantId),
  tenantStatusIdx: index("idx_products_tenant_status").on(table.tenantId, table.status),
}));

/**
 * جدول الطلبات
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 50 }).notNull(),
  customerAddress: text("customerAddress"),
  totalAmount: int("totalAmount").notNull(), // المبلغ الإجمالي بالقروش/فلس
  status: mysqlEnum("status", ["new", "confirmed", "processing", "shipped", "delivered", "cancelled"]).default("new").notNull(),
  callCenterStatus: mysqlEnum("callCenterStatus", ["pending", "contacted", "callback", "no_answer", "confirmed"]).default("pending").notNull(),
  shippingStatus: mysqlEnum("shippingStatus", ["pending", "in_transit", "delivered", "returned"]).default("pending").notNull(),
  campaignId: int("campaignId").references(() => campaigns.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_orders_tenant").on(table.tenantId),
  tenantStatusIdx: index("idx_orders_tenant_status").on(table.tenantId, table.status),
  orderNumberIdx: index("idx_orders_number").on(table.orderNumber),
}));

/**
 * جدول عناصر الطلبات
 */
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  quantity: int("quantity").notNull(),
  price: int("price").notNull(), // السعر وقت الطلب بالقروش/فلس
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_order_items_tenant").on(table.tenantId),
  orderIdx: index("idx_order_items_order").on(table.orderId),
}));

/**
 * جدول الحملات التسويقية
 */
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  platform: mysqlEnum("platform", ["facebook", "google", "tiktok", "snapchat", "instagram", "other"]).notNull(),
  budget: int("budget").notNull(), // الميزانية بالقروش/فلس
  spent: int("spent").default(0).notNull(), // المصروف الفعلي بالقروش/فلس
  revenue: int("revenue").default(0).notNull(), // الإيرادات بالقروش/فلس
  roas: int("roas").default(0).notNull(), // ROAS كنسبة مئوية (مثلاً 250 = 250%)
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  status: mysqlEnum("status", ["active", "paused", "completed"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_campaigns_tenant").on(table.tenantId),
  tenantStatusIdx: index("idx_campaigns_tenant_status").on(table.tenantId, table.status),
}));

/**
 * جدول صفحات الهبوط المولدة بالذكاء الاصطناعي
 */
export const landingPages = mysqlTable("landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => products.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: json("content").$type<{
    headline?: string;
    description?: string;
    features?: string[];
    cta?: string;
    sections?: Array<{ type: string; content: string }>;
  }>().notNull(),
  imageUrls: json("imageUrls").$type<string[]>(),
  aiPrompt: text("aiPrompt"), // الوصف المستخدم للتوليد
  slug: varchar("slug", { length: 255 }),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  views: int("views").default(0).notNull(),
  conversions: int("conversions").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_landing_pages_tenant").on(table.tenantId),
  slugIdx: index("idx_landing_pages_slug").on(table.slug),
}));

/**
 * جدول محادثات المساعد الذكي
 */
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  messages: json("messages").$type<Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
  }>>().notNull(),
  context: json("context").$type<{
    lastOrdersCount?: number;
    topProducts?: number[];
    activeCampaigns?: number[];
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_ai_conversations_tenant").on(table.tenantId),
  userIdx: index("idx_ai_conversations_user").on(table.userId),
}));

/**
 * جدول المخزون (تتبع حركة المخزون)
 */
export const inventoryLogs = mysqlTable("inventory_logs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", ["in", "out", "adjustment"]).notNull(),
  quantity: int("quantity").notNull(),
  reason: varchar("reason", { length: 255 }),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_inventory_logs_tenant").on(table.tenantId),
  productIdx: index("idx_inventory_logs_product").on(table.productId),
}));

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  products: many(products),
  orders: many(orders),
  campaigns: many(campaigns),
  landingPages: many(landingPages),
  aiConversations: many(aiConversations),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  aiConversations: many(aiConversations),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  orderItems: many(orderItems),
  inventoryLogs: many(inventoryLogs),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  campaign: one(campaigns, {
    fields: [orders.campaignId],
    references: [campaigns.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [orderItems.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [campaigns.tenantId],
    references: [tenants.id],
  }),
  orders: many(orders),
}));

export const landingPagesRelations = relations(landingPages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [landingPages.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [landingPages.productId],
    references: [products.id],
  }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiConversations.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
}));

export const inventoryLogsRelations = relations(inventoryLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [inventoryLogs.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [inventoryLogs.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [inventoryLogs.userId],
    references: [users.id],
  }),
}));

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = typeof landingPages.$inferInsert;

export type AIConversation = typeof aiConversations.$inferSelect;
export type InsertAIConversation = typeof aiConversations.$inferInsert;

export type InventoryLog = typeof inventoryLogs.$inferSelect;
export type InsertInventoryLog = typeof inventoryLogs.$inferInsert;
