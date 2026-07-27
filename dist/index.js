var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/dao-logger.ts
function shouldLog(level) {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}
function formatEntry(entry) {
  return JSON.stringify(entry);
}
function log(level, module, message, data) {
  if (!shouldLog(level)) return;
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    module,
    message,
    ...data && { data }
  };
  const formatted = formatEntry(entry);
  switch (level) {
    case "error":
    case "fatal":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}
function createDaoLogger(module) {
  return {
    debug: (msg, data) => log("debug", module, msg, data),
    info: (msg, data) => log("info", module, msg, data),
    warn: (msg, data) => log("warn", module, msg, data),
    error: (msg, data) => log("error", module, msg, data),
    fatal: (msg, data) => log("fatal", module, msg, data)
  };
}
var LOG_LEVELS, MIN_LEVEL;
var init_dao_logger = __esm({
  "server/dao-logger.ts"() {
    "use strict";
    LOG_LEVELS = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };
    MIN_LEVEL = process.env.DAO_LOG_LEVEL || "info";
  }
});

// server/dao-rate-limiter.ts
var dao_rate_limiter_exports = {};
__export(dao_rate_limiter_exports, {
  atomicRateLimitAndRecord: () => atomicRateLimitAndRecord,
  getTimelockForProposal: () => getTimelockForProposal,
  initRateLimiter: () => initRateLimiter,
  isProposalRateLimited: () => isProposalRateLimited,
  logDaoAction: () => logDaoAction,
  markTimelockExecuted: () => markTimelockExecuted,
  recordProposalCreation: () => recordProposalCreation,
  saveTimelock: () => saveTimelock
});
import { z as z2 } from "zod";
import { sql as sql3 } from "drizzle-orm";
function initRateLimiter(dbGetter) {
  if (typeof dbGetter !== "function") {
    throw new Error("initRateLimiter requires a function that returns a DB instance");
  }
  getDb2 = dbGetter;
  logger.info("Rate limiter initialized");
}
async function getDbOrThrow(context) {
  if (!getDb2) {
    throw new Error(`Rate limiter not initialized \u2014 call initRateLimiter() first [${context}]`);
  }
  const db = await getDb2();
  if (!db) {
    logger.error("Database unavailable", { context });
    throw new Error(`Database unavailable \u2014 failing closed [${context}]`);
  }
  return db;
}
async function atomicRateLimitAndRecord(userId, proposalId, walletAddress, maxPerDay = 3) {
  idSchema.parse(userId);
  proposalIdSchema.parse(proposalId);
  addressSchema.parse(walletAddress);
  const db = await getDbOrThrow("atomicRateLimitAndRecord");
  try {
    const countResult = await db.execute(
      sql3`SELECT COUNT(*) as count FROM proposal_audit_log
          WHERE actorId = ${userId}
          AND action = 'proposal_created'
          AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          FOR UPDATE`
    );
    const count = Number(countResult[0]?.[0]?.count || countResult[0]?.count || 0);
    if (count >= maxPerDay) {
      logger.warn("Rate limit exceeded", { userId, count, maxPerDay });
      return { allowed: false, count };
    }
    await db.execute(
      sql3`INSERT INTO proposal_audit_log (proposalId, action, actorId, actorAddress, metadata, createdAt)
          VALUES (${proposalId}, 'proposal_created', ${userId}, ${walletAddress}, '{}', NOW())`
    );
    logger.info("Proposal recorded atomically", { userId, proposalId, count: count + 1, maxPerDay });
    return { allowed: true, count: count + 1 };
  } catch (err) {
    logger.error("Atomic rate limit check failed", { error: err?.message, userId, proposalId });
    throw err;
  }
}
async function isProposalRateLimited(userId, maxPerDay = 3) {
  idSchema.parse(userId);
  const db = await getDbOrThrow("isProposalRateLimited");
  try {
    const result = await db.execute(
      sql3`SELECT COUNT(*) as count FROM proposal_audit_log
          WHERE actorId = ${userId}
          AND action = 'proposal_created'
          AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    const count = Number(result[0]?.[0]?.count || result[0]?.count || 0);
    return count >= maxPerDay;
  } catch (err) {
    logger.error("Rate limit check failed \u2014 failing closed", { error: err?.message, userId });
    throw err;
  }
}
async function recordProposalCreation(proposalId, userId, walletAddress) {
  proposalIdSchema.parse(proposalId);
  idSchema.parse(userId);
  addressSchema.parse(walletAddress);
  const db = await getDbOrThrow("recordProposalCreation");
  try {
    await db.execute(
      sql3`INSERT INTO proposal_audit_log (proposalId, action, actorId, actorAddress, metadata, createdAt)
          VALUES (${proposalId}, 'proposal_created', ${userId}, ${walletAddress}, '{}', NOW())`
    );
    logger.info("Proposal creation recorded", { proposalId, userId });
  } catch (err) {
    logger.error("Record proposal creation failed", { error: err?.message, proposalId, userId });
    throw err;
  }
}
async function logDaoAction(proposalId, action, actorId, metadata = {}) {
  proposalIdSchema.parse(proposalId);
  actionSchema.parse(action);
  idSchema.parse(actorId);
  const db = await getDbOrThrow("logDaoAction");
  const serializedMetadata = JSON.stringify(metadata || {});
  try {
    await db.execute(
      sql3`INSERT INTO proposal_audit_log (proposalId, action, actorId, metadata, createdAt)
          VALUES (${proposalId}, ${action}, ${actorId}, ${serializedMetadata}, NOW())`
    );
    logger.info("DAO action logged", { proposalId, action, actorId });
  } catch (err) {
    logger.error("Audit log write failed", { error: err?.message, proposalId, action });
    throw err;
  }
}
async function getTimelockForProposal(proposalId) {
  proposalIdSchema.parse(proposalId);
  const db = await getDbOrThrow("getTimelockForProposal");
  try {
    const result = await db.execute(
      sql3`SELECT * FROM proposal_timelocks WHERE proposalId = ${proposalId} LIMIT 1`
    );
    const row = result[0]?.[0] || result[0];
    if (!row || !row.proposalId) return null;
    return {
      proposalId: row.proposalId,
      finalizedAt: new Date(row.finalizedAt).getTime(),
      executionUnlocksAt: new Date(row.executionUnlocksAt).getTime(),
      executed: Boolean(row.executed),
      executedAt: row.executedAt ? new Date(row.executedAt).getTime() : void 0
    };
  } catch (err) {
    logger.error("Timelock read failed", { error: err?.message, proposalId });
    throw err;
  }
}
async function saveTimelock(proposalId, finalizedAt, executionUnlocksAt) {
  proposalIdSchema.parse(proposalId);
  const db = await getDbOrThrow("saveTimelock");
  try {
    await db.execute(
      sql3`INSERT INTO proposal_timelocks (proposalId, finalizedAt, executionUnlocksAt, createdAt)
          VALUES (${proposalId}, ${finalizedAt}, ${executionUnlocksAt}, NOW())
          ON DUPLICATE KEY UPDATE finalizedAt = ${finalizedAt}, executionUnlocksAt = ${executionUnlocksAt}`
    );
    logger.info("Timelock saved", { proposalId });
  } catch (err) {
    logger.error("Timelock save failed", { error: err?.message, proposalId });
    throw err;
  }
}
async function markTimelockExecuted(proposalId, txHash) {
  proposalIdSchema.parse(proposalId);
  if (txHash) txHashSchema.parse(txHash);
  const db = await getDbOrThrow("markTimelockExecuted");
  try {
    await db.execute(
      sql3`UPDATE proposal_timelocks
          SET executed = TRUE, executedAt = NOW(), executionTxHash = ${txHash || null}
          WHERE proposalId = ${proposalId}`
    );
    logger.info("Timelock marked executed", { proposalId, txHash: txHash || "none" });
  } catch (err) {
    logger.error("Timelock mark executed failed", { error: err?.message, proposalId });
    throw err;
  }
}
var logger, idSchema, addressSchema, proposalIdSchema, actionSchema, txHashSchema, getDb2;
var init_dao_rate_limiter = __esm({
  "server/dao-rate-limiter.ts"() {
    "use strict";
    init_dao_logger();
    logger = createDaoLogger("dao-rate-limiter");
    idSchema = z2.number().int().positive({ message: "ID must be a positive integer" });
    addressSchema = z2.string().regex(
      /^0x[a-fA-F0-9]{40}$/,
      "Invalid address format: must be 0x-prefixed 40 hex characters"
    );
    proposalIdSchema = z2.string().min(1, "Proposal ID cannot be empty").max(255);
    actionSchema = z2.enum([
      "proposal_created",
      "proposal_executed",
      "proposal_vetoed",
      "timelock_started",
      "status_change",
      "vote_cast",
      "quorum_reached",
      "delegation_created",
      "delegation_revoked"
    ]);
    txHashSchema = z2.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid tx hash: must be 0x-prefixed 64 hex characters").optional().nullable();
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import compression from "compression";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var SESSION_MAX_AGE_MS = 1e3 * 60 * 60 * 24 * 30;
var ONE_YEAR_MS = SESSION_MAX_AGE_MS;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint, boolean, uniqueIndex } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  walletAddress: varchar("walletAddress", { length: 42 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var dcaOrders = mysqlTable("dca_orders", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
}, (table) => ({
  // AUDIT FIX 3.4: Index on frequently queried columns
  walletIdx: uniqueIndex("idx_dca_wallet").on(table.userId, table.walletAddress)
}));
var limitOrders = mysqlTable("limit_orders", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var swapHistory = mysqlTable("swap_history", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenAddress: varchar("tokenAddress", { length: 42 }).notNull(),
  tokenSymbol: varchar("tokenSymbol", { length: 20 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull()
});
var blogPosts = mysqlTable("blog_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  content: text("content").notNull(),
  excerpt: varchar("excerpt", { length: 1e3 }),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var mvsContent = mysqlTable("mvs_content", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var mediaPosts = mysqlTable("media_posts", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var proposals = mysqlTable("proposals", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: varchar("proposalId", { length: 40 }).notNull().unique(),
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
  quorum: bigint("quorum", { mode: "number" }).default(5e6).notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  snapshotBlock: bigint("snapshotBlock", { mode: "number" }).notNull(),
  executionTxHash: varchar("executionTxHash", { length: 66 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var votes = mysqlTable("votes", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId").notNull(),
  voterId: int("voterId").notNull(),
  voterAddress: varchar("voterAddress", { length: 42 }).notNull(),
  choice: mysqlEnum("choice", ["for", "against", "abstain"]).notNull(),
  votingPower: bigint("votingPower", { mode: "number" }).notNull(),
  chain: mysqlEnum("chain", ["base", "pulsechain"]).notNull(),
  txHash: varchar("txHash", { length: 66 }),
  createdAt: timestamp("createdAt").defaultNow().notNull()
}, (table) => ({
  // AUDIT FIX 3.2: Unique constraint to prevent double voting at DB level
  uniqueVote: uniqueIndex("idx_unique_vote").on(table.proposalId, table.voterId)
}));
var delegates = mysqlTable("delegates", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var delegations = mysqlTable("delegations", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var treasurySnapshots = mysqlTable("treasury_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  chain: mysqlEnum("chain", ["base", "pulsechain"]).notNull(),
  tokenSymbol: varchar("tokenSymbol", { length: 16 }).notNull(),
  tokenAddress: varchar("tokenAddress", { length: 42 }).notNull(),
  balance: decimal("balance", { precision: 36, scale: 18 }).notNull(),
  valueUsd: decimal("valueUsd", { precision: 32, scale: 8 }),
  snapshotAt: timestamp("snapshotAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var chainDataCache = mysqlTable("chain_data_cache", {
  id: int("id").autoincrement().primaryKey(),
  chain: mysqlEnum("chain", ["base", "pulsechain"]).notNull(),
  dataKey: varchar("dataKey", { length: 128 }).notNull(),
  dataValue: text("dataValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var influencerMentions = mysqlTable("influencer_mentions", {
  id: int("id").autoincrement().primaryKey(),
  tweetId: varchar("tweetId", { length: 30 }).notNull().unique(),
  authorUsername: varchar("authorUsername", { length: 100 }).notNull(),
  authorDisplayName: varchar("authorDisplayName", { length: 200 }),
  authorProfileImageUrl: text("authorProfileImageUrl"),
  authorFollowerCount: int("authorFollowerCount").default(0),
  tweetText: text("tweetText").notNull(),
  tweetUrl: text("tweetUrl").notNull(),
  tweetCreatedAt: timestamp("tweetCreatedAt"),
  retweetCount: int("retweetCount").default(0),
  likeCount: int("likeCount").default(0),
  replyCount: int("replyCount").default(0),
  quoteCount: int("quoteCount").default(0),
  mediaUrls: text("mediaUrls"),
  mentionType: mysqlEnum("mentionType", ["direct_mention", "retweet", "quote", "hero_tweet"]).default("direct_mention").notNull(),
  category: mysqlEnum("category", ["influencer", "community", "press", "partner"]).default("community").notNull(),
  heroMentioned: boolean("heroMentioned").default(false),
  vetsMentioned: boolean("vetsMentioned").default(false),
  sentiment: mysqlEnum("sentiment", ["positive", "neutral", "negative"]).default("neutral"),
  isHighlighted: boolean("isHighlighted").default(false),
  isPinned: boolean("isPinned").default(false),
  isHidden: boolean("isHidden").default(false),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var spinRecords = mysqlTable("spin_records", {
  id: int("id").primaryKey().autoincrement(),
  wallet: varchar("wallet", { length: 42 }).notNull(),
  lastSpinDate: varchar("last_spin_date", { length: 10 }).notNull(),
  currentStreak: int("current_streak").notNull().default(0),
  longestStreak: int("longest_streak").notNull().default(0),
  totalSpins: int("total_spins").notNull().default(0),
  nftTier: mysqlEnum("nft_tier", ["bronze", "silver", "gold"]).default("bronze"),
  totalHeroEarned: decimal("total_hero_earned", { precision: 18, scale: 2 }).default("0"),
  totalBurned: decimal("total_burned", { precision: 18, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  walletIdx: uniqueIndex("wallet_idx").on(table.wallet)
}));
var spinResults = mysqlTable("spin_results", {
  id: int("id").primaryKey().autoincrement(),
  wallet: varchar("wallet", { length: 42 }).notNull(),
  segmentId: varchar("segment_id", { length: 50 }).notNull(),
  segmentLabel: varchar("segment_label", { length: 100 }).notNull(),
  rewardType: varchar("reward_type", { length: 50 }).notNull(),
  rewardValue: varchar("reward_value", { length: 50 }).notNull(),
  streakAtSpin: int("streak_at_spin").notNull().default(0),
  multiplier: decimal("multiplier", { precision: 3, scale: 1 }).default("1.0"),
  finalRewardValue: varchar("final_reward_value", { length: 50 }).notNull(),
  claimed: boolean("claimed").default(false),
  claimTxHash: varchar("claim_tx_hash", { length: 66 }),
  proofHash: varchar("proof_hash", { length: 66 }).notNull(),
  blockHash: varchar("block_hash", { length: 66 }).notNull(),
  blockNumber: int("block_number").notNull(),
  chain: varchar("chain", { length: 20 }).notNull().default("pulsechain"),
  spinTimestamp: timestamp("spin_timestamp").defaultNow().notNull()
});
var spinLeaderboard = mysqlTable("spin_leaderboard", {
  id: int("id").primaryKey().autoincrement(),
  wallet: varchar("wallet", { length: 42 }).notNull(),
  currentStreak: int("current_streak").notNull().default(0),
  longestStreak: int("longest_streak").notNull().default(0),
  totalSpins: int("total_spins").notNull().default(0),
  totalHeroEarned: decimal("total_hero_earned", { precision: 18, scale: 2 }).default("0"),
  biggestWin: varchar("biggest_win", { length: 100 }),
  lastUpdated: timestamp("last_updated").defaultNow().notNull()
}, (table) => ({
  walletIdx: uniqueIndex("lb_wallet_idx").on(table.wallet)
}));

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || ""
};
if (ENV.isProduction) {
  const required = [
    ["JWT_SECRET", ENV.cookieSecret],
    ["DATABASE_URL", ENV.databaseUrl]
  ];
  for (const [name, value] of required) {
    if (!value) {
      throw new Error(`[FATAL] ${name} environment variable is required in production`);
    }
  }
  if (ENV.cookieSecret.length < 32) {
    throw new Error("[FATAL] JWT_SECRET must be at least 32 characters in production");
  }
}

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createDcaOrder(order) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(dcaOrders).values(order);
  return result;
}
async function getDcaOrdersByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dcaOrders).where(eq(dcaOrders.userId, userId)).orderBy(desc(dcaOrders.createdAt));
}
async function updateDcaOrderStatus(orderId, userId, status) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(dcaOrders).set({ status }).where(and(eq(dcaOrders.id, orderId), eq(dcaOrders.userId, userId)));
}
async function createLimitOrder(order) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(limitOrders).values(order);
}
async function getLimitOrdersByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(limitOrders).where(eq(limitOrders.userId, userId)).orderBy(desc(limitOrders.createdAt));
}
async function cancelLimitOrder(orderId, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(limitOrders).set({ status: "cancelled" }).where(and(eq(limitOrders.id, orderId), eq(limitOrders.userId, userId)));
}
async function recordSwap(entry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(swapHistory).values(entry);
}
async function getSwapHistoryByWallet(walletAddress, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(swapHistory).where(eq(swapHistory.walletAddress, walletAddress)).orderBy(desc(swapHistory.createdAt)).limit(limit);
}
async function addToWatchlist(entry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(watchlist).values(entry);
}
async function getWatchlistByUser(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watchlist).where(eq(watchlist.userId, userId));
}
async function removeFromWatchlist(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
}
async function createBlogPost(post) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(blogPosts).values(post);
}
async function getPublishedBlogPosts(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blogPosts).where(eq(blogPosts.status, "published")).orderBy(desc(blogPosts.publishedAt)).limit(limit);
}
async function getBlogPostBySlug(slug) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getAllBlogPosts(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt)).limit(limit);
}
async function updateBlogPost(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(blogPosts).set(data).where(eq(blogPosts.id, id));
}
async function saveMvsContent(entry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(mvsContent).values(entry);
}
async function getMvsContentList(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mvsContent).orderBy(desc(mvsContent.createdAt)).limit(limit);
}
async function getMvsContentByTweetId(tweetId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(mvsContent).where(eq(mvsContent.tweetId, tweetId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createMediaPost(post) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(mediaPosts).values(post);
}
async function getMediaPostsByCategory(category, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaPosts).where(and(eq(mediaPosts.category, category), eq(mediaPosts.status, "active"))).orderBy(desc(mediaPosts.createdAt)).limit(limit);
}
async function getAllMediaPosts(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaPosts).where(eq(mediaPosts.status, "active")).orderBy(desc(mediaPosts.createdAt)).limit(limit);
}
async function getMediaPostsByUser(userId, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaPosts).where(eq(mediaPosts.userId, userId)).orderBy(desc(mediaPosts.createdAt)).limit(limit);
}
async function deleteMediaPost(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mediaPosts).set({ status: "removed" }).where(and(eq(mediaPosts.id, id), eq(mediaPosts.userId, userId)));
}
async function createProposal(proposal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(proposals).values(proposal);
}
async function getProposals(status, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(proposals).where(eq(proposals.status, status)).orderBy(desc(proposals.createdAt)).limit(limit);
  }
  return db.select().from(proposals).orderBy(desc(proposals.createdAt)).limit(limit);
}
async function getProposalById(proposalId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(proposals).where(eq(proposals.proposalId, proposalId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateProposal(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(proposals).set(data).where(eq(proposals.id, id));
}
async function updateProposalVotes(proposalId, votesFor, votesAgainst, votesAbstain) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(proposals).set({ votesFor, votesAgainst, votesAbstain }).where(eq(proposals.proposalId, proposalId));
}
async function castVote(vote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(votes).values(vote);
}
async function getVotesByProposal(proposalId, limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(votes).where(eq(votes.proposalId, proposalId)).orderBy(desc(votes.createdAt)).limit(limit);
}
async function getUserVote(proposalId, voterId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(votes).where(and(eq(votes.proposalId, proposalId), eq(votes.voterId, voterId))).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function registerDelegate(delegate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(delegates).values(delegate);
}
async function getDelegates(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(delegates).where(eq(delegates.isActive, true)).orderBy(desc(delegates.votingPower)).limit(limit);
}
async function getDelegateByAddress(address) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(delegates).where(eq(delegates.address, address)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function updateDelegate(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(delegates).set(data).where(eq(delegates.id, id));
}
async function atomicIncrementDelegateStats(delegateId, amount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(
    sql`UPDATE delegates SET votingPower = votingPower + ${amount}, delegatorCount = delegatorCount + 1 WHERE id = ${delegateId}`
  );
}
async function createDelegation(delegation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(delegations).values(delegation);
}
async function getDelegationsByDelegator(delegatorId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(delegations).where(and(eq(delegations.delegatorId, delegatorId), eq(delegations.isActive, true))).orderBy(desc(delegations.createdAt));
}
async function getDelegationsByDelegate(delegateId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(delegations).where(and(eq(delegations.delegateId, delegateId), eq(delegations.isActive, true))).orderBy(desc(delegations.createdAt));
}
async function revokeDelegation(id, delegatorId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(delegations).set({ isActive: false }).where(and(eq(delegations.id, id), eq(delegations.delegatorId, delegatorId)));
}
async function saveTreasurySnapshot(snapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(treasurySnapshots).values(snapshot);
}
async function getLatestTreasurySnapshots(chain) {
  const db = await getDb();
  if (!db) return [];
  if (chain) {
    return db.select().from(treasurySnapshots).where(eq(treasurySnapshots.chain, chain)).orderBy(desc(treasurySnapshots.snapshotAt)).limit(20);
  }
  return db.select().from(treasurySnapshots).orderBy(desc(treasurySnapshots.snapshotAt)).limit(40);
}
async function upsertInfluencerMention(mention) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(influencerMentions).values(mention).onDuplicateKeyUpdate({
    set: {
      retweetCount: mention.retweetCount,
      likeCount: mention.likeCount,
      replyCount: mention.replyCount,
      quoteCount: mention.quoteCount,
      fetchedAt: /* @__PURE__ */ new Date()
    }
  });
}
async function getInfluencerMentions(opts = {}) {
  const db = await getDb();
  if (!db) return [];
  const { category, limit = 50, offset = 0, includeHidden = false } = opts;
  const conditions = [];
  if (!includeHidden) conditions.push(eq(influencerMentions.isHidden, false));
  if (category) conditions.push(eq(influencerMentions.category, category));
  const query = conditions.length > 0 ? db.select().from(influencerMentions).where(and(...conditions)) : db.select().from(influencerMentions);
  return query.orderBy(desc(influencerMentions.isPinned), desc(influencerMentions.tweetCreatedAt)).limit(limit).offset(offset);
}
async function getInfluencerMentionByTweetId(tweetId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(influencerMentions).where(eq(influencerMentions.tweetId, tweetId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function toggleMentionPinned(id, isPinned) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(influencerMentions).set({ isPinned }).where(eq(influencerMentions.id, id));
}
async function toggleMentionHighlight(id, isHighlighted) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(influencerMentions).set({ isHighlighted }).where(eq(influencerMentions.id, id));
}
async function toggleMentionHidden(id, isHidden) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(influencerMentions).set({ isHidden }).where(eq(influencerMentions.id, id));
}
async function updateMentionCategory(id, category) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(influencerMentions).set({ category }).where(eq(influencerMentions.id, id));
}
async function getInfluencerMentionStats() {
  const db = await getDb();
  if (!db) return { total: 0, influencer: 0, community: 0, press: 0, partner: 0 };
  const all = await db.select().from(influencerMentions).where(eq(influencerMentions.isHidden, false));
  return {
    total: all.length,
    influencer: all.filter((m) => m.category === "influencer").length,
    community: all.filter((m) => m.category === "community").length,
    press: all.filter((m) => m.category === "press").length,
    partner: all.filter((m) => m.category === "partner").length
  };
}
async function updateUserWalletAddress(userId, walletAddress) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ walletAddress: walletAddress.toLowerCase() }).where(eq(users.id, userId));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  const isDev = process.env.NODE_ENV === "development";
  return {
    httpOnly: true,
    path: "/",
    // SameSite=None is required for cross-origin OAuth callback
    // In dev without HTTPS, fall back to Lax to avoid cookie rejection
    sameSite: secure ? "none" : isDev ? "lax" : "none",
    // Always secure in production; in dev, only if HTTPS is available
    secure: secure || !isDev
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      const crypto3 = await import("crypto");
      const newCsrfToken = crypto3.randomBytes(32).toString("hex");
      res.cookie("csrf_token", newCsrfToken, {
        httpOnly: false,
        secure: true,
        sameSite: "strict",
        maxAge: 864e5
      });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/standalone-auth.ts
import crypto from "crypto";
var SESSION_MAX_AGE_MS2 = 24 * 60 * 60 * 1e3;
function safeCompare(candidate, expected) {
  const candidateDigest = crypto.createHash("sha256").update(candidate).digest();
  const expectedDigest = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(candidateDigest, expectedDigest);
}
function rotateCsrfToken(res) {
  res.cookie("csrf_token", crypto.randomBytes(32).toString("hex"), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE_MS2,
    path: "/"
  });
}
function registerStandaloneAuthRoutes(app) {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const password = req.body?.password;
      if (typeof password !== "string" || password.length === 0) {
        res.status(400).json({ error: "Password required" });
        return;
      }
      const adminPassword = process.env.HERO_ADMIN_PASSWORD;
      if (!adminPassword || adminPassword.length < 16) {
        console.error("[Auth] HERO_ADMIN_PASSWORD is missing or does not meet the minimum length");
        res.status(503).json({ error: "Authentication is temporarily unavailable" });
        return;
      }
      if (!safeCompare(password, adminPassword)) {
        res.status(401).json({ error: "Invalid password" });
        return;
      }
      const ownerOpenId = process.env.OWNER_OPEN_ID || "standalone-admin";
      const ownerName = process.env.OWNER_NAME || "VETS";
      await upsertUser({
        openId: ownerOpenId,
        name: ownerName,
        email: null,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(ownerOpenId, {
        name: ownerName,
        expiresInMs: SESSION_MAX_AGE_MS2
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: SESSION_MAX_AGE_MS2
      });
      rotateCsrfToken(res);
      res.json({ success: true, user: { name: ownerName } });
    } catch (error) {
      console.error("[Auth] Login failed:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: "Login failed" });
    }
  });
}

// server/heroCards-holder.ts
import { createPublicClient, http } from "viem";
var HERO_CARDS_ADDRESS_BASE = "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE";
var HERO_CARDS_ADDRESS_PULSE = "0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36";
var HERO_CARDS_NETWORKS = {
  base: {
    name: "base",
    chainId: 8453,
    displayName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://mainnet.base.org",
    contractAddress: HERO_CARDS_ADDRESS_BASE
  },
  pulsechain: {
    name: "pulsechain",
    chainId: 369,
    displayName: "PulseChain",
    nativeCurrency: { name: "Pulse", symbol: "PLS", decimals: 18 },
    rpcUrl: "https://rpc.pulsechain.com",
    contractAddress: HERO_CARDS_ADDRESS_PULSE
  }
};
var HERO_CARDS_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getHolderTier",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "tier", type: "uint8" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "canAccessSpinWheel",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "canSpin", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getFeeDiscount",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "discountBps", type: "uint256" }],
    stateMutability: "view"
  }
];
var RPC_TIMEOUT_MS = 1e4;
var clients = {};
var TIER_MAP = {
  1: "bronze",
  2: "silver",
  3: "gold"
};
function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
function getNetworkConfig(network = "base") {
  return HERO_CARDS_NETWORKS[network] ?? HERO_CARDS_NETWORKS.base;
}
function getClient(network = "base") {
  if (clients[network]) return clients[network];
  const cfg = getNetworkConfig(network);
  const client = createPublicClient({
    chain: {
      id: cfg.chainId,
      name: cfg.displayName,
      nativeCurrency: cfg.nativeCurrency,
      rpcUrls: { default: { http: [cfg.rpcUrl] } }
    },
    transport: http(cfg.rpcUrl)
  });
  clients[network] = client;
  return client;
}
async function withTimeout(promise, timeoutMs = RPC_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("HeroCards RPC timeout")), timeoutMs))
  ]);
}
function failClosedStatus(wallet, network, failOpen = false) {
  return {
    wallet,
    network,
    balance: 0,
    tier: failOpen ? "bronze" : "none",
    canSpin: failOpen,
    feeDiscountBps: 0
  };
}
async function getHeroCardsHolderStatus(wallet, options = {}) {
  const network = options.network ?? "base";
  const failOpen = options.failOpen ?? false;
  if (!wallet || !isAddress(wallet)) {
    throw new Error("Invalid wallet address");
  }
  const cfg = getNetworkConfig(network);
  const client = getClient(network);
  try {
    const [balanceRaw, tierRaw, canSpinRaw, discountRaw] = await Promise.all([
      withTimeout(client.readContract({
        address: cfg.contractAddress,
        abi: HERO_CARDS_ABI,
        functionName: "balanceOf",
        args: [wallet]
      })),
      withTimeout(client.readContract({
        address: cfg.contractAddress,
        abi: HERO_CARDS_ABI,
        functionName: "getHolderTier",
        args: [wallet]
      })),
      withTimeout(client.readContract({
        address: cfg.contractAddress,
        abi: HERO_CARDS_ABI,
        functionName: "canAccessSpinWheel",
        args: [wallet]
      })),
      withTimeout(client.readContract({
        address: cfg.contractAddress,
        abi: HERO_CARDS_ABI,
        functionName: "getFeeDiscount",
        args: [wallet]
      }))
    ]);
    const balance = Number(balanceRaw);
    const numericTier = Number(tierRaw);
    return {
      wallet,
      network,
      balance,
      tier: balance > 0 ? TIER_MAP[numericTier] ?? "bronze" : "none",
      canSpin: Boolean(canSpinRaw) && balance > 0,
      feeDiscountBps: Number(discountRaw)
    };
  } catch {
    return failClosedStatus(wallet, network, failOpen);
  }
}
async function getHeroCardsTier(wallet, options = {}) {
  if (!wallet || !isAddress(wallet)) return "bronze";
  const status = await getHeroCardsHolderStatus(wallet, options);
  return status.tier === "none" ? "bronze" : status.tier;
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
import { sql as sql2 } from "drizzle-orm";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var _dbGetter = null;
function initTrpcRateLimiter(dbGetter) {
  _dbGetter = dbGetter;
}
async function ensureRateLimitTable() {
  if (!_dbGetter) return;
  try {
    const db = await _dbGetter();
    await db.execute(sql2`
      CREATE TABLE IF NOT EXISTS mutation_rate_limits (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        rate_key VARCHAR(128) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_key_time (rate_key, created_at)
      )
    `);
  } catch (err) {
    console.error("[trpc-rate-limiter] Failed to create table:", err?.message);
  }
}
async function persistentRateCheck(key, maxRequests = 10, windowMs = 6e4) {
  if (!_dbGetter) {
    console.warn("[trpc-rate-limiter] DB not available, allowing request (fail-open)");
    return { allowed: true, count: 0 };
  }
  try {
    const db = await _dbGetter();
    const windowSeconds = Math.floor(windowMs / 1e3);
    const countResult = await db.execute(
      sql2`SELECT COUNT(*) as cnt FROM mutation_rate_limits
          WHERE rate_key = ${key}
          AND created_at > DATE_SUB(NOW(), INTERVAL ${sql2.raw(String(windowSeconds))} SECOND)`
    );
    const count = Number(countResult[0]?.[0]?.cnt || countResult[0]?.cnt || 0);
    if (count >= maxRequests) {
      return { allowed: false, count };
    }
    await db.execute(
      sql2`INSERT INTO mutation_rate_limits (rate_key, created_at) VALUES (${key}, NOW())`
    );
    if (Math.random() < 0.01) {
      await db.execute(
        sql2`DELETE FROM mutation_rate_limits WHERE created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
      ).catch(() => {
      });
    }
    return { allowed: true, count: count + 1 };
  } catch (err) {
    console.error("[trpc-rate-limiter] DB error, failing open:", err?.message);
    return { allowed: true, count: 0 };
  }
}
var userMutationRateLimit = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const userId = ctx.user?.id;
  const key = userId ? `user:${userId}` : `ip:${ctx.req?.ip || "unknown"}`;
  const { allowed, count } = await persistentRateCheck(key, 10, 6e4);
  if (!allowed) {
    throw new TRPCError2({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limited: max 10 mutations per minute (current: ${count})`
    });
  }
  return next({ ctx });
});
var rateLimitedMutation = t.procedure.use(requireUser).use(userMutationRateLimit);

// server/_core/systemRouter.ts
var RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
function getReleaseSha() {
  const releaseSha = process.env.HERO_RELEASE_SHA?.trim();
  return releaseSha && RELEASE_SHA_PATTERN.test(releaseSha) ? releaseSha : "unknown";
}
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true,
    version: process.env.npm_package_version || "unknown",
    releaseSha: getReleaseSha(),
    uptime: process.uptime(),
    rpc: getRpcMetrics()
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z3 } from "zod";
import { createPublicClient as createPublicClient3, http as http3, erc20Abi } from "viem";
import { pulsechain as pulsechain2 } from "viem/chains";

// server/storage.ts
function getStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  if (relKey.includes("..") || /[\\/]\.\./.test(relKey)) {
    throw new Error("Invalid storage key: path traversal detected");
  }
  const normalized = relKey.replace(/^\/+/, "");
  if (normalized.startsWith("..") || normalized.includes("/../") || normalized.includes("\\..\\")) {
    throw new Error("Invalid storage key: path traversal detected");
  }
  return normalized;
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => {
  if (ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0) {
    return `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`;
  }
  if (process.env.OPENAI_API_KEY && !process.env.BUILT_IN_FORGE_API_KEY) {
    return "https://api.openai.com/v1/chat/completions";
  }
  return "https://forge.manus.im/v1/chat/completions";
};
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: process.env.OPENAI_API_KEY && !process.env.BUILT_IN_FORGE_API_KEY ? "gpt-4o-mini" : "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = process.env.OPENAI_API_KEY && !process.env.BUILT_IN_FORGE_API_KEY ? 4096 : 32768;
  if (process.env.BUILT_IN_FORGE_API_KEY) {
    payload.thinking = {
      "budget_tokens": 128
    };
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/_core/dataApi.ts
async function callDataApi(apiId, options = {}) {
  if (!ENV.forgeApiUrl) {
    throw new Error("BUILT_IN_FORGE_API_URL is not configured");
  }
  if (!ENV.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("webdevtoken.v1.WebDevService/CallApi", baseUrl).toString();
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify({
      apiId,
      query: options.query,
      body: options.body,
      path_params: options.pathParams,
      multipart_form_data: options.formData
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Data API request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (payload && typeof payload === "object" && "jsonData" in payload) {
    try {
      return JSON.parse(payload.jsonData ?? "{}");
    } catch {
      return payload.jsonData;
    }
  }
  return payload;
}

// server/twitterFetcher.ts
var HERO_TWITTER_USERNAME = "HERO501c3";
var HERO_KEYWORDS = ["$HERO", "HERO501c3", "herobase", "hero token", "hero dex"];
var VETS_KEYWORDS = ["$VETS", "VetsInCrypto", "vets token"];
var INFLUENCER_FOLLOWER_THRESHOLD = 1e3;
function containsAny(text2, keywords) {
  const lower = text2.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}
function classifyCategory(followerCount, username) {
  const pressAccounts = ["coindesk", "cointelegraph", "theblock", "decrypt", "forbes", "bloomberg"];
  if (pressAccounts.some((p) => username.toLowerCase().includes(p))) return "press";
  const partnerAccounts = ["pulsex", "9inch", "libertyswap", "hexcrypto"];
  if (partnerAccounts.some((p) => username.toLowerCase().includes(p))) return "partner";
  return followerCount >= INFLUENCER_FOLLOWER_THRESHOLD ? "influencer" : "community";
}
function parseTwitterDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr);
  } catch {
    return null;
  }
}
function parseTweet(raw) {
  const legacy = raw.legacy;
  if (!legacy) return null;
  const tweetId = legacy.id_str || raw.rest_id || "";
  if (!tweetId) return null;
  const isRetweet = !!legacy.retweeted_status_result?.result;
  const sourceTweet = isRetweet ? legacy.retweeted_status_result.result : raw;
  const sourceLegacy = sourceTweet.legacy || legacy;
  const userResult = sourceTweet.core?.user_results?.result;
  const userLegacy = userResult?.legacy;
  const authorUsername = userLegacy?.screen_name || "unknown";
  const authorDisplayName = userLegacy?.name || authorUsername;
  const authorProfileImageUrl = userLegacy?.profile_image_url_https || "";
  const authorFollowerCount = userLegacy?.followers_count || 0;
  const tweetText = sourceLegacy.full_text || "";
  const tweetUrl = `https://x.com/${authorUsername}/status/${sourceLegacy.id_str || tweetId}`;
  const mediaEntities = sourceLegacy.entities?.media || [];
  const mediaUrls = mediaEntities.map((m) => m.media_url_https).filter(Boolean).join(",");
  let mentionType = "hero_tweet";
  if (isRetweet) {
    mentionType = "retweet";
  } else if (sourceLegacy.in_reply_to_status_id_str) {
    mentionType = "direct_mention";
  } else if (authorUsername.toLowerCase() !== HERO_TWITTER_USERNAME.toLowerCase()) {
    mentionType = "quote";
  }
  const heroMentioned = containsAny(tweetText, HERO_KEYWORDS);
  const vetsMentioned = containsAny(tweetText, VETS_KEYWORDS);
  const category = classifyCategory(authorFollowerCount, authorUsername);
  return {
    tweetId: sourceLegacy.id_str || tweetId,
    authorUsername,
    authorDisplayName,
    authorProfileImageUrl,
    authorFollowerCount,
    tweetText,
    tweetUrl,
    tweetCreatedAt: parseTwitterDate(sourceLegacy.created_at),
    retweetCount: sourceLegacy.retweet_count || 0,
    likeCount: sourceLegacy.favorite_count || 0,
    replyCount: sourceLegacy.reply_count || 0,
    quoteCount: sourceLegacy.quote_count || 0,
    mediaUrls,
    mentionType,
    category,
    heroMentioned,
    vetsMentioned
  };
}
async function getHeroRestId() {
  try {
    const result = await callDataApi("Twitter/get_user_profile_by_username", {
      query: { username: HERO_TWITTER_USERNAME }
    });
    const userData = result?.result?.data?.user?.result;
    return userData?.rest_id || null;
  } catch (err) {
    console.error("[TwitterFetcher] Failed to get HERO rest_id:", err);
    return null;
  }
}
async function fetchHeroTweets(restId, count = 20) {
  try {
    const result = await callDataApi("Twitter/get_user_tweets", {
      query: { user: restId, count: String(count) }
    });
    const tweets = [];
    const instructions = result?.result?.timeline?.instructions || [];
    for (const instruction of instructions) {
      if (instruction.type !== "TimelineAddEntries") continue;
      const entries = instruction.entries || [];
      for (const entry of entries) {
        if (!entry.entryId?.startsWith("tweet-")) continue;
        const tweetResult = entry.content?.itemContent?.tweet_results?.result;
        if (!tweetResult) continue;
        const parsed = parseTweet(tweetResult);
        if (parsed) tweets.push(parsed);
      }
    }
    console.log(`[TwitterFetcher] Fetched ${tweets.length} tweets from @${HERO_TWITTER_USERNAME}`);
    return tweets;
  } catch (err) {
    console.error("[TwitterFetcher] Failed to fetch tweets:", err);
    return [];
  }
}
function toDbRecord(mention) {
  return {
    tweetId: mention.tweetId,
    authorUsername: mention.authorUsername,
    authorDisplayName: mention.authorDisplayName,
    authorProfileImageUrl: mention.authorProfileImageUrl,
    authorFollowerCount: mention.authorFollowerCount,
    tweetText: mention.tweetText,
    tweetUrl: mention.tweetUrl,
    tweetCreatedAt: mention.tweetCreatedAt,
    retweetCount: mention.retweetCount,
    likeCount: mention.likeCount,
    replyCount: mention.replyCount,
    quoteCount: mention.quoteCount,
    mediaUrls: mention.mediaUrls || null,
    mentionType: mention.mentionType,
    category: mention.category,
    heroMentioned: mention.heroMentioned,
    vetsMentioned: mention.vetsMentioned,
    sentiment: "neutral",
    isHighlighted: false,
    isHidden: false
  };
}

// server/telegramBot.ts
var TELEGRAM_API_BASE = "https://api.telegram.org/bot";
var ALERT_FOLLOWER_THRESHOLD = 1e3;
function getTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}
async function sendTelegramMessage(config, text2, parseMode = "HTML") {
  try {
    const url = `${TELEGRAM_API_BASE}${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: text2,
        parse_mode: parseMode,
        disable_web_page_preview: false
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(`[TelegramBot] Failed to send (${response.status}): ${detail}`);
      return false;
    }
    console.log("[TelegramBot] Alert sent successfully");
    return true;
  } catch (err) {
    console.error("[TelegramBot] Error sending message:", err);
    return false;
  }
}
function formatMentionAlert(mention) {
  const followerStr = mention.authorFollowerCount >= 1e3 ? `${(mention.authorFollowerCount / 1e3).toFixed(1)}k` : String(mention.authorFollowerCount);
  const tokens = [
    mention.heroMentioned ? "$HERO" : "",
    mention.vetsMentioned ? "$VETS" : ""
  ].filter(Boolean).join(" & ");
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeName = esc(mention.authorDisplayName);
  const safeUsername = esc(mention.authorUsername);
  const safeText = esc(mention.tweetText).substring(0, 300);
  return [
    `\u{1F9B8} <b>New ${mention.category.toUpperCase()} Mention!</b>`,
    ``,
    `\u{1F464} <b>${safeName}</b> (@${safeUsername})`,
    `\u{1F4CA} ${followerStr} followers`,
    tokens ? `\u{1FA99} Tokens: ${tokens}` : "",
    ``,
    `\u{1F4AC} <i>${safeText}${mention.tweetText.length > 300 ? "..." : ""}</i>`,
    ``,
    `\u{1F517} <a href="${mention.tweetUrl}">View on X</a>`,
    ``,
    `#HERO #VetsInCrypto #PulseChain`
  ].filter(Boolean).join("\n");
}
function shouldAlert(mention) {
  return mention.authorFollowerCount >= ALERT_FOLLOWER_THRESHOLD || mention.category === "press" || mention.category === "partner";
}
async function alertNewMention(mention) {
  const config = getTelegramConfig();
  if (!config) {
    console.log("[TelegramBot] Not configured \u2014 skipping alert");
    return false;
  }
  if (!shouldAlert(mention)) return false;
  const message = formatMentionAlert(mention);
  return sendTelegramMessage(config, message);
}

// server/mentionScheduler.ts
var DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1e3;
var FETCH_COUNT = 40;
var CRYPMVS_USERNAME = "CrypMvs";
var schedulerTimer = null;
var isRunning = false;
var lastRunAt = null;
var lastRunResult = null;
async function getCrypMvsRestId() {
  try {
    const result = await callDataApi("Twitter/get_user_profile_by_username", {
      query: { username: CRYPMVS_USERNAME }
    });
    const userData = result?.result?.data?.user?.result;
    return userData?.rest_id || null;
  } catch (err) {
    console.error("[MentionScheduler] Failed to get @CrypMvs rest_id:", err);
    return null;
  }
}
async function fetchCrypMvsContent() {
  let newCount = 0;
  try {
    const restId = await getCrypMvsRestId();
    if (!restId) {
      console.warn("[MentionScheduler] Could not resolve @CrypMvs rest_id");
      return 0;
    }
    const result = await callDataApi("Twitter/get_user_tweets", {
      query: { user: restId, count: String(20) }
    });
    const instructions = result?.result?.timeline?.instructions || [];
    for (const instruction of instructions) {
      if (instruction.type !== "TimelineAddEntries") continue;
      const entries = instruction.entries || [];
      for (const entry of entries) {
        if (!entry.entryId?.startsWith("tweet-")) continue;
        const tweetResult = entry.content?.itemContent?.tweet_results?.result;
        if (!tweetResult) continue;
        const legacy = tweetResult.legacy;
        if (!legacy) continue;
        const tweetId = legacy.id_str || tweetResult.rest_id || "";
        if (!tweetId) continue;
        const existing = await getMvsContentByTweetId(tweetId);
        if (existing) continue;
        const tweetText = legacy.full_text || "";
        const tweetUrl = `https://x.com/${CRYPMVS_USERNAME}/status/${tweetId}`;
        const createdAt = legacy.created_at ? new Date(legacy.created_at) : /* @__PURE__ */ new Date();
        let weekLabel = "";
        const monsterMatch = tweetText.match(/Monster Thread #(\d+)/i);
        const roundupMatch = tweetText.match(/Roundup.*?(\w+ \d+)/i);
        if (monsterMatch) {
          weekLabel = `PulseChain: Weekly #${monsterMatch[1]}`;
        } else if (roundupMatch) {
          weekLabel = `HERO: Roundup`;
        } else if (tweetText.toLowerCase().includes("hero") || tweetText.toLowerCase().includes("vets")) {
          weekLabel = "$HERO: Update";
        }
        const mediaEntities = legacy.entities?.media || [];
        const mediaUrls = mediaEntities.map((m) => m.media_url_https).filter(Boolean).join(",");
        const heroPrice = tweetText.match(/\$HERO.*?\$([0-9.]+)/)?.[1] || "";
        const vetsPrice = tweetText.match(/\$VETS.*?\$([0-9.]+)/)?.[1] || "";
        await saveMvsContent({
          tweetId,
          tweetUrl,
          author: "CrypMvs",
          authorHandle: "@CrypMvs",
          content: tweetText,
          weekLabel: weekLabel || null,
          farmYields: tweetText.match(/\d+%\s*APR/g)?.join(" | ") || null,
          heroPrice: heroPrice || null,
          vetsPrice: vetsPrice || null,
          mediaUrls: mediaUrls || null
        });
        newCount++;
      }
    }
    console.log(`[MentionScheduler] @CrypMvs: ${newCount} new posts saved to mvs_content`);
  } catch (err) {
    console.error("[MentionScheduler] Error fetching @CrypMvs:", err);
  }
  return newCount;
}
async function runRefreshCycle() {
  if (isRunning) {
    console.log("[MentionScheduler] Skipping \u2014 previous cycle still running");
    return;
  }
  isRunning = true;
  console.log("[MentionScheduler] Starting scheduled refresh...");
  try {
    const restId = await getHeroRestId();
    if (!restId) {
      console.warn("[MentionScheduler] Could not resolve @HERO501c3 \u2014 API rate limit may be hit");
    }
    let newCount = 0;
    let alertsSent = 0;
    if (restId) {
      const tweets = await fetchHeroTweets(restId, FETCH_COUNT);
      for (const tweet of tweets) {
        const existing = await getInfluencerMentionByTweetId(tweet.tweetId);
        const isNew = !existing;
        await upsertInfluencerMention(toDbRecord(tweet));
        if (isNew) {
          newCount++;
          const sent = await alertNewMention(tweet);
          if (sent) alertsSent++;
        }
      }
    }
    const mvsNew = await fetchCrypMvsContent();
    lastRunAt = /* @__PURE__ */ new Date();
    lastRunResult = { fetched: FETCH_COUNT, newCount, alertsSent, mvsNew };
    console.log(
      `[MentionScheduler] Done: ${newCount} new mentions, ${alertsSent} alerts, ${mvsNew} new @CrypMvs posts`
    );
    if (newCount >= 3) {
      await notifyOwner({
        title: `${newCount} New HERO Mentions Detected`,
        content: `Scheduled refresh found ${newCount} new mentions. ${alertsSent} Telegram alerts sent. ${mvsNew} new @CrypMvs posts saved.`
      }).catch(() => {
      });
    }
  } catch (err) {
    console.error("[MentionScheduler] Error during refresh cycle:", err);
  } finally {
    isRunning = false;
  }
}
function startMentionScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (schedulerTimer) {
    console.log("[MentionScheduler] Already running \u2014 stopping first");
    stopMentionScheduler();
  }
  const intervalHours = (intervalMs / (60 * 60 * 1e3)).toFixed(1);
  console.log(`[MentionScheduler] Starting \u2014 will refresh every ${intervalHours} hours (HERO + CrypMvs)`);
  setTimeout(() => {
    runRefreshCycle();
  }, 3e4);
  schedulerTimer = setInterval(runRefreshCycle, intervalMs);
}
function stopMentionScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[MentionScheduler] Stopped");
  }
}
function getSchedulerStatus() {
  return {
    isActive: schedulerTimer !== null,
    isRunning,
    lastRunAt,
    lastRunResult,
    intervalMs: DEFAULT_INTERVAL_MS,
    intervalHours: DEFAULT_INTERVAL_MS / (60 * 60 * 1e3)
  };
}

