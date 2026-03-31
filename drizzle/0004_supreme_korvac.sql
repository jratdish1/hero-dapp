ALTER TABLE `media_posts` MODIFY COLUMN `category` enum('instructional','photos','memories','memes','announcements','nfts') NOT NULL;--> statement-breakpoint
ALTER TABLE `media_posts` MODIFY COLUMN `mediaType` enum('image','video','nft') NOT NULL;--> statement-breakpoint
ALTER TABLE `media_posts` ADD `nftContractAddress` varchar(42);--> statement-breakpoint
ALTER TABLE `media_posts` ADD `nftTokenId` varchar(100);--> statement-breakpoint
ALTER TABLE `media_posts` ADD `nftChainId` int;--> statement-breakpoint
ALTER TABLE `media_posts` ADD `nftCollectionName` varchar(200);