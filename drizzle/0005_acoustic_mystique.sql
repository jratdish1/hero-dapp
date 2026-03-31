CREATE TABLE `chain_data_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chain` enum('base','pulsechain') NOT NULL,
	`dataKey` varchar(128) NOT NULL,
	`dataValue` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chain_data_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delegates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`address` varchar(42) NOT NULL,
	`displayName` varchar(128),
	`statement` text,
	`votingPower` bigint NOT NULL DEFAULT 0,
	`delegatorCount` int NOT NULL DEFAULT 0,
	`proposalsVoted` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delegates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delegations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`delegatorId` int NOT NULL,
	`delegatorAddress` varchar(42) NOT NULL,
	`delegateId` int NOT NULL,
	`delegateAddress` varchar(42) NOT NULL,
	`amount` bigint NOT NULL,
	`chain` enum('base','pulsechain') NOT NULL,
	`txHash` varchar(66),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delegations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` varchar(16) NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text NOT NULL,
	`proposerId` int NOT NULL,
	`proposerAddress` varchar(42) NOT NULL,
	`status` enum('pending','active','passed','defeated','queued','executed','cancelled') NOT NULL DEFAULT 'pending',
	`chain` enum('base','pulsechain','both') NOT NULL DEFAULT 'both',
	`category` enum('protocol','treasury','community','emergency') NOT NULL DEFAULT 'protocol',
	`votesFor` bigint NOT NULL DEFAULT 0,
	`votesAgainst` bigint NOT NULL DEFAULT 0,
	`votesAbstain` bigint NOT NULL DEFAULT 0,
	`quorum` bigint NOT NULL DEFAULT 5000000,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`executionTxHash` varchar(66),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposals_id` PRIMARY KEY(`id`),
	CONSTRAINT `proposals_proposalId_unique` UNIQUE(`proposalId`)
);
--> statement-breakpoint
CREATE TABLE `treasury_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chain` enum('base','pulsechain') NOT NULL,
	`tokenSymbol` varchar(16) NOT NULL,
	`tokenAddress` varchar(42) NOT NULL,
	`balance` varchar(78) NOT NULL,
	`valueUsd` varchar(32),
	`snapshotAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `treasury_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`voterId` int NOT NULL,
	`voterAddress` varchar(42) NOT NULL,
	`choice` enum('for','against','abstain') NOT NULL,
	`votingPower` bigint NOT NULL,
	`chain` enum('base','pulsechain') NOT NULL,
	`txHash` varchar(66),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `votes_id` PRIMARY KEY(`id`)
);
