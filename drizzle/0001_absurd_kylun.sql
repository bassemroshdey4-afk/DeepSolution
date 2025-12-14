CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`messages` json NOT NULL,
	`context` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`platform` enum('facebook','google','tiktok','snapchat','instagram','other') NOT NULL,
	`budget` int NOT NULL,
	`spent` int NOT NULL DEFAULT 0,
	`revenue` int NOT NULL DEFAULT 0,
	`roas` int NOT NULL DEFAULT 0,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`status` enum('active','paused','completed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`productId` int NOT NULL,
	`type` enum('in','out','adjustment') NOT NULL,
	`quantity` int NOT NULL,
	`reason` varchar(255),
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landing_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`productId` int,
	`title` varchar(255) NOT NULL,
	`content` json NOT NULL,
	`imageUrls` json,
	`aiPrompt` text,
	`slug` varchar(255),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`views` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landing_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`price` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`orderNumber` varchar(50) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(50) NOT NULL,
	`customerAddress` text,
	`totalAmount` int NOT NULL,
	`status` enum('new','confirmed','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'new',
	`callCenterStatus` enum('pending','contacted','callback','no_answer','confirmed') NOT NULL DEFAULT 'pending',
	`shippingStatus` enum('pending','in_transit','delivered','returned') NOT NULL DEFAULT 'pending',
	`campaignId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` int NOT NULL,
	`cost` int,
	`sku` varchar(100),
	`barcode` varchar(100),
	`imageUrl` text,
	`stock` int NOT NULL DEFAULT 0,
	`status` enum('active','draft','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`domain` varchar(100) NOT NULL,
	`plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
	`status` enum('active','suspended','trial') NOT NULL DEFAULT 'trial',
	`settings` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('owner','admin','agent','viewer') NOT NULL DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE `users` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD CONSTRAINT `landing_pages_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD CONSTRAINT `landing_pages_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_ai_conversations_tenant` ON `ai_conversations` (`tenantId`);--> statement-breakpoint
CREATE INDEX `idx_ai_conversations_user` ON `ai_conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_campaigns_tenant` ON `campaigns` (`tenantId`);--> statement-breakpoint
CREATE INDEX `idx_campaigns_tenant_status` ON `campaigns` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_inventory_logs_tenant` ON `inventory_logs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `idx_inventory_logs_product` ON `inventory_logs` (`productId`);--> statement-breakpoint
CREATE INDEX `idx_landing_pages_tenant` ON `landing_pages` (`tenantId`);--> statement-breakpoint
CREATE INDEX `idx_landing_pages_slug` ON `landing_pages` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_order_items_tenant` ON `order_items` (`tenantId`);--> statement-breakpoint
CREATE INDEX `idx_order_items_order` ON `order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `idx_orders_tenant` ON `orders` (`tenantId`);--> statement-breakpoint
CREATE INDEX `idx_orders_tenant_status` ON `orders` (`tenantId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_orders_number` ON `orders` (`orderNumber`);--> statement-breakpoint
CREATE INDEX `idx_products_tenant` ON `products` (`tenantId`);--> statement-breakpoint
CREATE INDEX `idx_products_tenant_status` ON `products` (`tenantId`,`status`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_tenantId_tenants_id_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_users_tenant` ON `users` (`tenantId`);