CREATE TABLE `blog_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`slug` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`excerpt` varchar(1000),
	`coverImageUrl` text,
	`tweetId` varchar(100),
	`tweetAuthor` varchar(100),
	`tweetUrl` text,
	`tags` text,
	`heroMentioned` boolean DEFAULT false,
	`vetsMentioned` boolean DEFAULT false,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `mvs_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tweetId` varchar(100) NOT NULL,
	`tweetUrl` text NOT NULL,
	`author` varchar(100) NOT NULL,
	`authorHandle` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`weekLabel` varchar(50),
	`farmYields` text,
	`heroPrice` decimal(36,18),
	`vetsPrice` decimal(36,18),
	`mediaUrls` text,
	`blogPostId` int,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mvs_content_id` PRIMARY KEY(`id`),
	CONSTRAINT `mvs_content_tweetId_unique` UNIQUE(`tweetId`)
);
