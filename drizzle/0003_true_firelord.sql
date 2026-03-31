CREATE TABLE `media_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`authorName` varchar(200),
	`category` enum('instructional','photos','memories','memes','announcements') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`mediaType` enum('image','video') NOT NULL,
	`mediaUrl` text NOT NULL,
	`mediaKey` text NOT NULL,
	`thumbnailUrl` text,
	`fileSizeMb` decimal(10,2),
	`status` enum('active','flagged','removed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_posts_id` PRIMARY KEY(`id`)
);
