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

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;
export type MvsContent = typeof mvsContent.$inferSelect;
export type InsertMvsContent = typeof mvsContent.$inferInsert;
