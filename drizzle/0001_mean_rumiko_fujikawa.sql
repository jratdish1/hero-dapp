CREATE TABLE `dca_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`tokenInAddress` varchar(42) NOT NULL,
	`tokenInSymbol` varchar(20) NOT NULL,
	`tokenOutAddress` varchar(42) NOT NULL,
	`tokenOutSymbol` varchar(20) NOT NULL,
	`amountPerInterval` decimal(36,18) NOT NULL,
	`intervalSeconds` int NOT NULL,
	`totalIntervals` int NOT NULL,
	`completedIntervals` int NOT NULL DEFAULT 0,
	`status` enum('active','paused','completed','cancelled') NOT NULL DEFAULT 'active',
	`nextExecutionAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dca_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `limit_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`tokenInAddress` varchar(42) NOT NULL,
	`tokenInSymbol` varchar(20) NOT NULL,
	`tokenOutAddress` varchar(42) NOT NULL,
	`tokenOutSymbol` varchar(20) NOT NULL,
	`amountIn` decimal(36,18) NOT NULL,
	`targetPrice` decimal(36,18) NOT NULL,
	`orderType` enum('buy','sell') NOT NULL,
	`status` enum('pending','filled','cancelled','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp,
	`filledAt` timestamp,
	`txHash` varchar(66),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `limit_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swap_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`walletAddress` varchar(42) NOT NULL,
	`tokenInAddress` varchar(42) NOT NULL,
	`tokenInSymbol` varchar(20) NOT NULL,
	`tokenOutAddress` varchar(42) NOT NULL,
	`tokenOutSymbol` varchar(20) NOT NULL,
	`amountIn` decimal(36,18) NOT NULL,
	`amountOut` decimal(36,18) NOT NULL,
	`dexSource` varchar(50),
	`txHash` varchar(66),
	`gasUsed` decimal(36,18),
	`gasless` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `swap_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenAddress` varchar(42) NOT NULL,
	`tokenSymbol` varchar(20) NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `walletAddress` varchar(42);