// server/lib/rng-engine.ts
import { ethers as ethers2 } from "ethers";

// server/lib/vrf-provider.ts
import { ethers } from "ethers";

// server/lib/rng-engine.ts
var PULSECHAIN_RPC = "https://rpc.pulsechain.com";
var BASE_RPC = "https://mainnet.base.org";
var MAX_SAFE_BOUND = Number.MAX_SAFE_INTEGER;
async function getBlockEntropy(chain = "pulsechain") {
  const rpc = chain === "pulsechain" ? PULSECHAIN_RPC : BASE_RPC;
  const provider = new ethers2.JsonRpcProvider(rpc);
  const block = await provider.getBlock("latest");
  if (!block || !block.hash) {
    throw new Error(`Failed to get block from ${chain}`);
  }
  return {
    blockHash: block.hash,
    blockNumber: block.number
  };
}
async function generateRandom(max, salt = "", chain = "pulsechain") {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(`Max must be a positive integer, got: ${max}`);
  }
  if (max > MAX_SAFE_BOUND) {
    throw new Error(`Max exceeds safe integer bounds (${MAX_SAFE_BOUND}). Use BigInt-native methods for larger ranges.`);
  }
  if (typeof salt !== "string") {
    throw new Error(`Salt must be a string, got: ${typeof salt}`);
  }
  const { blockHash, blockNumber } = await getBlockEntropy(chain);
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  const seed = ethers2.solidityPackedKeccak256(
    ["bytes32", "string", "string"],
    [blockHash, salt, timestamp2]
  );
  if (!seed || !/^0x[0-9a-fA-F]+$/.test(seed)) {
    throw new Error(`RNG seed generation failed: invalid hex seed "${seed}"`);
  }
  const seedBigInt = BigInt(seed) & (1n << 256n) - 1n;
  const value = Number(seedBigInt % BigInt(max));
  const proofHash = ethers2.keccak256(
    ethers2.toUtf8Bytes(JSON.stringify({
      blockHash,
      blockNumber,
      salt,
      timestamp: timestamp2,
      max,
      result: value
    }))
  );
  return {
    value,
    seed,
    blockHash,
    blockNumber,
    chain,
    timestamp: timestamp2,
    proofHash,
    tier: "T1_OFFCHAIN"
  };
}
async function selectMultipleWinners(poolSize, winnerCount, baseSalt = "", chain = "pulsechain") {
  if (!Number.isInteger(poolSize) || poolSize <= 0) {
    throw new Error(`Pool size must be a positive integer, got: ${poolSize}`);
  }
  if (!Number.isInteger(winnerCount) || winnerCount <= 0) {
    throw new Error(`Winner count must be a positive integer, got: ${winnerCount}`);
  }
  if (winnerCount > poolSize) {
    throw new Error(`Cannot select ${winnerCount} winners from pool of ${poolSize}`);
  }
  const winners = [];
  const proofs = [];
  const used = /* @__PURE__ */ new Set();
  for (let i = 0; i < winnerCount; i++) {
    let attempts = 0;
    const maxAttempts = poolSize * 3;
    while (attempts < maxAttempts) {
      const salt = `${baseSalt}-round-${i}-attempt-${attempts}`;
      const rng = await generateRandom(poolSize, salt, chain);
      if (!used.has(rng.value)) {
        used.add(rng.value);
        winners.push(rng.value);
        proofs.push(rng);
        break;
      }
      attempts++;
    }
    if (winners.length <= i) {
      throw new Error(`Failed to select winner ${i + 1} after ${maxAttempts} attempts`);
    }
  }
  return { winners, proofs };
}

