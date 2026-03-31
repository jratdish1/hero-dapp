import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  walletAddress: varchar("walletAddress", { length: 42 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const dcaOrders = mysqlTable("dca_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  walletAddress: varchar("walletAddress", { length: 42 }).notNull(),
  tokenInAddress: varchar("tokenInAddress", { length: 42 }).notNull(),
  tokenInSymbol: varchar("tokenInSymbol", { length: 20 }).notNull(),
  tokenOutAddress: varchar("tokenOutAddress", { length: 42 }).notNull(),
  tokenOutSymbol: varchar("tokenOutSymbol", { length: 20 }).notNull(),
  amountPerInterval: decimal("amountPerInterval", { precision: 36, scale: 18 }).notNull(),
  intervalSeconds: int("intervalSeconds").notNull(),
  totalIntervals: int("totalIntervals").notNull(),
  completedIntervals: int("completedIntervals").default(0).notNull(),
  status: mysqlEnum("status", ["active", "paused", "completed", "cancelled"]).default("active").notNull(),
  nextExecutionAt: timestamp("nextExecutionAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const limitOrders = mysqlTable("limit_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  walletAddress: varchar("walletAddress", { length: 42 }).notNull(),
  tokenInAddress: varchar("tokenInAddress", { length: 42 }).notNull(),
  tokenInSymbol: varchar("tokenInSymbol", { length: 20 }).notNull(),
  tokenOutAddress: varchar("tokenOutAddress", { length: 42 }).notNull(),
  tokenOutSymbol: varchar("tokenOutSymbol", { length: 20 }).notNull(),
  amountIn: decimal("amountIn", { precision: 36, scale: 18 }).notNull(),
  targetPrice: decimal("targetPrice", { precision: 36, scale: 18 }).notNull(),
  orderType: mysqlEnum("orderType", ["buy", "sell"]).notNull(),
  status: mysqlEnum("status", ["pending", "filled", "cancelled", "expired"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt"),
  filledAt: timestamp("filledAt"),
  txHash: varchar("txHash", { length: 66 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const swapHistory = mysqlTable("swap_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  walletAddress: varchar("walletAddress", { length: 42 }).notNull(),
  tokenInAddress: varchar("tokenInAddress", { length: 42 }).notNull(),
  tokenInSymbol: varchar("tokenInSymbol", { length: 20 }).notNull(),
  tokenOutAddress: varchar("tokenOutAddress", { length: 42 }).notNull(),
  tokenOutSymbol: varchar("tokenOutSymbol", { length: 20 }).notNull(),
  amountIn: decimal("amountIn", { precision: 36, scale: 18 }).notNull(),
  amountOut: decimal("amountOut", { precision: 36, scale: 18 }).notNull(),
  dexSource: varchar("dexSource", { length: 50 }),
  txHash: varchar("txHash", { length: 66 }),
  gasUsed: decimal("gasUsed", { precision: 36, scale: 18 }),
  gasless: boolean("gasless").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenAddress: varchar("tokenAddress", { length: 42 }).notNull(),
  tokenSymbol: varchar("tokenSymbol", { length: 20 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type DcaOrder = typeof dcaOrders.$inferSelect;
export type InsertDcaOrder = typeof dcaOrders.$inferInsert;
export type LimitOrder = typeof limitOrders.$inferSelect;
export type InsertLimitOrder = typeof limitOrders.$inferInsert;
export type SwapHistoryEntry = typeof swapHistory.$inferSelect;
export type InsertSwapHistory = typeof swapHistory.$inferInsert;
export type WatchlistEntry = typeof watchlist.$inferSelect;
export type InsertWatchlist = typeof watchlist.$inferInsert;

export const blogPosts = mysqlTable("blog_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  content: text("content").notNull(),
  excerpt: varchar("excerpt", { length: 1000 }),
  coverImageUrl: text("coverImageUrl"),
  tweetId: varchar("tweetId", { length: 100 }),
  tweetAuthor: varchar("tweetAuthor", { length: 100 }),
  tweetUrl: text("tweetUrl"),
  tags: text("tags"),
  heroMentioned: boolean("heroMentioned").default(false),
  vetsMentioned: boolean("vetsMentioned").default(false),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const mvsContent = mysqlTable("mvs_content", {
  id: int("id").autoincrement().primaryKey(),
  tweetId: varchar("tweetId", { length: 100 }).notNull().unique(),
  tweetUrl: text("tweetUrl").notNull(),
  author: varchar("author", { length: 100 }).notNull(),
  authorHandle: varchar("authorHandle", { length: 100 }).notNull(),
  content: text("content").notNull(),
  weekLabel: varchar("weekLabel", { length: 50 }),
  farmYields: text("farmYields"),
  heroPrice: decimal("heroPrice", { precision: 36, scale: 18 }),
  vetsPrice: decimal("vetsPrice", { precision: 36, scale: 18 }),
  mediaUrls: text("mediaUrls"),
  blogPostId: int("blogPostId"),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const mediaPosts = mysqlTable("media_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  walletAddress: varchar("walletAddress", { length: 42 }).notNull(),
  authorName: varchar("authorName", { length: 200 }),
  category: mysqlEnum("category", ["instructional", "photos", "memories", "memes", "announcements", "nfts"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  mediaType: mysqlEnum("mediaType", ["image", "video", "nft"]).notNull(),
  mediaUrl: text("mediaUrl").notNull(),
  mediaKey: text("mediaKey").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  fileSizeMb: decimal("fileSizeMb", { precision: 10, scale: 2 }),
  nftContractAddress: varchar("nftContractAddress", { length: 42 }),
  nftTokenId: varchar("nftTokenId", { length: 100 }),
  nftChainId: int("nftChainId"),
  nftCollectionName: varchar("nftCollectionName", { length: 200 }),
  status: mysqlEnum("status", ["active", "flagged", "removed"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;
export type MvsContent = typeof mvsContent.$inferSelect;
export type InsertMvsContent = typeof mvsContent.$inferInsert;
export type MediaPost = typeof mediaPosts.$inferSelect;
export type InsertMediaPost = typeof mediaPosts.$inferInsert;

// ─── DAO Governance Tables ──────────────────────────────────────

export const proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: varchar("proposalId", { length: 16 }).notNull().unique(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description").notNull(),
  proposerId: int("proposerId").notNull(),
  proposerAddress: varchar("proposerAddress", { length: 42 }).notNull(),
  status: mysqlEnum("status", ["pending", "active", "passed", "defeated", "queued", "executed", "cancelled"]).default("pending").notNull(),
  chain: mysqlEnum("chain", ["base", "pulsechain", "both"]).default("both").notNull(),
  category: mysqlEnum("category", ["protocol", "treasury", "community", "emergency"]).default("protocol").notNull(),
  votesFor: bigint("votesFor", { mode: "number" }).default(0).notNull(),
  votesAgainst: bigint("votesAgainst", { mode: "number" }).default(0).notNull(),
  votesAbstain: bigint("votesAbstain", { mode: "number" }).default(0).notNull(),
  quorum: bigint("quorum", { mode: "number" }).default(5000000).notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  executionTxHash: varchar("executionTxHash", { length: 66 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const votes = mysqlTable("votes", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId").notNull(),
  voterId: int("voterId").notNull(),
  voterAddress: varchar("voterAddress", { length: 42 }).notNull(),
  choice: mysqlEnum("choice", ["for", "against", "abstain"]).notNull(),
  votingPower: bigint("votingPower", { mode: "number" }).notNull(),
  chain: mysqlEnum("chain", ["base", "pulsechain"]).notNull(),
  txHash: varchar("txHash", { length: 66 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const delegates = mysqlTable("delegates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  address: varchar("address", { length: 42 }).notNull(),
  displayName: varchar("displayName", { length: 128 }),
  statement: text("statement"),
  votingPower: bigint("votingPower", { mode: "number" }).default(0).notNull(),
  delegatorCount: int("delegatorCount").default(0).notNull(),
  proposalsVoted: int("proposalsVoted").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const delegations = mysqlTable("delegations", {
  id: int("id").autoincrement().primaryKey(),
  delegatorId: int("delegatorId").notNull(),
  delegatorAddress: varchar("delegatorAddress", { length: 42 }).notNull(),
  delegateId: int("delegateId").notNull(),
  delegateAddress: varchar("delegateAddress", { length: 42 }).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  chain: mysqlEnum("chain", ["base", "pulsechain"]).notNull(),
  txHash: varchar("txHash", { length: 66 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const treasurySnapshots = mysqlTable("treasury_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  chain: mysqlEnum("chain", ["base", "pulsechain"]).notNull(),
  tokenSymbol: varchar("tokenSymbol", { length: 16 }).notNull(),
  tokenAddress: varchar("tokenAddress", { length: 42 }).notNull(),
  balance: varchar("balance", { length: 78 }).notNull(),
  valueUsd: varchar("valueUsd", { length: 32 }),
  snapshotAt: timestamp("snapshotAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chainDataCache = mysqlTable("chain_data_cache", {
  id: int("id").autoincrement().primaryKey(),
  chain: mysqlEnum("chain", ["base", "pulsechain"]).notNull(),
  dataKey: varchar("dataKey", { length: 128 }).notNull(),
  dataValue: text("dataValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;
export type Delegate = typeof delegates.$inferSelect;
export type InsertDelegate = typeof delegates.$inferInsert;
export type Delegation = typeof delegations.$inferSelect;
export type InsertDelegation = typeof delegations.$inferInsert;
export type TreasurySnapshot = typeof treasurySnapshots.$inferSelect;
export type InsertTreasurySnapshot = typeof treasurySnapshots.$inferInsert;
export type ChainDataCache = typeof chainDataCache.$inferSelect;
export type InsertChainDataCache = typeof chainDataCache.$inferInsert;