// server/spin-engine-v2.ts
import { ethers as ethers3 } from "ethers";
var BRONZE_WHEEL = [
  { id: "hero-500", label: "500 HERO", rewardType: "hero_tokens", rewardValue: "500", weight: 30, color: "#22c55e", tier: "all" },
  { id: "hero-1000", label: "1,000 HERO", rewardType: "hero_tokens", rewardValue: "1000", weight: 20, color: "#16a34a", tier: "all" },
  { id: "hero-2500", label: "2,500 HERO", rewardType: "hero_tokens", rewardValue: "2500", weight: 10, color: "#15803d", tier: "all" },
  { id: "nft-wl", label: "NFT Whitelist", rewardType: "nft_whitelist", rewardValue: "1", weight: 5, color: "#8b5cf6", tier: "all" },
  { id: "merch-10", label: "10% Off Merch", rewardType: "merch_discount", rewardValue: "10", weight: 10, color: "#f59e0b", tier: "all" },
  { id: "badge-daily", label: "Daily Badge", rewardType: "badge", rewardValue: "daily", weight: 12, color: "#3b82f6", tier: "all" },
  { id: "nothing", label: "Try Again", rewardType: "nothing", rewardValue: "0", weight: 11, color: "#6b7280", tier: "all" },
  { id: "jackpot", label: "10,000 HERO!", rewardType: "jackpot", rewardValue: "10000", weight: 2, color: "#eab308", tier: "bronze" }
];
var SILVER_WHEEL = [
  { id: "hero-1000", label: "1,000 HERO", rewardType: "hero_tokens", rewardValue: "1000", weight: 28, color: "#22c55e", tier: "all" },
  { id: "hero-2500", label: "2,500 HERO", rewardType: "hero_tokens", rewardValue: "2500", weight: 20, color: "#16a34a", tier: "all" },
  { id: "hero-5000", label: "5,000 HERO", rewardType: "hero_tokens", rewardValue: "5000", weight: 10, color: "#15803d", tier: "silver" },
  { id: "nft-wl", label: "NFT Whitelist", rewardType: "nft_whitelist", rewardValue: "1", weight: 7, color: "#8b5cf6", tier: "all" },
  { id: "merch-25", label: "25% Off Merch", rewardType: "merch_discount", rewardValue: "25", weight: 8, color: "#d97706", tier: "silver" },
  { id: "badge-daily", label: "Silver Badge", rewardType: "badge", rewardValue: "silver", weight: 10, color: "#3b82f6", tier: "all" },
  { id: "nothing", label: "Try Again", rewardType: "nothing", rewardValue: "0", weight: 10, color: "#6b7280", tier: "all" },
  { id: "jackpot", label: "50,000 HERO!", rewardType: "jackpot", rewardValue: "50000", weight: 3, color: "#eab308", tier: "silver" },
  { id: "second", label: "2nd Chance", rewardType: "second_chance", rewardValue: "1", weight: 4, color: "#ec4899", tier: "silver" }
];
var GOLD_WHEEL = [
  { id: "hero-2500", label: "2,500 HERO", rewardType: "hero_tokens", rewardValue: "2500", weight: 25, color: "#22c55e", tier: "all" },
  { id: "hero-5000", label: "5,000 HERO", rewardType: "hero_tokens", rewardValue: "5000", weight: 18, color: "#16a34a", tier: "all" },
  { id: "hero-10000", label: "10,000 HERO", rewardType: "hero_tokens", rewardValue: "10000", weight: 8, color: "#15803d", tier: "gold" },
  { id: "nft-wl", label: "NFT Whitelist", rewardType: "nft_whitelist", rewardValue: "1", weight: 8, color: "#8b5cf6", tier: "all" },
  { id: "merch-50", label: "50% Off Merch", rewardType: "merch_discount", rewardValue: "50", weight: 5, color: "#d97706", tier: "gold" },
  { id: "badge-gold", label: "Gold Badge", rewardType: "badge", rewardValue: "gold", weight: 8, color: "#3b82f6", tier: "all" },
  { id: "nothing", label: "Try Again", rewardType: "nothing", rewardValue: "0", weight: 8, color: "#6b7280", tier: "all" },
  { id: "jackpot", label: "250,000 HERO!", rewardType: "jackpot", rewardValue: "250000", weight: 4, color: "#eab308", tier: "gold" },
  { id: "second", label: "2nd Chance", rewardType: "second_chance", rewardValue: "1", weight: 6, color: "#ec4899", tier: "gold" },
  { id: "nft-free", label: "Free NFT Mint", rewardType: "nft_whitelist", rewardValue: "free", weight: 3, color: "#f43f5e", tier: "gold" },
  { id: "merch-free", label: "Free Merch!", rewardType: "merch_discount", rewardValue: "100", weight: 2, color: "#10b981", tier: "gold" },
  { id: "mega-jack", label: "1M HERO!!!", rewardType: "jackpot", rewardValue: "1000000", weight: 1, color: "#ff0000", tier: "gold" }
];
function getWheelForTier(tier) {
  switch (tier) {
    case "gold":
      return GOLD_WHEEL;
    case "silver":
      return SILVER_WHEEL;
    default:
      return BRONZE_WHEEL;
  }
}
function canSpinTodayV2(record) {
  if (!record) return true;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return record.lastSpinDate !== today;
}
function getStreakBonusV2(streak) {
  if (streak >= 30) return { multiplier: 3, label: "3x \u2014 Monthly Master!" };
  if (streak >= 14) return { multiplier: 2, label: "2x \u2014 Two Week Warrior" };
  if (streak >= 7) return { multiplier: 1.5, label: "1.5x \u2014 Weekly Warrior" };
  if (streak >= 3) return { multiplier: 1.2, label: "1.2x \u2014 Getting Started" };
  return { multiplier: 1, label: "No bonus yet" };
}
async function performSpinV2(wallet, record, nftTier, chain = "pulsechain") {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    throw new Error(`Invalid wallet address: ${wallet}`);
  }
  const segments = getWheelForTier(nftTier);
  const streak = record?.currentStreak || 0;
  const bonus = getStreakBonusV2(streak);
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
  const salt = `spin-v2-${wallet}-${today}-${nftTier}`;
  const rng = await generateRandom(totalWeight, salt, chain);
  let cumulative = 0;
  let winningSegment = null;
  for (const segment of segments) {
    cumulative += segment.weight;
    if (rng.value < cumulative) {
      winningSegment = segment;
      break;
    }
  }
  if (!winningSegment) {
    throw new Error(`Spin selection failed: value=${rng.value}, totalWeight=${totalWeight}`);
  }
  let finalRewardValue = winningSegment.rewardValue;
  if (winningSegment.rewardType === "hero_tokens" || winningSegment.rewardType === "jackpot") {
    const baseValue = parseInt(winningSegment.rewardValue);
    finalRewardValue = String(Math.floor(baseValue * bonus.multiplier));
  }
  const claimable = ["hero_tokens", "jackpot"].includes(winningSegment.rewardType);
  const claimId = claimable ? ethers3.keccak256(ethers3.toUtf8Bytes(`${wallet}-${rng.proofHash}-${Date.now()}`)).slice(0, 18) : void 0;
  return {
    segmentId: winningSegment.id,
    segmentLabel: winningSegment.label,
    rewardType: winningSegment.rewardType,
    rewardValue: winningSegment.rewardValue,
    finalRewardValue,
    multiplier: bonus.multiplier,
    streakAtSpin: streak,
    rngProof: rng,
    spinTimestamp: Date.now(),
    claimable,
    claimId,
    nftTier
  };
}
function updateSpinRecordV2(record, wallet, result) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 864e5).toISOString().split("T")[0];
  const heroEarned = ["hero_tokens", "jackpot"].includes(result.rewardType) ? parseInt(result.finalRewardValue) : 0;
  if (!record) {
    return {
      wallet,
      lastSpinDate: today,
      currentStreak: 1,
      longestStreak: 1,
      totalSpins: 1,
      nftTier: result.nftTier,
      totalHeroEarned: heroEarned,
      totalBurned: 0,
      history: [result]
    };
  }
  const isConsecutive = record.lastSpinDate === yesterday;
  const newStreak = isConsecutive ? record.currentStreak + 1 : 1;
  return {
    ...record,
    lastSpinDate: today,
    currentStreak: newStreak,
    longestStreak: Math.max(record.longestStreak, newStreak),
    totalSpins: record.totalSpins + 1,
    nftTier: result.nftTier,
    totalHeroEarned: record.totalHeroEarned + heroEarned,
    history: [...record.history.slice(-29), result]
  };
}
var rateLimitMap = /* @__PURE__ */ new Map();
function checkRateLimit(wallet, maxPerMinute = 5) {
  const now = Date.now();
  const key = wallet.toLowerCase();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t2) => now - t2 < 6e4);
  rateLimitMap.set(key, recent);
  if (recent.length >= maxPerMinute) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

// server/raffle-engine.ts
function enterRaffle(raffle, wallet, heroBalance) {
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    throw new Error(`Invalid wallet address format: ${wallet}`);
  }
  if (raffle.status !== "active") throw new Error(`Raffle "${raffle.id}" is not active (status: ${raffle.status})`);
  if (Date.now() > raffle.endTime) throw new Error(`Raffle "${raffle.id}" has ended`);
  if (heroBalance < raffle.minHeroBalance) {
    throw new Error(`Must hold at least ${raffle.minHeroBalance.toString()} HERO to enter`);
  }
  if (raffle.maxEntries > 0 && raffle.entries.length >= raffle.maxEntries) {
    throw new Error("Raffle is full");
  }
  const existing = raffle.entries.find((e) => e.wallet.toLowerCase() === wallet.toLowerCase());
  if (existing) throw new Error("Already entered this raffle");
  const entry = {
    wallet: wallet.toLowerCase(),
    heroBalance,
    enteredAt: Date.now()
  };
  raffle.entries.push(entry);
  return entry;
}
async function drawRaffleWinners(raffle, chain = "pulsechain") {
  if (raffle.entries.length === 0) throw new Error("No entries to draw from");
  if (raffle.status === "completed") throw new Error("Raffle already drawn");
  raffle.status = "drawing";
  const actualWinnerCount = Math.min(raffle.winnerCount, raffle.entries.length);
  const salt = `raffle-${raffle.id}-draw`;
  const { winners: winnerIndices, proofs } = await selectMultipleWinners(
    raffle.entries.length,
    actualWinnerCount,
    salt,
    chain
  );
  const winners = winnerIndices.map((idx, i) => ({
    wallet: raffle.entries[idx].wallet,
    heroBalance: raffle.entries[idx].heroBalance,
    rngProof: proofs[i],
    prizeAwarded: false
  }));
  raffle.winners = winners;
  raffle.status = "completed";
  raffle.drawTimestamp = Date.now();
  return {
    raffleId: raffle.id,
    winners,
    totalEntries: raffle.entries.length,
    drawBlockNumber: proofs[0]?.blockNumber || 0,
    drawBlockHash: proofs[0]?.blockHash || "",
    drawTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
    verificationUrl: `https://scan.pulsechain.com/block/${proofs[0]?.blockNumber}`
  };
}

// server/priceFeed.ts
var ADDRESSES = {
  pulsechain: {
    hero: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
    vets: "0x4013abBf94A745EfA7cc848989Ee83424a770060",
    wpls: "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
    dai: "0xefD766cCb38EaF1dfd701853BFCe31359239F305",
    heroTruFarmLP: "0x1F7FA931F4D1789c44f4a7Adc4564DE45ed96DF5",
    heroPLSLP: "0x34948e125033a697332202964de96af85becd78f",
    vetsWPLSLP: "0xe2EC4E2033054b778a2a56B7B3EB70f89944F5e6",
    emit: "0x32fB5663619A657839A80133994E45c5e5cDf427",
    rhino: "0x6C6D7De6C5f366a1995ed5f1e273C5B3760C6043",
    truFarm: "0xCA942990EF21446Db490532E66992eD1EF76A82b"
  },
  base: {
    hero: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
    heroEthPair: "0x3bb159de8604ab7e0148edc24f2a568c430476cf",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    weth: "0x4200000000000000000000000000000000000006",
    jesse: "0xBE8ae24C5E4D19759f640Fb89617047213be3194",
    aero: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    brett: "0x532f27101965dd16442E59d40670FaF5eBB142E4"
  }
};
var DEXSCREENER_BASE = "https://api.dexscreener.com";
async function fetchDexScreener(path3) {
  const url = `${DEXSCREENER_BASE}${path3}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(1e4)
  });
  if (!res.ok) {
    throw new Error(`DexScreener API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
function pairToTokenPrice(pair) {
  return {
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    address: pair.baseToken.address,
    chainId: pair.chainId,
    priceUsd: pair.priceUsd || "0",
    priceNative: pair.priceNative,
    priceChange24h: pair.priceChange?.h24 || 0,
    priceChange6h: pair.priceChange?.h6 || 0,
    priceChange1h: pair.priceChange?.h1 || 0,
    volume24h: pair.volume?.h24 || 0,
    liquidity: pair.liquidity?.usd || 0,
    marketCap: pair.marketCap || 0,
    fdv: pair.fdv || 0,
    txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
    pairAddress: pair.pairAddress,
    dexId: pair.dexId,
    updatedAt: Date.now()
  };
}
function pairToLpData(pair) {
  return {
    pairAddress: pair.pairAddress,
    dexId: pair.dexId,
    chainId: pair.chainId,
    baseToken: pair.baseToken,
    quoteToken: pair.quoteToken,
    priceUsd: pair.priceUsd || "0",
    priceNative: pair.priceNative,
    liquidity: pair.liquidity || { usd: 0, base: 0, quote: 0 },
    volume24h: pair.volume?.h24 || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
    txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
    pairCreatedAt: pair.pairCreatedAt || 0,
    url: pair.url || ""
  };
}
var cache = {};
var CACHE_TTL = 3e4;
function getCached(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    delete cache[key];
    return null;
  }
  return entry.data;
}
function setCache(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}
async function fetchTokenPrices() {
  const cacheKey = "tokenPrices_pulsechain";
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const data = await fetchDexScreener(
      `/tokens/v1/pulsechain/${ADDRESSES.pulsechain.hero},${ADDRESSES.pulsechain.vets}`
    );
    const heroPairs = data.filter(
      (p) => p.baseToken.address.toLowerCase() === ADDRESSES.pulsechain.hero.toLowerCase()
    );
    const vetsPairs = data.filter(
      (p) => p.baseToken.address.toLowerCase() === ADDRESSES.pulsechain.vets.toLowerCase()
    );
    const result = { heroPairs, vetsPairs };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[PriceFeed] Error fetching token prices:", err);
    return { heroPairs: [], vetsPairs: [] };
  }
}
async function fetchBaseTokenPrices() {
  const cacheKey = "tokenPrices_base";
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const data = await fetchDexScreener(
      `/tokens/v1/base/${ADDRESSES.base.hero}`
    );
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("[PriceFeed] Error fetching Base token prices:", err);
    return [];
  }
}
async function fetchPulsechainTickerTokens() {
  const cacheKey = "tickerTokens_pulsechain";
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const data = await fetchDexScreener(
      `/tokens/v1/pulsechain/${ADDRESSES.pulsechain.emit},${ADDRESSES.pulsechain.rhino},${ADDRESSES.pulsechain.truFarm}`
    );
    const findBest = (addr) => {
      const matches = data.filter((p) => p.baseToken.address.toLowerCase() === addr.toLowerCase());
      if (matches.length === 0) return null;
      return matches.reduce((best, p) => (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best);
    };
    const result = {
      emit: findBest(ADDRESSES.pulsechain.emit),
      rhino: findBest(ADDRESSES.pulsechain.rhino),
      truFarm: findBest(ADDRESSES.pulsechain.truFarm)
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[PriceFeed] Error fetching PulseChain ticker tokens:", err);
    return { emit: null, rhino: null, truFarm: null };
  }
}
async function fetchBaseTickerTokens() {
  const cacheKey = "tickerTokens_base";
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const data = await fetchDexScreener(
      `/tokens/v1/base/${ADDRESSES.base.jesse},${ADDRESSES.base.aero},${ADDRESSES.base.brett}`
    );
    const findBest = (addr) => {
      const matches = data.filter((p) => p.baseToken.address.toLowerCase() === addr.toLowerCase());
      if (matches.length === 0) return null;
      return matches.reduce((best, p) => (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best);
    };
    const result = {
      jesse: findBest(ADDRESSES.base.jesse),
      aero: findBest(ADDRESSES.base.aero),
      brett: findBest(ADDRESSES.base.brett)
    };
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[PriceFeed] Error fetching Base ticker tokens:", err);
    return { jesse: null, aero: null, brett: null };
  }
}
async function fetchPlsPrice() {
  const cacheKey = "plsPrice";
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const data = await fetchDexScreener(
      `/tokens/v1/pulsechain/${ADDRESSES.pulsechain.wpls}`
    );
    const pairs = Array.isArray(data) ? data : [];
    if (pairs.length === 0) return null;
    const bestPair = pairs.reduce(
      (best, p) => (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
    );
    const price = {
      ...pairToTokenPrice(bestPair),
      symbol: "PLS",
      name: "Pulse",
      address: "0x0000000000000000000000000000000000000000"
    };
    setCache(cacheKey, price);
    return price;
  } catch (err) {
    console.error("[PriceFeed] Error fetching PLS price:", err);
    return null;
  }
}
async function fetchEthPrice() {
  const cacheKey = "ethPrice";
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const data = await fetchDexScreener(
      `/tokens/v1/base/0x4200000000000000000000000000000000000006`
    );
    const pairs = Array.isArray(data) ? data : [];
    if (pairs.length === 0) return null;
    const bestPair = pairs.reduce(
      (best, p) => (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
    );
    const price = {
      ...pairToTokenPrice(bestPair),
      symbol: "ETH",
      name: "Ether",
      address: "0x0000000000000000000000000000000000000000"
    };
    setCache(cacheKey, price);
    return price;
  } catch (err) {
    console.error("[PriceFeed] Error fetching ETH price:", err);
    return null;
  }
}
async function getMarketOverview(chain = "pulsechain") {
  const cacheKey = `marketOverview_${chain}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const [tokenData, plsPrice, ethPrice] = await Promise.all([
    fetchTokenPrices(),
    fetchPlsPrice(),
    fetchEthPrice()
  ]);
  const heroPrimary = tokenData.heroPairs.length > 0 ? pairToTokenPrice(tokenData.heroPairs.reduce(
    (best, p) => (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
  )) : null;
  const vetsPrimary = tokenData.vetsPairs.length > 0 ? pairToTokenPrice(tokenData.vetsPairs.reduce(
    (best, p) => (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
  )) : null;
  const heroLpPairs = tokenData.heroPairs.map(pairToLpData);
  const vetsLpPairs = tokenData.vetsPairs.map(pairToLpData);
  const totalHeroLiquidity = heroLpPairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
  const totalVetsLiquidity = vetsLpPairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
  const overview = {
    heroPrice: heroPrimary,
    vetsPrice: vetsPrimary,
    plsPrice,
    ethPrice,
    heroLpPairs,
    vetsLpPairs,
    totalHeroLiquidity,
    totalVetsLiquidity,
    heroMarketCap: heroPrimary?.marketCap || 0,
    vetsMarketCap: vetsPrimary?.marketCap || 0,
    lastUpdated: Date.now()
  };
  setCache(cacheKey, overview);
  return overview;
}
var LP_PAIR_ADDRESSES = {
  pulsechain: [
    { poolId: 67, name: "HERO/PLS", address: "0x34948e125033a697332202964de96af85becd78f" },
    { poolId: 9, name: "HERO/TruFarm", address: "0x1F7FA931F4D1789c44f4a7Adc4564DE45ed96DF5" },
    { poolId: 1, name: "VETS/WPLS", address: "0xe2EC4E2033054b778a2a56B7B3EB70f89944F5e6" }
  ],
  base: [
    { poolId: 0, name: "HERO/ETH", address: "0x3bb159de8604ab7e0148edc24f2a568c430476cf" }
  ]
};
async function fetchFarmPoolData(chain = "pulsechain") {
  const cacheKey = `farmPools_${chain}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const pools = LP_PAIR_ADDRESSES[chain];
  const addresses = pools.map((p) => p.address).join(",");
  const chainId = chain === "pulsechain" ? "pulsechain" : "base";
  try {
    const data = await fetchDexScreener(
      `/latest/dex/pairs/${chainId}/${addresses}`
    );
    const pairs = data.pairs || [];
    const result = pools.map((pool) => {
      const pair = pairs.find(
        (p) => p.pairAddress.toLowerCase() === pool.address.toLowerCase()
      );
      if (!pair) {
        return {
          poolId: pool.poolId,
          name: pool.name,
          lpAddress: pool.address,
          tvlUsd: 0,
          volume24h: 0,
          priceChange24h: 0,
          baseToken: { symbol: "?", name: "Unknown", address: "" },
          quoteToken: { symbol: "?", name: "Unknown", address: "" },
          estimatedApr: 0,
          txns24h: { buys: 0, sells: 0 },
          dexId: "unknown",
          url: ""
        };
      }
      const tvl = pair.liquidity?.usd || 0;
      const vol24h = pair.volume?.h24 || 0;
      const dailyFees = vol24h * 3e-3;
      const estimatedApr = tvl > 0 ? dailyFees * 365 / tvl * 100 : 0;
      return {
        poolId: pool.poolId,
        name: pool.name,
        lpAddress: pool.address,
        tvlUsd: tvl,
        volume24h: vol24h,
        priceChange24h: pair.priceChange?.h24 || 0,
        baseToken: pair.baseToken,
        quoteToken: pair.quoteToken,
        estimatedApr: Math.round(estimatedApr * 100) / 100,
        txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
        dexId: pair.dexId,
        url: pair.url || ""
      };
    });
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[PriceFeed] Error fetching farm pool data for ${chain}:`, err);
    return [];
  }
}
var PULSECHAIN_RPCS = [
  "https://rpc.pulsechain.com",
  "https://rpc-pulsechain.g4mm4.io",
  "https://pulsechain-rpc.publicnode.com"
  // 3 verified working PulseChain mainnet RPCs — failover ensures reliability
];
var HERO_ADDRESS = "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27";
var DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
var ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
var HERO_TOTAL_SUPPLY = 1e8;
async function rpcCall(to, data) {
  let lastError = null;
  for (const rpcUrl of PULSECHAIN_RPCS) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to, data }, "latest"],
          id: 1
        }),
        signal: AbortSignal.timeout(15e3)
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${rpcUrl}`);
        continue;
      }
      const json = await res.json();
      if (json.error) {
        lastError = new Error(`${rpcUrl}: ${json.error.message}`);
        continue;
      }
      if (!json.result || json.result === "0x") {
        lastError = new Error(`Empty result from ${rpcUrl}`);
        continue;
      }
      return json.result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[RPC Failover] ${rpcUrl} failed:`, lastError.message);
      continue;
    }
  }
  throw lastError || new Error("All PulseChain RPCs failed");
}
async function getHeroBalance(address) {
  const paddedAddr = address.replace("0x", "").toLowerCase().padStart(64, "0");
  const result = await rpcCall(HERO_ADDRESS, `0x70a08231${paddedAddr}`);
  return parseInt(result, 16) / 1e18;
}
async function fetchBuyAndBurnData() {
  const cacheKey = "buyAndBurn";
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const [deadBalance, zeroBalance, tokenData] = await Promise.all([
      getHeroBalance(DEAD_ADDRESS),
      getHeroBalance(ZERO_ADDRESS),
      fetchTokenPrices()
    ]);
    const totalBurned = deadBalance + zeroBalance;
    const burnPercentage = totalBurned / HERO_TOTAL_SUPPLY * 100;
    const circulatingSupply = HERO_TOTAL_SUPPLY - totalBurned;
    const heroPrimary = tokenData.heroPairs.length > 0 ? tokenData.heroPairs.reduce(
      (best, p) => (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
    ) : null;
    const heroPrice = heroPrimary?.priceUsd || "0";
    const totalBurnedUsd = totalBurned * parseFloat(heroPrice);
    const data = {
      totalBurned,
      totalBurnedUsd,
      burnPercentage: Math.round(burnPercentage * 100) / 100,
      totalSupply: HERO_TOTAL_SUPPLY,
      circulatingSupply,
      heroPrice,
      lastUpdated: Date.now()
    };
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("[PriceFeed] Error fetching Buy & Burn data:", err);
    return {
      totalBurned: 0,
      totalBurnedUsd: 0,
      burnPercentage: 0,
      totalSupply: HERO_TOTAL_SUPPLY,
      circulatingSupply: HERO_TOTAL_SUPPLY,
      heroPrice: "0",
      lastUpdated: Date.now()
    };
  }
}
async function searchPairs(query) {
  const cacheKey = `search_${query}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const data = await fetchDexScreener(
      `/latest/dex/search?q=${encodeURIComponent(query)}`
    );
    const pairs = (data.pairs || []).map(pairToLpData);
    setCache(cacheKey, pairs);
    return pairs;
  } catch (err) {
    console.error("[PriceFeed] Error searching pairs:", err);
    return [];
  }
}

// server/dao-anchor-integration.ts
init_dao_logger();
import { createPublicClient as createPublicClient2, createWalletClient, http as http2, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { pulsechain } from "viem/chains";
var anchorLogger = createDaoLogger("dao-anchor");
var HERO_DAO_ANCHOR_ABI = [
  {
    name: "anchorProposal",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalIdHash", type: "bytes32" },
      { name: "contentHash", type: "bytes32" },
      { name: "votingEndsAt", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "finalizeProposal",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalIdHash", type: "bytes32" },
      { name: "votesFor", type: "uint256" },
      { name: "votesAgainst", type: "uint256" },
      { name: "votesAbstain", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "isExecutable",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalIdHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "timelockRemaining",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalIdHash", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "verifyContentHash",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "proposalIdHash", type: "bytes32" },
      { name: "expectedHash", type: "bytes32" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
];
function getConfig() {
  const contractAddress = process.env.DAO_ANCHOR_CONTRACT;
  const executorKey = process.env.DAO_EXECUTOR_PRIVATE_KEY;
  return {
    contractAddress: contractAddress || "0x0000000000000000000000000000000000000000",
    executorPrivateKey: executorKey || "0x0000000000000000000000000000000000000000000000000000000000000000",
    rpcUrl: process.env.PULSECHAIN_RPC_URL || "https://rpc.pulsechain.com",
    enabled: Boolean(contractAddress && executorKey && contractAddress !== "0x0000000000000000000000000000000000000000")
  };
}
function getClients() {
  const config = getConfig();
  if (!config.enabled) return null;
  const account = privateKeyToAccount(config.executorPrivateKey);
  const publicClient = createPublicClient2({
    chain: pulsechain,
    transport: http2(config.rpcUrl)
  });
  const walletClient = createWalletClient({
    account,
    chain: pulsechain,
    transport: http2(config.rpcUrl)
  });
  return { publicClient, walletClient, account, config };
}
async function anchorProposalOnChain(proposalId, contentHash, votingEndsAt, maxRetries = 2) {
  if (!proposalId || !/^HERO-M\d+-[A-Za-z0-9]+$/.test(proposalId)) {
    anchorLogger.error("Invalid proposalId format", { proposalId });
    throw new Error(`Invalid proposalId format: ${proposalId}`);
  }
  if (!contentHash || !/^[a-fA-F0-9]{64}$/.test(contentHash)) {
    anchorLogger.error("Invalid contentHash format (expected 64 hex chars)");
    throw new Error("Invalid contentHash format");
  }
  if (!(votingEndsAt instanceof Date) || isNaN(votingEndsAt.getTime()) || votingEndsAt.getTime() < Date.now()) {
    anchorLogger.error("Invalid votingEndsAt: must be a valid future date");
    throw new Error("Invalid votingEndsAt");
  }
  const clients2 = getClients();
  if (!clients2) {
    anchorLogger.info(" On-chain anchoring disabled \u2014 skipping");
    return null;
  }
  const { publicClient, walletClient, account, config } = clients2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const proposalIdHash = keccak256(toHex(proposalId));
      const contentHashBytes = `0x${contentHash}`;
      const votingEndsAtUnix = BigInt(Math.floor(votingEndsAt.getTime() / 1e3));
      const { request } = await publicClient.simulateContract({
        address: config.contractAddress,
        abi: HERO_DAO_ANCHOR_ABI,
        functionName: "anchorProposal",
        args: [proposalIdHash, contentHashBytes, votingEndsAtUnix],
        account
      });
      const txHash = await walletClient.writeContract(request);
      anchorLogger.info(` Proposal ${proposalId} anchored on-chain (attempt ${attempt + 1}): ${txHash}`);
      return txHash;
    } catch (err) {
      anchorLogger.error(`Attempt ${attempt + 1}/${maxRetries + 1} failed for ${proposalId}`, { error: err?.message });
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1e3 * (attempt + 1)));
        continue;
      }
      const alertMsg = `[DAO Anchor] ALERT: All ${maxRetries + 1} attempts FAILED for ${proposalId}. Proposal created WITHOUT on-chain anchor. Last error: ${err.message}`;
      anchorLogger.fatal(alertMsg);
      try {
        const { logDaoAction: logDaoAction2 } = await Promise.resolve().then(() => (init_dao_rate_limiter(), dao_rate_limiter_exports));
        await logDaoAction2(proposalId, "anchor_failed", 0, { error: err.message, attempts: maxRetries + 1 });
      } catch {
      }
      return null;
    }
  }
  return null;
}

// server/dao-security-hardening.ts
import { createHash, randomBytes, timingSafeEqual as nodeTimingSafeEqual } from "crypto";
var TIMELOCK_DURATION_MS = 48 * 60 * 60 * 1e3;
var DELEGATION_COOLDOWN_MS = 24 * 60 * 60 * 1e3;
function generateProposalHash(proposalId, title, description, proposerAddress, chain, startTime, endTime) {
  const payload = [
    "HERO_DAO_v1",
    // Domain separator
    proposalId,
    title,
    description,
    proposerAddress.toLowerCase(),
    chain,
    startTime.toISOString(),
    endTime.toISOString()
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

// server/routers.ts
init_dao_logger();
init_dao_rate_limiter();

// server/snapshot-integration.ts
init_dao_logger();
var daoLogger = createDaoLogger("snapshot-integration");
var SNAPSHOT_HUB = "https://hub.snapshot.org/graphql";
var SPACE_ID = "hero-dao.eth";
var SNAPSHOT_TIMEOUT_MS = 1e4;
function mapSnapshotState(state) {
  switch (state) {
    case "active":
      return "active";
    case "pending":
      return "pending";
    case "closed":
      return "passed";
    default:
      return state;
  }
}
function normalizeProposal(proposal) {
  let status = mapSnapshotState(proposal.state);
  if (proposal.state === "closed") {
    const forVotes = proposal.scores[0] || 0;
    const againstVotes = proposal.scores[1] || 0;
    status = forVotes > againstVotes ? "passed" : "defeated";
  }
  return {
    proposalId: `SNAP-${proposal.id.slice(0, 8)}`,
    title: proposal.title,
    description: proposal.body,
    status,
    votesFor: Math.round(proposal.scores[0] || 0),
    votesAgainst: Math.round(proposal.scores[1] || 0),
    votesAbstain: Math.round(proposal.scores[2] || 0),
    totalVotes: proposal.votes,
    createdAt: new Date(proposal.created * 1e3).toISOString(),
    endTime: new Date(proposal.end * 1e3).toISOString(),
    proposerAddress: proposal.author,
    category: "protocol",
    chain: "both",
    source: "snapshot",
    snapshotUrl: `https://snapshot.org/#/${SPACE_ID}/proposal/${encodeURIComponent(proposal.id)}`
  };
}
async function querySnapshot(operation, query, variables) {
  try {
    const response = await fetch(SNAPSHOT_HUB, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS)
    });
    if (!response.ok) {
      daoLogger.error("snapshot_fetch_failed", {
        operation,
        status: response.status
      });
      return null;
    }
    const envelope = await response.json();
    if (envelope.errors?.length || !envelope.data) {
      daoLogger.warn("snapshot_graphql_error", {
        operation,
        errors: envelope.errors?.map((error) => error.message || "unknown") || []
      });
      return null;
    }
    return envelope.data;
  } catch (error) {
    daoLogger.error("snapshot_request_error", {
      operation,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
async function fetchSnapshotProposals(limit = 20) {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const data = await querySnapshot(
    "list_proposals",
    `query ListProposals($first: Int!, $space: String!) {
      proposals(
        first: $first,
        skip: 0,
        where: { space_in: [$space] },
        orderBy: "created",
        orderDirection: desc
      ) {
        id title body choices start end snapshot state scores scores_total votes
        author created type space { id name }
      }
    }`,
    { first: boundedLimit, space: SPACE_ID }
  );
  return (data?.proposals || []).map(normalizeProposal);
}
async function fetchSnapshotProposalById(snapshotId) {
  const data = await querySnapshot(
    "get_proposal",
    `query GetProposal($id: String!) {
      proposal(id: $id) {
        id title body choices start end snapshot state scores scores_total votes
        author created type space { id name }
      }
    }`,
    { id: snapshotId }
  );
  return data?.proposal ? normalizeProposal(data.proposal) : null;
}

// server/routers.ts
var rpcMetrics = {
  pulsechain: { calls: 0, timeouts: 0, errors: 0, lastError: null, avgMs: 0 },
  base: { calls: 0, timeouts: 0, errors: 0, lastError: null, avgMs: 0 }
};
function logRpcEvent(chain, event, durationMs, errorMsg) {
  const m = rpcMetrics[chain];
  m.calls++;
  if (event === "timeout") {
    m.timeouts++;
    m.lastError = `RPC timeout after ${durationMs}ms`;
    console.warn(JSON.stringify({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level: "warn",
      module: "rpc-monitor",
      event: "rpc_timeout",
      chain,
      durationMs,
      totalTimeouts: m.timeouts,
      totalCalls: m.calls,
      timeoutRate: `${(m.timeouts / m.calls * 100).toFixed(1)}%`
    }));
  } else if (event === "error") {
    m.errors++;
    m.lastError = errorMsg || "unknown";
    console.error(JSON.stringify({
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level: "error",
      module: "rpc-monitor",
      event: "rpc_error",
      chain,
      durationMs,
      error: errorMsg,
      totalErrors: m.errors,
      totalCalls: m.calls
    }));
  } else if (durationMs) {
    m.avgMs = m.avgMs === 0 ? durationMs : m.avgMs * 0.9 + durationMs * 0.1;
    if (durationMs > 5e3) {
      console.warn(JSON.stringify({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        level: "warn",
        module: "rpc-monitor",
        event: "rpc_slow",
        chain,
        durationMs,
        avgMs: Math.round(m.avgMs)
      }));
    }
  }
}
function getRpcMetrics() {
  return rpcMetrics;
}
var pulsechainClient = createPublicClient3({ chain: pulsechain2, transport: http3("https://rpc.pulsechain.com", { timeout: 1e4 }) });
var baseClient = createPublicClient3({ chain: { id: 8453, name: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://mainnet.base.org"] } } }, transport: http3("https://mainnet.base.org", { timeout: 1e4 }) });
var HERO_TOKENS = {
  pulsechain: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
  base: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8"
};
async function verifyVotingPower(voterAddress, chain, snapshotBlock) {
  const client = chain === "pulsechain" ? pulsechainClient : baseClient;
  const tokenAddress = HERO_TOKENS[chain];
  const RPC_TIMEOUT_MS2 = 1e4;
  const startTime = Date.now();
  try {
    const balancePromise = snapshotBlock ? client.readContract({
      address: tokenAddress,
      abi: [{ type: "function", name: "getPastVotes", inputs: [{ name: "account", type: "address" }, { name: "blockNumber", type: "uint256" }], outputs: [{ type: "uint256" }], stateMutability: "view" }],
      functionName: "getPastVotes",
      args: [voterAddress, BigInt(snapshotBlock)]
    }) : client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [voterAddress]
    });
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(() => reject(new Error("RPC timeout")), RPC_TIMEOUT_MS2)
    );
    const balance = await Promise.race([balancePromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;
    logRpcEvent(chain, "call", durationMs);
    return Math.floor(Number(balance) / 1e18);
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const isTimeout = err?.message?.includes("timeout") || durationMs >= RPC_TIMEOUT_MS2;
    logRpcEvent(chain, isTimeout ? "timeout" : "error", durationMs, err?.message);
    return 0;
  }
}
var ethAddressSchema = z3.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address format");
var spinRecordsV2 = /* @__PURE__ */ new Map();
var leaderboardCache = /* @__PURE__ */ new Map();
function checkSpinRateLimit(wallet) {
  return checkRateLimit(wallet, 5);
}
function getWheelForTierV2(tier) {
  return getWheelForTier(tier);
}
function updateLeaderboard(wallet, record) {
  const biggest = record.history.reduce((max, h) => {
    const val = parseInt(h.finalRewardValue) || 0;
    return val > max ? val : max;
  }, 0);
  leaderboardCache.set(wallet, {
    wallet,
    currentStreak: record.currentStreak,
    longestStreak: record.longestStreak,
    totalSpins: record.totalSpins,
    totalHeroEarned: record.totalHeroEarned,
    biggestWin: biggest > 0 ? `${biggest} HERO` : "None yet"
  });
}
var activeRaffles = /* @__PURE__ */ new Map();
var txHashSchema2 = z3.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash format").optional();
var safeStringSchema = (maxLen) => z3.string().max(maxLen).refine(
  (s) => !/<script/i.test(s) && !/javascript:/i.test(s) && !/on\w+=/.test(s),
  { message: "Input contains disallowed content" }
);
var tokenSymbolSchema = z3.string().max(20).regex(/^[a-zA-Z0-9$_.\-]+$/, "Invalid token symbol");
function createStandardError(code, message) {
  throw new TRPCError3({ code, message });
}
var routerLogger = createDaoLogger("routers");
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  dca: router({
    list: protectedProcedure.input(z3.object({ wallet: ethAddressSchema, chainId: z3.number().optional() })).query(async ({ ctx, input }) => {
      if (ctx.user.walletAddress && input.wallet.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
        createStandardError("FORBIDDEN", "Wallet address does not match authenticated user");
      }
      return getDcaOrdersByUser(ctx.user.id);
    }),
    create: protectedProcedure.input(z3.object({
      walletAddress: ethAddressSchema,
      tokenInAddress: ethAddressSchema,
      tokenInSymbol: tokenSymbolSchema,
      tokenOutAddress: ethAddressSchema,
      tokenOutSymbol: tokenSymbolSchema,
      amountPerInterval: z3.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
      intervalSeconds: z3.number().int().positive().max(86400 * 30),
      totalIntervals: z3.number().int().positive().max(365)
    })).mutation(async ({ ctx, input }) => {
      await createDcaOrder({
        userId: ctx.user.id,
        ...input,
        nextExecutionAt: /* @__PURE__ */ new Date()
      });
      return { success: true };
    }),
    updateStatus: protectedProcedure.input(z3.object({
      orderId: z3.number().int().positive(),
      status: z3.enum(["active", "paused", "completed", "cancelled"])
    })).mutation(async ({ ctx, input }) => {
      await updateDcaOrderStatus(input.orderId, ctx.user.id, input.status);
      return { success: true };
    })
  }),
  limitOrder: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getLimitOrdersByUser(ctx.user.id);
    }),
    create: protectedProcedure.input(z3.object({
      walletAddress: ethAddressSchema,
      tokenInAddress: ethAddressSchema,
      tokenInSymbol: tokenSymbolSchema,
      tokenOutAddress: ethAddressSchema,
      tokenOutSymbol: tokenSymbolSchema,
      amountIn: z3.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
      targetPrice: z3.string().regex(/^\d+\.?\d*$/, "Invalid price"),
      orderType: z3.enum(["buy", "sell"]),
      expiresAt: z3.date().optional()
    })).mutation(async ({ ctx, input }) => {
      await createLimitOrder({
        userId: ctx.user.id,
        ...input
      });
      return { success: true };
    }),
    cancel: protectedProcedure.input(z3.object({ orderId: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await cancelLimitOrder(input.orderId, ctx.user.id);
      return { success: true };
    })
  }),
  swap: router({
    history: publicProcedure.input(z3.object({ walletAddress: ethAddressSchema })).query(async ({ input }) => {
      return getSwapHistoryByWallet(input.walletAddress);
    }),
    record: protectedProcedure.input(z3.object({
      walletAddress: ethAddressSchema,
      tokenInAddress: ethAddressSchema,
      tokenInSymbol: tokenSymbolSchema,
      tokenOutAddress: ethAddressSchema,
      tokenOutSymbol: tokenSymbolSchema,
      amountIn: z3.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
      amountOut: z3.string().regex(/^\d+\.?\d*$/, "Invalid amount"),
      dexSource: z3.string().max(100).optional(),
      txHash: txHashSchema2,
      gasUsed: z3.string().regex(/^\d+$/, "Invalid gas").optional(),
      gasless: z3.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      await recordSwap({
        userId: ctx.user.id,
        ...input
      });
      return { success: true };
    })
  }),
  watchlist: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getWatchlistByUser(ctx.user.id);
    }),
    add: protectedProcedure.input(z3.object({
      tokenAddress: ethAddressSchema,
      tokenSymbol: tokenSymbolSchema
    })).mutation(async ({ ctx, input }) => {
      await addToWatchlist({
        userId: ctx.user.id,
        ...input
      });
      return { success: true };
    }),
    remove: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await removeFromWatchlist(input.id, ctx.user.id);
      return { success: true };
    })
  }),
  blog: router({
    published: publicProcedure.input(z3.object({ limit: z3.number().int().positive().max(50).optional() }).optional()).query(async ({ input }) => {
      return getPublishedBlogPosts(input?.limit ?? 20);
    }),
    bySlug: publicProcedure.input(z3.object({ slug: z3.string() })).query(async ({ input }) => {
      return getBlogPostBySlug(input.slug);
    }),
    all: protectedProcedure.query(async () => {
      return getAllBlogPosts();
    }),
    create: protectedProcedure.input(z3.object({
      title: z3.string().min(1).max(500),
      slug: z3.string().min(1).max(500),
      content: z3.string().min(1),
      excerpt: z3.string().max(1e3).optional(),
      coverImageUrl: z3.string().optional(),
      tweetId: z3.string().optional(),
      tweetAuthor: z3.string().optional(),
      tweetUrl: z3.string().optional(),
      tags: z3.string().optional(),
      heroMentioned: z3.boolean().optional(),
      vetsMentioned: z3.boolean().optional(),
      status: z3.enum(["draft", "published", "archived"]).optional(),
      publishedAt: z3.date().optional()
    })).mutation(async ({ input }) => {
      await createBlogPost(input);
      return { success: true };
    }),
    update: protectedProcedure.input(z3.object({
      id: z3.number().int().positive(),
      title: z3.string().max(500).optional(),
      content: z3.string().optional(),
      excerpt: z3.string().max(1e3).optional(),
      status: z3.enum(["draft", "published", "archived"]).optional(),
      publishedAt: z3.date().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateBlogPost(id, data);
      return { success: true };
    }),
    generateFromMvs: protectedProcedure.input(z3.object({
      tweetContent: z3.string().min(1),
      tweetUrl: z3.string(),
      tweetAuthor: z3.string()
    })).mutation(async ({ input }) => {
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a crypto blog writer for the VIC Foundation. Write engaging blog posts about $HERO and $VETS tokens on PulseChain. The VIC Foundation supports military veterans and first responders through DeFi. Always highlight the bullish case for $HERO and $VETS. Include farm yield data when available. Write in an energetic but professional tone. Output JSON with fields: title, content (markdown), excerpt, tags (comma-separated).`
          },
          {
            role: "user",
            content: `Generate a blog article from this media mention / influencer post by ${input.tweetAuthor}:

${input.tweetContent}

Source URL: ${input.tweetUrl}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "blog_post",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string", description: "Blog post title" },
                content: { type: "string", description: "Full blog post in markdown" },
                excerpt: { type: "string", description: "Short excerpt, max 200 chars" },
                tags: { type: "string", description: "Comma-separated tags" }
              },
              required: ["title", "content", "excerpt", "tags"],
              additionalProperties: false
            }
          }
        }
      });
      const rawContent = llmResponse.choices[0].message.content;
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      let parsed;
      try {
        parsed = JSON.parse(contentStr || "{}");
      } catch {
        createStandardError("INTERNAL_SERVER_ERROR", "LLM returned invalid JSON \u2014 please retry");
      }
      const blogSchema = z3.object({ title: z3.string().min(1), content: z3.string().min(1), excerpt: z3.string().min(1), tags: z3.string() });
      const validated = blogSchema.safeParse(parsed);
      if (!validated.success) createStandardError("INTERNAL_SERVER_ERROR", "LLM response missing required fields \u2014 please retry");
      parsed = validated.data;
      const slug = parsed.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200) + "-" + Date.now();
      const heroMentioned = input.tweetContent.toLowerCase().includes("hero");
      const vetsMentioned = input.tweetContent.toLowerCase().includes("vets");
      await createBlogPost({
        title: parsed.title,
        slug,
        content: parsed.content,
        excerpt: parsed.excerpt,
        tweetId: input.tweetUrl.split("/").pop() || "",
        tweetAuthor: input.tweetAuthor,
        tweetUrl: input.tweetUrl,
        tags: parsed.tags,
        heroMentioned,
        vetsMentioned,
        status: "published",
        publishedAt: /* @__PURE__ */ new Date()
      });
      return { success: true, title: parsed.title, slug };
    })
  }),
  mvs: router({
    list: publicProcedure.input(z3.object({ limit: z3.number().int().positive().max(50).optional() }).optional()).query(async ({ input }) => {
      return getMvsContentList(input?.limit ?? 20);
    }),
    save: protectedProcedure.input(z3.object({
      tweetId: z3.string().min(1),
      tweetUrl: z3.string().min(1),
      author: z3.string().min(1),
      authorHandle: z3.string().min(1),
      content: z3.string().min(1),
      weekLabel: z3.string().optional(),
      farmYields: z3.string().optional(),
      heroPrice: z3.string().optional(),
      vetsPrice: z3.string().optional(),
      mediaUrls: z3.string().optional()
    })).mutation(async ({ input }) => {
      const existing = await getMvsContentByTweetId(input.tweetId);
      if (existing) return { success: false, message: "Already saved" };
      await saveMvsContent(input);
      return { success: true };
    })
  }),
  media: router({
    list: publicProcedure.input(z3.object({
      category: z3.enum(["instructional", "photos", "memories", "memes", "announcements", "nfts"]).optional(),
      limit: z3.number().int().positive().max(100).optional()
    }).optional()).query(async ({ input }) => {
      if (input?.category) {
        return getMediaPostsByCategory(input.category, input?.limit ?? 50);
      }
      return getAllMediaPosts(input?.limit ?? 50);
    }),
    myPosts: protectedProcedure.query(async ({ ctx }) => {
      return getMediaPostsByUser(ctx.user.id);
    }),
    upload: protectedProcedure.input(z3.object({
      walletAddress: ethAddressSchema,
      category: z3.enum(["instructional", "photos", "memories", "memes", "announcements", "nfts"]),
      title: safeStringSchema(500).pipe(z3.string().min(1)),
      description: safeStringSchema(2e3).optional(),
      mediaType: z3.enum(["image", "video", "nft"]),
      fileBase64: z3.string().min(1).max(7e7),
      fileName: z3.string().min(1).max(255).regex(/^[a-zA-Z0-9._\-\s]+$/, "Invalid filename"),
      contentType: z3.string().min(1).max(100).regex(/^(image|video)\/(jpeg|jpg|png|gif|webp|mp4|webm|mov)$/, "Invalid content type"),
      fileSizeMb: z3.number().positive().max(50).optional(),
      nftContractAddress: ethAddressSchema.optional(),
      nftTokenId: z3.string().max(100).optional(),
      nftChainId: z3.number().int().optional(),
      nftCollectionName: z3.string().max(200).optional()
    })).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `media/${ctx.user.id}/${randomSuffix}-${safeFileName}`;
      const { url } = await storagePut(fileKey, buffer, input.contentType);
      await createMediaPost({
        userId: ctx.user.id,
        walletAddress: input.walletAddress,
        authorName: ctx.user.name || "Anonymous",
        category: input.category,
        title: input.title,
        description: input.description || null,
        mediaType: input.mediaType,
        mediaUrl: url,
        mediaKey: fileKey,
        fileSizeMb: input.fileSizeMb?.toString() || null,
        nftContractAddress: input.nftContractAddress || null,
        nftTokenId: input.nftTokenId || null,
        nftChainId: input.nftChainId || null,
        nftCollectionName: input.nftCollectionName || null
      });
      return { success: true, url };
    }),
    shareNft: protectedProcedure.input(z3.object({
      walletAddress: ethAddressSchema,
      title: safeStringSchema(500).pipe(z3.string().min(1)),
      description: safeStringSchema(2e3).optional(),
      nftImageUrl: z3.string().url().refine((u) => u.startsWith("https://"), "Must be HTTPS URL"),
      nftContractAddress: ethAddressSchema,
      nftTokenId: z3.string().min(1).max(100),
      nftChainId: z3.number().int(),
      nftCollectionName: z3.string().max(200).optional()
    })).mutation(async ({ ctx, input }) => {
      await createMediaPost({
        userId: ctx.user.id,
        walletAddress: input.walletAddress,
        authorName: ctx.user.name || "Anonymous",
        category: "nfts",
        title: input.title,
        description: input.description || null,
        mediaType: "nft",
        mediaUrl: input.nftImageUrl,
        mediaKey: `nft/${input.nftContractAddress}/${input.nftTokenId}`,
        nftContractAddress: input.nftContractAddress,
        nftTokenId: input.nftTokenId,
        nftChainId: input.nftChainId,
        nftCollectionName: input.nftCollectionName || null
      });
      return { success: true };
    }),
    delete: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await deleteMediaPost(input.id, ctx.user.id);
      return { success: true };
    })
  }),
  prices: router({
    overview: publicProcedure.input(z3.object({ chain: z3.enum(["pulsechain", "base"]).optional() }).optional()).query(async ({ input }) => {
      return getMarketOverview(input?.chain || "pulsechain");
    }),
    ticker: publicProcedure.input(z3.object({ chain: z3.enum(["pulsechain", "base"]).optional() }).optional()).query(async ({ input }) => {
      const chain = input?.chain || "pulsechain";
      if (chain === "base") {
        const [basePairs, ethPrice2, extraTokens2] = await Promise.all([
          fetchBaseTokenPrices(),
          fetchEthPrice(),
          fetchBaseTickerTokens()
        ]);
        const heroPair2 = basePairs[0];
        const fmt2 = (p) => p ? { price: p.priceUsd || "0", change24h: p.priceChange?.h24 || 0 } : null;
        return {
          hero: heroPair2 ? { price: heroPair2.priceUsd || "0", change24h: heroPair2.priceChange?.h24 || 0 } : null,
          eth: ethPrice2 ? { price: ethPrice2.priceUsd, change24h: ethPrice2.priceChange24h } : null,
          jesse: fmt2(extraTokens2.jesse),
          aero: fmt2(extraTokens2.aero),
          brett: fmt2(extraTokens2.brett),
          updatedAt: Date.now()
        };
      }
      const [tokenData, plsPrice, ethPrice, extraTokens] = await Promise.all([
        fetchTokenPrices(),
        fetchPlsPrice(),
        fetchEthPrice(),
        fetchPulsechainTickerTokens()
      ]);
      const heroPair = tokenData.heroPairs[0];
      const vetsPair = tokenData.vetsPairs[0];
      const fmt = (p) => p ? { price: p.priceUsd || "0", change24h: p.priceChange?.h24 || 0 } : null;
      return {
        hero: heroPair ? { price: heroPair.priceUsd || "0", change24h: heroPair.priceChange?.h24 || 0 } : null,
        vets: vetsPair ? { price: vetsPair.priceUsd || "0", change24h: vetsPair.priceChange?.h24 || 0 } : null,
        pls: plsPrice ? { price: plsPrice.priceUsd, change24h: plsPrice.priceChange24h } : null,
        eth: ethPrice ? { price: ethPrice.priceUsd, change24h: ethPrice.priceChange24h } : null,
        emit: fmt(extraTokens.emit),
        rhino: fmt(extraTokens.rhino),
        truFarm: fmt(extraTokens.truFarm),
        updatedAt: Date.now()
      };
    }),
    basePairs: publicProcedure.query(async () => {
      const pairs = await fetchBaseTokenPrices();
      return pairs.map((p) => ({
        pairAddress: p.pairAddress,
        baseSymbol: p.baseToken.symbol,
        quoteSymbol: p.quoteToken.symbol,
        priceUsd: p.priceUsd || "0",
        liquidity: p.liquidity?.usd || 0,
        volume24h: p.volume?.h24 || 0,
        priceChange24h: p.priceChange?.h24 || 0
      }));
    }),
    search: publicProcedure.input(z3.object({ query: z3.string().min(1).max(100) })).query(async ({ input }) => {
      return searchPairs(input.query);
    }),
    farmPools: publicProcedure.input(z3.object({ chain: z3.enum(["pulsechain", "base"]).optional() }).optional()).query(async ({ input }) => {
      return fetchFarmPoolData(input?.chain || "pulsechain");
    }),
    buyAndBurn: publicProcedure.query(async () => {
      return fetchBuyAndBurnData();
    })
  }),
  dao: router({
    stats: publicProcedure.query(async () => {
      const [allProposals, activeDelegates, treasury] = await Promise.all([
        getProposals(void 0, 1e3),
        getDelegates(1e3),
        getLatestTreasurySnapshots()
      ]);
      const active = allProposals.filter((p) => p.status === "active").length;
      const passed = allProposals.filter((p) => p.status === "passed" || p.status === "executed").length;
      const totalVotingPower = activeDelegates.reduce((sum, d) => sum + (d.votingPower || 0), 0);
      const totalTreasuryUsd = treasury.reduce((sum, t2) => sum + parseFloat(t2.valueUsd || "0"), 0);
      return {
        totalProposals: allProposals.length,
        activeProposals: active,
        passedProposals: passed,
        totalDelegates: activeDelegates.length,
        totalVotingPower,
        treasuryValueUsd: totalTreasuryUsd
      };
    }),
    proposals: router({
      list: publicProcedure.input(z3.object({ status: z3.string().optional(), limit: z3.number().int().positive().max(100).optional() }).optional()).query(async ({ input }) => {
        return getProposals(input?.status, input?.limit ?? 50);
      }),
      get: publicProcedure.input(z3.object({ proposalId: z3.string().min(1) })).query(async ({ input }) => {
        return getProposalById(input.proposalId);
      }),
      create: protectedProcedure.input(z3.object({
        title: safeStringSchema(512),
        description: safeStringSchema(1e4),
        walletAddress: ethAddressSchema,
        chain: z3.enum(["base", "pulsechain", "both"]).optional(),
        category: z3.enum(["protocol", "treasury", "community", "emergency"]).optional(),
        durationDays: z3.number().int().min(1).max(30).optional(),
        confirmBinding: z3.boolean().optional()
      })).mutation(async ({ ctx, input }) => {
        if (ctx.user.walletAddress) {
          if (input.walletAddress.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
            routerLogger.warn("Wallet mismatch on proposal creation", {
              userId: ctx.user.id,
              expected: ctx.user.walletAddress,
              received: input.walletAddress
            });
            createStandardError("FORBIDDEN", "Wallet address does not match authenticated user");
          }
        } else {
          if (!input.confirmBinding) {
            return {
              success: false,
              requiresConfirmation: true,
              message: "This will permanently bind this wallet to your account. Set confirmBinding: true to proceed.",
              walletAddress: input.walletAddress
            };
          }
          await updateUserWalletAddress(ctx.user.id, input.walletAddress);
          routerLogger.info("Wallet bound to user on proposal creation", {
            userId: ctx.user.id,
            walletAddress: input.walletAddress
          });
        }
        const proposalId = "HERO-" + Date.now().toString(36).toUpperCase();
        const rateCheck = await atomicRateLimitAndRecord(ctx.user.id, proposalId, input.walletAddress, 3);
        if (!rateCheck.allowed) {
          routerLogger.warn("Proposal rate limit exceeded (atomic)", {
            userId: ctx.user.id,
            count: rateCheck.count,
            walletAddress: input.walletAddress
          });
          createStandardError("TOO_MANY_REQUESTS", "Rate limited: maximum 3 proposals per 24 hours");
        }
        const now = /* @__PURE__ */ new Date();
        const durationMs = (input.durationDays || 7) * 24 * 60 * 60 * 1e3;
        const endTime = new Date(now.getTime() + durationMs);
        const snapshotBlock = Number(await (input.chain === "base" ? baseClient : pulsechainClient).getBlockNumber());
        const contentHash = generateProposalHash(
          proposalId,
          input.title,
          input.description,
          input.walletAddress,
          input.chain || "both",
          now,
          endTime
        );
        await createProposal({
          proposalId,
          title: input.title,
          description: input.description,
          proposerId: ctx.user.id,
          proposerAddress: input.walletAddress,
          chain: input.chain || "both",
          category: input.category || "protocol",
          startTime: now,
          endTime,
          snapshotBlock
        });
        let anchorTxHash = null;
        try {
          anchorTxHash = await anchorProposalOnChain(proposalId, contentHash, endTime);
          if (anchorTxHash) {
            const anchored = await getProposalById(proposalId);
            if (anchored) {
              await updateProposal(anchored.id, { anchoredOnChain: true, anchorTxHash });
            }
          }
        } catch (err) {
          console.warn("[DAO] On-chain anchoring failed (non-blocking):", err);
        }
        return { success: true, proposalId, contentHash, anchorTxHash };
      }),
      updateStatus: protectedProcedure.input(z3.object({
        proposalId: z3.string().min(1),
        status: z3.enum(["pending", "active", "passed", "defeated", "queued", "executed", "cancelled"])
      })).mutation(async ({ ctx, input }) => {
        const proposal = await getProposalById(input.proposalId);
        if (!proposal) createStandardError("NOT_FOUND", "Proposal not found");
        if (proposal.proposerId !== ctx.user.id) {
          createStandardError("FORBIDDEN", "Only the proposal creator may update its status");
        }
        await updateProposal(proposal.id, { status: input.status });
        return { success: true };
      })
    }),
    votes: router({
      list: publicProcedure.input(z3.object({ proposalDbId: z3.number().int().positive() })).query(async ({ input }) => {
        return getVotesByProposal(input.proposalDbId);
      }),
      myVote: protectedProcedure.input(z3.object({ proposalDbId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
        return getUserVote(input.proposalDbId, ctx.user.id);
      }),
      cast: protectedProcedure.input(z3.object({
        proposalDbId: z3.number().int().positive(),
        proposalId: z3.string().min(1),
        voterAddress: ethAddressSchema,
        choice: z3.enum(["for", "against", "abstain"]),
        votingPower: z3.number().int().positive().max(1e9),
        chain: z3.enum(["base", "pulsechain"]),
        txHash: txHashSchema2
      })).mutation(async ({ ctx, input }) => {
        if (ctx.user.walletAddress) {
          if (input.voterAddress.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
            createStandardError("FORBIDDEN", "Voter address does not match authenticated user's wallet");
          }
        } else {
          await updateUserWalletAddress(ctx.user.id, input.voterAddress);
          routerLogger.info("Wallet bound to user on vote cast", {
            userId: ctx.user.id,
            walletAddress: input.voterAddress,
            proposalId: input.proposalId
          });
        }
        const existing = await getUserVote(input.proposalDbId, ctx.user.id);
        if (existing) createStandardError("BAD_REQUEST", "Already voted on this proposal");
        const proposal = await getProposalById(input.proposalId);
        if (!proposal) createStandardError("NOT_FOUND", "Proposal not found");
        const verifiedPower = await verifyVotingPower(input.voterAddress, input.chain, proposal.snapshotBlock);
        if (verifiedPower <= 0) createStandardError("PRECONDITION_FAILED", "No HERO tokens found \u2014 cannot vote");
        const trustedPower = Math.min(input.votingPower, verifiedPower);
        await castVote({
          proposalId: input.proposalDbId,
          voterId: ctx.user.id,
          voterAddress: input.voterAddress,
          choice: input.choice,
          votingPower: trustedPower,
          chain: input.chain,
          txHash: input.txHash || null
        });
        if (proposal) {
          const newFor = input.choice === "for" ? proposal.votesFor + trustedPower : proposal.votesFor;
          const newAgainst = input.choice === "against" ? proposal.votesAgainst + trustedPower : proposal.votesAgainst;
          const newAbstain = input.choice === "abstain" ? proposal.votesAbstain + trustedPower : proposal.votesAbstain;
          await updateProposalVotes(input.proposalId, newFor, newAgainst, newAbstain);
        }
        return { success: true };
      })
    }),
    delegates: router({
      list: publicProcedure.input(z3.object({ limit: z3.number().int().positive().max(100).optional() }).optional()).query(async ({ input }) => {
        return getDelegates(input?.limit ?? 50);
      }),
      byAddress: publicProcedure.input(z3.object({ address: ethAddressSchema })).query(async ({ input }) => {
        return getDelegateByAddress(input.address);
      }),
      register: protectedProcedure.input(z3.object({
        address: ethAddressSchema,
        displayName: safeStringSchema(128).optional(),
        statement: safeStringSchema(5e3).optional()
      })).mutation(async ({ ctx, input }) => {
        const existing = await getDelegateByAddress(input.address);
        if (existing) createStandardError("BAD_REQUEST", "Already registered as delegate");
        await registerDelegate({
          userId: ctx.user.id,
          address: input.address,
          displayName: input.displayName || null,
          statement: input.statement || null
        });
        return { success: true };
      }),
      update: protectedProcedure.input(z3.object({
        address: ethAddressSchema,
        displayName: safeStringSchema(128).optional(),
        statement: safeStringSchema(5e3).optional()
      })).mutation(async ({ ctx, input }) => {
        const delegate = await getDelegateByAddress(input.address);
        if (!delegate) createStandardError("NOT_FOUND", "Delegate not found");
        if (delegate.userId !== ctx.user.id) {
          createStandardError("FORBIDDEN", "Only the delegate owner may update this profile");
        }
        await updateDelegate(delegate.id, {
          displayName: input.displayName || delegate.displayName,
          statement: input.statement || delegate.statement
        });
        return { success: true };
      })
    }),
    delegations: router({
      myDelegations: protectedProcedure.query(async ({ ctx }) => {
        return getDelegationsByDelegator(ctx.user.id);
      }),
      receivedDelegations: protectedProcedure.input(z3.object({ delegateId: z3.number().int().positive() })).query(async ({ input }) => {
        return getDelegationsByDelegate(input.delegateId);
      }),
      create: protectedProcedure.input(z3.object({
        delegatorAddress: ethAddressSchema,
        delegateAddress: ethAddressSchema,
        amount: z3.number().int().positive().max(1e9),
        chain: z3.enum(["base", "pulsechain"]),
        txHash: txHashSchema2,
        confirmBinding: z3.boolean().optional()
      })).mutation(async ({ ctx, input }) => {
        if (ctx.user.walletAddress && input.delegatorAddress.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
          routerLogger.warn("Wallet mismatch on delegation", {
            userId: ctx.user.id,
            expected: ctx.user.walletAddress,
            received: input.delegatorAddress
          });
          createStandardError("FORBIDDEN", "Delegator address does not match authenticated user's wallet");
        } else if (!ctx.user.walletAddress) {
          if (!input.confirmBinding) {
            return {
              success: false,
              requiresConfirmation: true,
              message: "This will permanently bind this wallet to your account. Set confirmBinding: true to proceed.",
              walletAddress: input.delegatorAddress
            };
          }
          await updateUserWalletAddress(ctx.user.id, input.delegatorAddress);
          routerLogger.info("Wallet bound to user on delegation", {
            userId: ctx.user.id,
            walletAddress: input.delegatorAddress
          });
        }
        const delegate = await getDelegateByAddress(input.delegateAddress);
        if (!delegate) createStandardError("NOT_FOUND", "Delegate not found");
        await createDelegation({
          delegatorId: ctx.user.id,
          delegatorAddress: input.delegatorAddress,
          delegateId: delegate.id,
          delegateAddress: input.delegateAddress,
          amount: input.amount,
          chain: input.chain,
          txHash: input.txHash || null
        });
        await atomicIncrementDelegateStats(delegate.id, input.amount);
        return { success: true };
      }),
      revoke: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await revokeDelegation(input.id, ctx.user.id);
        return { success: true };
      })
    }),
    treasury: router({
      snapshots: publicProcedure.input(z3.object({ chain: z3.string().optional() }).optional()).query(async ({ input }) => {
        return getLatestTreasurySnapshots(input?.chain);
      }),
      record: protectedProcedure.input(z3.object({
        chain: z3.enum(["base", "pulsechain"]),
        tokenSymbol: tokenSymbolSchema,
        tokenAddress: ethAddressSchema,
        balance: z3.string().regex(/^\d+\.?\d*$/, "Invalid balance"),
        valueUsd: z3.string().regex(/^\d+\.?\d*$/, "Invalid USD value").optional()
      })).mutation(async ({ input }) => {
        await saveTreasurySnapshot(input);
        return { success: true };
      })
    }),
    snapshot: router({
      proposals: publicProcedure.input(z3.object({ limit: z3.number().int().positive().max(50).optional() }).optional()).query(async ({ input }) => fetchSnapshotProposals(input?.limit ?? 20)),
      proposal: publicProcedure.input(z3.object({ id: z3.string().regex(/^[A-Za-z0-9_-]{1,128}$/) })).query(async ({ input }) => fetchSnapshotProposalById(input.id)),
      spaceInfo: publicProcedure.query(() => ({
        spaceId: "hero-dao.eth",
        url: "https://snapshot.org/#/hero-dao.eth",
        network: "1",
        strategies: ["erc20-balance-of"]
      }))
    })
  }),
  ai: router({
    chat: publicProcedure.input(z3.object({
      message: z3.string().min(1).max(5e3),
      chainContext: z3.string().optional(),
      history: z3.array(z3.object({
        role: z3.enum(["user", "assistant"]),
        content: z3.string()
      })).max(20).optional()
    })).mutation(async ({ input }) => {
      const systemPrompt = `You are the HERO AI Assistant, a crypto market analyst specializing in $HERO and $VETS tokens on PulseChain and BASE networks. You are built for the VIC Foundation, a 501(c)(3) nonprofit supporting military veterans and first responders through DeFi.

Key knowledge:
- $HERO on PulseChain: 0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27
- $HERO on BASE: 0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8
- $VETS on PulseChain: 0x4013abBf94A745EfA7cc848989Ee83424A770060
- Partner farms: Emit Farm (HERO/EMIT, HERO/PLS, VETS/EMIT), RhinoFi (HERO/RHINO), TruFarms (TruFarm/HERO)
- DEXs: PulseX V1/V2, 9inch, Liberty Swap (PulseChain); Uniswap V3, Aerodrome, BaseSwap (BASE)

Current chain context: ${input.chainContext || "PulseChain"}

Be helpful, accurate, and concise. Use markdown formatting. Always include disclaimers that this is not financial advice. Be bullish but honest about $HERO and $VETS. Detect and warn about potential scams when asked. Keep responses under 500 words unless detailed analysis is requested.

IMPORTANT: If a user asks for help, support, has questions you cannot answer, or needs to speak with the team, ALWAYS direct them to the official Telegram community: https://t.me/VetsInCrypto/1 \u2014 Say something like "For further assistance or to connect with the HERO community, join our Telegram: https://t.me/VetsInCrypto/1" Include this link whenever someone asks for help, support, or community resources.`;
      const messages = [
        { role: "system", content: systemPrompt }
      ];
      if (input.history) {
        for (const msg of input.history) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      messages.push({ role: "user", content: input.message });
      const response = await invokeLLM({ messages });
      const reply = typeof response.choices[0].message.content === "string" ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content);
      return { reply: reply || "I couldn't generate a response. Please try again." };
    })
  }),
  // ─── Influencer Mentions (Twitter/X Tracking) ──────────────────
  influencer: router({
    /** Public: list mentions with optional category filter */
    list: publicProcedure.input(z3.object({
      category: z3.enum(["influencer", "community", "press", "partner"]).optional(),
      limit: z3.number().int().positive().max(100).optional(),
      offset: z3.number().int().min(0).optional()
    }).optional()).query(async ({ input }) => {
      return getInfluencerMentions({
        category: input?.category,
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0
      });
    }),
    /** Public: get mention stats (counts by category) */
    stats: publicProcedure.query(async () => {
      return getInfluencerMentionStats();
    }),
    /** Protected: trigger a manual fetch from Twitter API */
    refresh: protectedProcedure.mutation(async () => {
      const restId = await getHeroRestId();
      if (!restId) {
        return { success: false, message: "Could not resolve @HERO501c3 Twitter ID. API rate limit may be hit.", fetched: 0, newCount: 0, alertsSent: 0 };
      }
      const tweets = await fetchHeroTweets(restId, 40);
      let newCount = 0;
      let alertsSent = 0;
      for (const tweet of tweets) {
        const existing = await getInfluencerMentionByTweetId(tweet.tweetId);
        const isNew = !existing;
        await upsertInfluencerMention(toDbRecord(tweet));
        if (isNew) {
          newCount++;
          const sent = await alertNewMention(tweet);
          if (sent) alertsSent++;
        }
      }
      return { success: true, message: `Fetched ${tweets.length} tweets, ${newCount} new, ${alertsSent} alerts sent.`, fetched: tweets.length, newCount, alertsSent };
    }),
    /** Public: get scheduler status */
    schedulerStatus: publicProcedure.query(() => {
      return getSchedulerStatus();
    }),
    /** Protected (admin): toggle pin on a mention */
    togglePin: adminProcedure.input(z3.object({
      id: z3.number().int().positive(),
      isPinned: z3.boolean()
    })).mutation(async ({ input }) => {
      await toggleMentionPinned(input.id, input.isPinned);
      return { success: true };
    }),
    /** Protected (admin): toggle highlight on a mention */
    toggleHighlight: adminProcedure.input(z3.object({
      id: z3.number().int().positive(),
      isHighlighted: z3.boolean()
    })).mutation(async ({ input }) => {
      await toggleMentionHighlight(input.id, input.isHighlighted);
      return { success: true };
    }),
    /** Protected (admin): hide/unhide a mention */
    toggleHidden: adminProcedure.input(z3.object({
      id: z3.number().int().positive(),
      isHidden: z3.boolean()
    })).mutation(async ({ input }) => {
      await toggleMentionHidden(input.id, input.isHidden);
      return { success: true };
    }),
    /** Protected (admin): update mention category */
    updateCategory: adminProcedure.input(z3.object({
      id: z3.number().int().positive(),
      category: z3.enum(["influencer", "community", "press", "partner"])
    })).mutation(async ({ input }) => {
      await updateMentionCategory(input.id, input.category);
      return { success: true };
    }),
    /** Protected: manually add a mention (for press/partner entries) */
    addManual: protectedProcedure.input(z3.object({
      tweetId: z3.string().min(1).max(30),
      authorUsername: z3.string().min(1).max(100),
      authorDisplayName: z3.string().max(200).optional(),
      authorFollowerCount: z3.number().int().min(0).optional(),
      tweetText: safeStringSchema(5e3),
      tweetUrl: z3.string().url().max(500),
      category: z3.enum(["influencer", "community", "press", "partner"]),
      heroMentioned: z3.boolean().optional(),
      vetsMentioned: z3.boolean().optional()
    })).mutation(async ({ input }) => {
      await upsertInfluencerMention({
        tweetId: input.tweetId,
        authorUsername: input.authorUsername,
        authorDisplayName: input.authorDisplayName || input.authorUsername,
        authorFollowerCount: input.authorFollowerCount || 0,
        tweetText: input.tweetText,
        tweetUrl: input.tweetUrl,
        mentionType: "direct_mention",
        category: input.category,
        heroMentioned: input.heroMentioned ?? true,
        vetsMentioned: input.vetsMentioned ?? false,
        sentiment: "positive",
        isHighlighted: false,
        isHidden: false
      });
      return { success: true };
    })
  }),
  // ─── Spin Wheel Router ─────────────────────────────────────────────────────
  // Reward mutations remain fail-closed in production until the records are
  // persisted and an audited distributor signer/on-chain burn verifier exists.
  spin: router({
    canSpin: publicProcedure.input(z3.object({ wallet: ethAddressSchema })).query(async ({ input }) => {
      const productionRewardsAvailable = process.env.NODE_ENV !== "production";
      const record = spinRecordsV2.get(input.wallet.toLowerCase()) || null;
      const eligible = productionRewardsAvailable && canSpinTodayV2(record);
      const streak = record?.currentStreak || 0;
      const bonus = getStreakBonusV2(streak);
      const nftTier = await getHeroCardsTier(input.wallet) || record?.nftTier || "bronze";
      const canBurn = false;
      return {
        serviceAvailable: productionRewardsAvailable,
        serviceMessage: productionRewardsAvailable ? void 0 : "Reward spins are temporarily offline while persistent records and the audited claim distributor are completed.",
        eligible,
        streak,
        bonus,
        totalSpins: record?.totalSpins || 0,
        nftTier,
        canBurnForSpin: canBurn,
        burnCost: "0",
        nextSpinAt: productionRewardsAvailable && !eligible ? new Date((/* @__PURE__ */ new Date()).setHours(24, 0, 0, 0)).toISOString() : void 0
      };
    }),
    execute: protectedProcedure.input(z3.object({
      wallet: ethAddressSchema,
      chain: z3.enum(["pulsechain", "base"]).optional(),
      burnForSecondSpin: z3.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      const key = input.wallet.toLowerCase();
      const boundWallet = ctx.user.walletAddress?.toLowerCase();
      if (!boundWallet) {
        createStandardError("PRECONDITION_FAILED", "Bind this wallet to your signed-in account before spinning.");
      }
      if (boundWallet !== key) {
        createStandardError("FORBIDDEN", "The connected wallet does not match the signed-in account.");
      }
      if (process.env.NODE_ENV === "production") {
        createStandardError(
          "PRECONDITION_FAILED",
          "Reward spins are temporarily offline while persistent records and the audited claim distributor are completed."
        );
      }
      if (input.burnForSecondSpin) {
        createStandardError(
          "PRECONDITION_FAILED",
          "Burn-for-spin is disabled until an on-chain burn receipt verifier is deployed."
        );
      }
      if (!checkSpinRateLimit(input.wallet)) {
        createStandardError("TOO_MANY_REQUESTS", "Too many spin attempts. Please wait a moment.");
      }
      const clientIp = ctx.req.headers["cf-connecting-ip"] || ctx.req.socket.remoteAddress || "unknown";
      const ipSpinKey = `ip_spin_${Array.isArray(clientIp) ? clientIp[0] : clientIp}`;
      if (!checkRateLimit(ipSpinKey, 20)) {
        createStandardError("TOO_MANY_REQUESTS", "IP rate limit exceeded");
      }
      const record = spinRecordsV2.get(key) || null;
      if (!canSpinTodayV2(record)) {
        createStandardError("TOO_MANY_REQUESTS", "Already spun today. Come back tomorrow.");
      }
      const nftTier = await getHeroCardsTier(input.wallet) || record?.nftTier || "bronze";
      routerLogger.info("Spin V2 execute", { wallet: key, tier: nftTier, streak: record?.currentStreak || 0 });
      let result;
      try {
        result = await performSpinV2(input.wallet, record, nftTier, input.chain || "pulsechain");
      } catch (error) {
        routerLogger.error("Spin V2 RNG failure", {
          wallet: key,
          error: error instanceof Error ? error.message : String(error)
        });
        createStandardError("INTERNAL_SERVER_ERROR", "Spin failed \u2014 please try again.");
      }
      result.claimable = false;
      result.claimId = void 0;
      const updated = updateSpinRecordV2(record, input.wallet, result);
      spinRecordsV2.set(key, updated);
      updateLeaderboard(key, updated);
      return result;
    }),
    claim: protectedProcedure.input(z3.object({
      wallet: ethAddressSchema,
      claimId: z3.string().min(1),
      spinTimestamp: z3.number()
    })).mutation(({ ctx, input }) => {
      const boundWallet = ctx.user.walletAddress?.toLowerCase();
      if (!boundWallet || boundWallet !== input.wallet.toLowerCase()) {
        createStandardError("FORBIDDEN", "The connected wallet does not match the signed-in account.");
      }
      createStandardError(
        "PRECONDITION_FAILED",
        "On-chain reward claims are disabled until the audited distributor signer is deployed."
      );
    }),
    history: publicProcedure.input(z3.object({ wallet: ethAddressSchema })).query(({ input }) => {
      const record = spinRecordsV2.get(input.wallet.toLowerCase());
      return {
        history: record?.history || [],
        stats: {
          totalSpins: record?.totalSpins || 0,
          currentStreak: record?.currentStreak || 0,
          longestStreak: record?.longestStreak || 0,
          totalHeroEarned: record?.totalHeroEarned || 0,
          totalBurned: record?.totalBurned || 0,
          nftTier: record?.nftTier || "bronze"
        }
      };
    }),
    leaderboard: publicProcedure.query(() => {
      return Array.from(leaderboardCache.values()).sort((a, b) => b.currentStreak - a.currentStreak).slice(0, 20);
    }),
    verify: publicProcedure.input(z3.object({ wallet: ethAddressSchema, spinTimestamp: z3.number() })).query(({ input }) => {
      const record = spinRecordsV2.get(input.wallet.toLowerCase());
      const spin = record?.history.find((h) => h.spinTimestamp === input.spinTimestamp);
      if (!spin) return { verified: false, message: "Spin not found" };
      return {
        verified: true,
        proof: {
          blockHash: spin.rngProof.blockHash,
          blockNumber: spin.rngProof.blockNumber,
          seed: spin.rngProof.seed,
          proofHash: spin.rngProof.proofHash,
          chain: spin.rngProof.chain,
          timestamp: spin.rngProof.timestamp,
          value: spin.rngProof.value
        },
        result: {
          segmentId: spin.segmentId,
          segmentLabel: spin.segmentLabel,
          multiplier: spin.multiplier,
          finalReward: spin.finalRewardValue
        }
      };
    }),
    wheel: publicProcedure.input(z3.object({ wallet: ethAddressSchema.optional() })).query(({ input }) => {
      const tier = input.wallet ? spinRecordsV2.get(input.wallet.toLowerCase())?.nftTier || "bronze" : "bronze";
      return { tier, segments: getWheelForTierV2(tier) };
    })
  }),
  // ─── Raffle/Giveaway Router ────────────────────────────────────────────────
  raffle: router({
    list: publicProcedure.query(() => {
      return Array.from(activeRaffles.values()).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        prize: r.prize,
        prizeValue: r.prizeValue,
        status: r.status,
        startTime: r.startTime,
        endTime: r.endTime,
        entries: r.entries.length,
        maxEntries: r.maxEntries,
        winnerCount: r.winnerCount,
        winners: r.winners || []
      }));
    }),
    enter: protectedProcedure.input(z3.object({ raffleId: z3.string().min(1), wallet: ethAddressSchema, heroBalance: z3.string() })).mutation(({ ctx, input }) => {
      if (ctx.user.walletAddress && input.wallet.toLowerCase() !== ctx.user.walletAddress.toLowerCase()) {
        createStandardError("FORBIDDEN", "Wallet address does not match authenticated user");
      }
      const raffle = activeRaffles.get(input.raffleId);
      if (!raffle) createStandardError("NOT_FOUND", "Raffle not found");
      const entry = enterRaffle(raffle, input.wallet, BigInt(input.heroBalance));
      return { success: true, enteredAt: entry.enteredAt };
    }),
    draw: adminProcedure.input(z3.object({ raffleId: z3.string().min(1) })).mutation(async ({ input }) => {
      const raffle = activeRaffles.get(input.raffleId);
      if (!raffle) createStandardError("NOT_FOUND", "Raffle not found");
      const result = await drawRaffleWinners(raffle);
      activeRaffles.set(input.raffleId, { ...raffle, status: "completed", winners: result.winners });
      return result;
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      // Block @reown/appkit - forces WalletConnect to use @walletconnect/modal 2.7.0
      // which calls explorer-api.walletconnect.com (works with our project ID)
      "@reown/appkit": path.resolve(import.meta.dirname, "client", "src", "lib", "empty-module.ts"),
      "@reown/appkit-controllers": path.resolve(import.meta.dirname, "client", "src", "lib", "empty-module.ts"),
      "@reown/appkit-core": path.resolve(import.meta.dirname, "client", "src", "lib", "empty-module.ts"),
      "@reown/appkit-utils": path.resolve(import.meta.dirname, "client", "src", "lib", "empty-module.ts"),
      "@reown/appkit-wallet": path.resolve(import.meta.dirname, "client", "src", "lib", "empty-module.ts")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    cssCodeSplit: true,
    modulePreload: false,
    manifest: true,
    rollupOptions: {
      // Belt-and-suspenders: mark @reown as external so Rollup never bundles it
      // even if Vite alias fails to intercept a dynamic import.
      // Let Rollup preserve the DappBootstrap dynamic boundary automatically;
      // broad manual chunks can create cycles that preload the full DApp on `/`.
      external: (id) => id.includes("@reown/appkit")
    }
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use("/assets", express.static(path2.join(distPath, "assets"), {
    maxAge: "365d",
    immutable: true,
    etag: false,
    lastModified: false
  }));
  app.use(express.static(distPath, {
    maxAge: "1h",
    etag: true
  }));
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/security.ts
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto2 from "crypto";
import { parse as parseCookie } from "cookie";
function cspNonceMiddleware(req, res, next) {
  const nonce = crypto2.randomBytes(16).toString("base64");
  res.locals.cspNonce = nonce;
  next();
}
var ALLOWED_ORIGINS = /* @__PURE__ */ new Set([
  "https://www.herobase.io",
  "https://herobase.io",
  "https://herodapp-kcdtjud9.manus.space"
]);
function getClientIp(req) {
  const cfRay = req.headers["cf-ray"];
  if (cfRay) {
    return req.headers["cf-connecting-ip"] || req.headers["x-real-ip"] || req.ip || "unknown";
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}
function createLimiter(opts) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: opts.message },
    validate: false,
    keyGenerator: getClientIp,
    skip: (req) => {
      const ip = getClientIp(req);
      return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
    },
    skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
    skipFailedRequests: opts.skipFailedRequests ?? false
  });
}
function buildCspDirectives() {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] : ["'self'"];
  const connectSrc = [
    "'self'",
    "https://rpc.pulsechain.com",
    "https://mainnet.base.org",
    "https://api.dexscreener.com",
    "wss://relay.walletconnect.com",
    "wss://relay.walletconnect.org",
    "https://*.walletconnect.com",
    "https://*.walletconnect.org",
    "https://*.reown.com",
    "https://*.manus.computer",
    "https://*.manus.space",
    "https://api.manus.im",
    "https://switch.win",
    "https://*.switch.win",
    ...isDev ? ["ws:", "wss:"] : []
  ];
  return {
    defaultSrc: ["'self'"],
    scriptSrc,
    styleSrc: ["'self'", "'unsafe-inline'"],
    fontSrc: ["'self'", "data:"],
    imgSrc: ["'self'", "data:", "blob:", "https:", "https://*.manus.computer", "https://*.manus.space"],
    connectSrc,
    frameSrc: ["'self'", "https://*.walletconnect.com", "https://*.walletconnect.org", "https://app.safe.global", "https://app.squirrelswap.pro", "https://*.squirrelswap.pro", "https://transferto.xyz", "https://*.transferto.xyz", "https://www.youtube.com", "https://youtube.com", "https://libertyswap.finance", "https://switch.win", "https://*.switch.win"],
    mediaSrc: ["'self'", "https:", "blob:"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'", "https://app.safe.global"],
    ...isDev ? {} : { upgradeInsecureRequests: [] }
  };
}
function setupHelmet(app) {
  app.use(cspNonceMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: buildCspDirectives()
      },
      strictTransportSecurity: {
        maxAge: 31536e3,
        includeSubDomains: true,
        preload: true
      },
      // AUDIT CONSIDERATION RESOLVED: Tightened CORP to same-site (was cross-origin)
      // Assets that need cross-origin (fonts, CDN) are served via Cloudflare with proper CORS
      crossOriginEmbedderPolicy: { policy: "credentialless" },
      crossOriginResourcePolicy: { policy: "same-site" },
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      // AUDIT FIX: Consolidated X-Frame-Options into Helmet (was split with manual header)
      xFrameOptions: { action: "sameorigin" },
      xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
      xPoweredBy: false,
      xXssProtection: true
    })
  );
}
var globalLimiter = createLimiter({
  windowMs: 60 * 1e3,
  max: 200,
  message: "Too many requests from this IP. Please slow down."
});
var generalApiLimiter = createLimiter({
  windowMs: 60 * 1e3,
  max: 100,
  message: "Too many API requests. Please try again later."
});
var authLimiter = createLimiter({
  windowMs: 60 * 1e3,
  max: 15,
  message: "Too many authentication attempts. Please wait before trying again.",
  skipSuccessfulRequests: false
});
var aiChatLimiter = createLimiter({
  windowMs: 60 * 1e3,
  max: 10,
  message: "AI rate limit reached. Please wait before sending more messages."
});
var mediaUploadLimiter = createLimiter({
  windowMs: 60 * 1e3,
  max: 5,
  message: "Upload limit reached. Please wait before uploading more files."
});
var daoProposalLimiter = createLimiter({
  windowMs: 5 * 60 * 1e3,
  max: 10,
  message: "Proposal creation limit reached. Please wait before submitting more proposals."
});
var daoVoteLimiter = createLimiter({
  windowMs: 60 * 1e3,
  max: 20,
  message: "Voting rate limit reached. Please wait before casting more votes."
});
var priceFeedLimiter = createLimiter({
  windowMs: 60 * 1e3,
  max: 60,
  message: "Price data rate limit reached. Data refreshes every 30 seconds."
});
var walletLimiter = createLimiter({
  windowMs: 60 * 1e3,
  max: 30,
  message: "Too many wallet requests. Please try again later."
});
function csrfOriginValidation(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const origin = req.headers["origin"];
  const referer = req.headers["referer"];
  if (process.env.NODE_ENV === "development") {
    return next();
  }
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
    }
  }
  if (requestOrigin) {
    if (!ALLOWED_ORIGINS.has(requestOrigin)) {
      recordBadRequest(getClientIp(req));
      console.warn(`[CSRF] Blocked cross-origin request from: ${requestOrigin} to ${req.path}`);
      res.status(403).json({ error: "Cross-origin request blocked." });
      return;
    }
  }
  if (origin === "null") {
    recordBadRequest(getClientIp(req));
    console.warn(`[CSRF] Blocked null-origin request to ${req.path}`);
    res.status(403).json({ error: "Cross-origin request blocked." });
    return;
  }
  if (!requestOrigin && !origin && !referer) {
    const cfRay = req.headers["cf-ray"];
    if (!cfRay && process.env.NODE_ENV === "production") {
      recordBadRequest(getClientIp(req));
      console.warn(`[CSRF] Blocked: No origin/referer/cf-ray on state-changing request to ${req.path}`);
      res.status(403).json({ error: "Request origin could not be verified." });
      return;
    }
  }
  next();
}
function sanitizeRequestBody(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }
  next();
}
function sanitizeQueryParams(req, _res, next) {
  if (req.query && typeof req.query === "object") {
    for (const key of Object.keys(req.query)) {
      const value = req.query[key];
      if (typeof value === "string") {
        req.query[key] = sanitizeString(value);
      } else if (Array.isArray(value)) {
        req.query[key] = value.map(
          (v) => typeof v === "string" ? sanitizeString(v) : v
        );
      }
    }
  }
  next();
}
var DANGEROUS_HEADER_PATTERNS = [/<script/i, /javascript:/i, /on\w+\s*=/i];
function sanitizeHeaders(req, _res, next) {
  for (const key of Object.keys(req.headers)) {
    if (key.startsWith("x-") && key !== "x-real-ip" && key !== "x-forwarded-for") {
      const val = req.headers[key];
      if (typeof val === "string") {
        for (const pattern of DANGEROUS_HEADER_PATTERNS) {
          if (pattern.test(val)) {
            delete req.headers[key];
            break;
          }
        }
      }
    }
  }
  next();
}
function sanitizeObject(obj, seen = /* @__PURE__ */ new WeakSet()) {
  if (seen.has(obj)) return;
  seen.add(obj);
  for (const key of Object.keys(obj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      delete obj[key];
      continue;
    }
    const value = obj[key];
    if (typeof value === "string") {
      obj[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === "string") {
          value[i] = sanitizeString(value[i]);
        } else if (value[i] && typeof value[i] === "object") {
          sanitizeObject(value[i], seen);
        }
      }
    } else if (value && typeof value === "object") {
      sanitizeObject(value, seen);
    }
  }
}
function sanitizeString(input) {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/on\w+\s*=\s*["'][^"']*["']/gi, "").replace(/on\w+\s*=\s*[^\s>]*/gi, "").replace(/javascript\s*:/gi, "").replace(/data\s*:\s*text\/html/gi, "").replace(/<(iframe|object|embed|applet)\b[^>]*>/gi, "").replace(/<\/(iframe|object|embed|applet)>/gi, "").replace(/expression\s*\(/gi, "").replace(/<svg\b[^>]*\bon\w+\s*=/gi, "<svg ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").trim();
}
function cloudflareSecurityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
}
function validateCloudflareOrigin(req, _res, next) {
  const cfRay = req.headers["cf-ray"];
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  if (cfRay || cfConnectingIp) {
    return next();
  }
  next();
}
function requestSizeGuard(maxBytes) {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > maxBytes) {
      res.status(413).json({ error: "Request payload too large." });
      return;
    }
    next();
  };
}
function blockSuspiciousRequests(req, res, next) {
  const suspiciousPatterns = [
    /\.\.\//,
    // Path traversal
    /\/etc\/passwd/i,
    // Linux file access
    /\/proc\/self/i,
    // Proc filesystem
    /<script/i,
    // XSS in URL
    /union\s+select/i,
    // SQL injection
    /;\s*drop\s+table/i,
    // SQL injection
    /\bexec\s*\(/i,
    // Command injection
    /\beval\s*\(/i,
    // Code injection
    /0x[0-9a-f]{20,}/i,
    // Hex-encoded payloads (not ETH addresses — those are 40 chars)
    /\bor\s+1\s*=\s*1/i,
    // SQL injection (OR 1=1)
    /\band\s+1\s*=\s*1/i,
    // SQL injection (AND 1=1)
    /\/\.env/i,
    // Environment file access
    /\/\.git/i,
    // Git directory access
    /\/wp-admin/i,
    // WordPress admin probing
    /\/phpMyAdmin/i
    // phpMyAdmin probing
  ];
  const fullUrl = req.originalUrl || req.url;
  for (const pattern of suspiciousPatterns) {
    if (pattern.source.includes("0x") && fullUrl.includes("/api/trpc")) {
      continue;
    }
    if (pattern.test(fullUrl)) {
      const ip = getClientIp(req);
      recordBadRequest(ip);
      console.warn(`[Security] Blocked suspicious request: ${req.method} ${fullUrl} from ${ip}`);
      res.status(400).json({ error: "Bad request." });
      return;
    }
  }
  next();
}
var ipReputationMap = /* @__PURE__ */ new Map();
var IP_REPUTATION_WINDOW = 10 * 60 * 1e3;
var IP_MAX_STRIKES = 5;
var IP_BLOCK_MULTIPLIER = 60 * 1e3;
setInterval(() => {
  const now = Date.now();
  for (const [ip, rep] of ipReputationMap.entries()) {
    if (now - rep.lastStrike > IP_REPUTATION_WINDOW && rep.blockedUntil < now) {
      ipReputationMap.delete(ip);
    }
  }
}, 5 * 60 * 1e3);
function recordBadRequest(ip) {
  const now = Date.now();
  const rep = ipReputationMap.get(ip) || { strikes: 0, lastStrike: 0, blockedUntil: 0 };
  if (now - rep.lastStrike > IP_REPUTATION_WINDOW) {
    rep.strikes = 0;
  }
  rep.strikes++;
  rep.lastStrike = now;
  if (rep.strikes >= IP_MAX_STRIKES) {
    rep.blockedUntil = now + rep.strikes * IP_BLOCK_MULTIPLIER;
    console.warn(`[Security] IP ${ip} blocked for ${rep.strikes} minutes (${rep.strikes} strikes)`);
  }
  ipReputationMap.set(ip, rep);
}
function ipReputationGuard(req, res, next) {
  const ip = getClientIp(req);
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
    next();
    return;
  }
  const rep = ipReputationMap.get(ip);
  if (rep && rep.blockedUntil > Date.now()) {
    const retryAfter = Math.ceil((rep.blockedUntil - Date.now()) / 1e3);
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ error: "Too many bad requests. You are temporarily blocked.", retryAfter });
    return;
  }
  next();
}
function schemaPreValidator(req, res, next) {
  if (req.method !== "POST" || !req.path.includes("/api/trpc")) {
    return next();
  }
  const body = req.body;
  if (body === void 0 || body === null) {
    return next();
  }
  if (typeof body !== "object") {
    recordBadRequest(getClientIp(req));
    res.status(400).json({ error: "Invalid request body format." });
    return;
  }
  const MAX_DEPTH = 10;
  function checkDepth(obj, depth) {
    if (depth > MAX_DEPTH) return false;
    if (obj && typeof obj === "object") {
      for (const val of Object.values(obj)) {
        if (!checkDepth(val, depth + 1)) return false;
      }
    }
    return true;
  }
  if (!checkDepth(body, 0)) {
    recordBadRequest(getClientIp(req));
    res.status(400).json({ error: "Request body too deeply nested." });
    return;
  }
  next();
}
function trpcRouteLimiter(req, res, next) {
  const url = req.originalUrl || req.url;
  if (url.includes("assistant.chat") || url.includes("assistant.stream")) {
    return aiChatLimiter(req, res, next);
  }
  if (url.includes("media.upload") || url.includes("media.create")) {
    return mediaUploadLimiter(req, res, next);
  }
  if (url.includes("dao.createProposal") || url.includes("dao.create")) {
    return daoProposalLimiter(req, res, next);
  }
  if (url.includes("dao.vote") || url.includes("dao.castVote")) {
    return daoVoteLimiter(req, res, next);
  }
  if (url.includes("prices.") || url.includes("buyAndBurn") || url.includes("farmPools")) {
    return priceFeedLimiter(req, res, next);
  }
  return generalApiLimiter(req, res, next);
}
var BOT_UA_PATTERNS = [
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /puppeteer/i,
  /playwright/i,
  /python-requests/i,
  /go-http-client/i,
  /java\/[0-9]/i,
  /wget/i,
  /curl\/[0-9]/i,
  /scrapy/i,
  /httpclient/i
];
function botDetectionMiddleware(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  if (!ua && req.path.startsWith("/api")) {
    recordBadRequest(getClientIp(req));
    return next();
  }
  for (const pattern of BOT_UA_PATTERNS) {
    if (pattern.test(ua)) {
      const ip = getClientIp(req);
      recordBadRequest(ip);
      console.warn(`[BotDetect] Suspicious UA from ${ip}: ${ua.slice(0, 80)}`);
      break;
    }
  }
  next();
}
function setupSecurity(app) {
  app.set("trust proxy", 1);
  app.use(ipReputationGuard);
  app.use(blockSuspiciousRequests);
  app.use(globalLimiter);
  setupHelmet(app);
  app.use(cloudflareSecurityHeaders);
  app.use(validateCloudflareOrigin);
  app.use("/api", csrfOriginValidation);
  app.use("/api", csrfDoubleSubmitProtection);
  app.use(sanitizeHeaders);
  app.use(sanitizeQueryParams);
  app.use("/api/trpc", schemaPreValidator);
  app.use("/api/trpc", trpcRouteLimiter);
  app.use("/api/oauth", authLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api/trpc", userMutationLimiter);
  app.use(sanitizeRequestBody);
  app.use("/api/trpc", requestSizeGuard(1 * 1024 * 1024));
  app.use("/api/oauth", requestSizeGuard(64 * 1024));
  app.use(botDetectionMiddleware);
}
function securityAuditLog(event, data) {
  console.log(JSON.stringify({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level: "info",
    module: "security-audit",
    event,
    ...data
  }));
}
function csrfDoubleSubmitProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const _getCookies = parseCookie(req.headers.cookie || "");
    if (!_getCookies.csrf_token) {
      const token = crypto2.randomBytes(32).toString("hex");
      res.cookie("csrf_token", token, {
        httpOnly: false,
        // Client JS needs to read it
        secure: true,
        sameSite: "strict",
        maxAge: 864e5
        // 24h
      });
    }
    return next();
  }
  const _postCookies = parseCookie(req.headers.cookie || "");
  const cookieToken = _postCookies.csrf_token;
  const headerToken = req.headers["x-csrf-token"];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    securityAuditLog("csrf_validation_failed", {
      ip: getClientIp(req),
      path: req.path,
      method: req.method,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken
    });
    return res.status(403).json({ error: "CSRF validation failed" });
  }
  next();
}
function createUserRateLimiter(opts) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    keyGenerator: (req) => {
      return req.user?.id?.toString() || getClientIp(req);
    },
    message: { error: opts.message },
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: false
  });
}
var userApiLimiter = createUserRateLimiter({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 30,
  // 30 requests per minute per user
  message: "Too many requests from this account. Please wait."
});
var userMutationLimiter = createUserRateLimiter({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 10,
  // 10 mutations per minute per user
  message: "Too many write operations. Please slow down."
});

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  app.disable("x-powered-by");
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.use(compression());
  setupSecurity(app);
  initTrpcRateLimiter(getDb);
  await ensureRateLimitTable();
  registerOAuthRoutes(app);
  registerStandaloneAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startMentionScheduler();
  });
}
startServer().catch(console.error);
