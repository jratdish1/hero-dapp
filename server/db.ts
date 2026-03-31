import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  dcaOrders,
  limitOrders,
  swapHistory,
  watchlist,
  blogPosts,
  mvsContent,
  mediaPosts,
  proposals,
  votes,
  delegates,
  delegations,
  treasurySnapshots,
  chainDataCache,
  type InsertDcaOrder,
  type InsertLimitOrder,
  type InsertSwapHistory,
  type InsertWatchlist,
  type InsertBlogPost,
  type InsertMvsContent,
  type InsertMediaPost,
  type InsertProposal,
  type InsertVote,
  type InsertDelegate,
  type InsertDelegation,
  type InsertTreasurySnapshot,
  type InsertChainDataCache,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// --- DCA Orders ---
export async function createDcaOrder(order: InsertDcaOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(dcaOrders).values(order);
  return result;
}

export async function getDcaOrdersByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dcaOrders).where(eq(dcaOrders.userId, userId)).orderBy(desc(dcaOrders.createdAt));
}

export async function updateDcaOrderStatus(orderId: number, userId: number, status: "active" | "paused" | "completed" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(dcaOrders).set({ status }).where(and(eq(dcaOrders.id, orderId), eq(dcaOrders.userId, userId)));
}

// --- Limit Orders ---
export async function createLimitOrder(order: InsertLimitOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(limitOrders).values(order);
}

export async function getLimitOrdersByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(limitOrders).where(eq(limitOrders.userId, userId)).orderBy(desc(limitOrders.createdAt));
}

export async function cancelLimitOrder(orderId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(limitOrders).set({ status: "cancelled" }).where(and(eq(limitOrders.id, orderId), eq(limitOrders.userId, userId)));
}

// --- Swap History ---
export async function recordSwap(entry: InsertSwapHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(swapHistory).values(entry);
}

export async function getSwapHistoryByWallet(walletAddress: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(swapHistory).where(eq(swapHistory.walletAddress, walletAddress)).orderBy(desc(swapHistory.createdAt)).limit(limit);
}

// --- Watchlist ---
export async function addToWatchlist(entry: InsertWatchlist) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(watchlist).values(entry);
}

export async function getWatchlistByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watchlist).where(eq(watchlist.userId, userId));
}

export async function removeFromWatchlist(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
}

// --- Blog Posts ---
export async function createBlogPost(post: InsertBlogPost) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(blogPosts).values(post);
}

export async function getPublishedBlogPosts(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blogPosts).where(eq(blogPosts.status, "published")).orderBy(desc(blogPosts.publishedAt)).limit(limit);
}

export async function getBlogPostBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllBlogPosts(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt)).limit(limit);
}

export async function updateBlogPost(id: number, data: Partial<InsertBlogPost>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(blogPosts).set(data).where(eq(blogPosts.id, id));
}

// --- MVS Content ---
export async function saveMvsContent(entry: InsertMvsContent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(mvsContent).values(entry);
}

export async function getMvsContentList(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mvsContent).orderBy(desc(mvsContent.createdAt)).limit(limit);
}

export async function getMvsContentByTweetId(tweetId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(mvsContent).where(eq(mvsContent.tweetId, tweetId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// --- Media Posts ---
export async function createMediaPost(post: InsertMediaPost) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(mediaPosts).values(post);
}

export async function getMediaPostsByCategory(
  category: "instructional" | "photos" | "memories" | "memes" | "announcements" | "nfts",
  limit = 50
) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaPosts)
    .where(and(eq(mediaPosts.category, category), eq(mediaPosts.status, "active")))
    .orderBy(desc(mediaPosts.createdAt))
    .limit(limit);
}

export async function getAllMediaPosts(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaPosts)
    .where(eq(mediaPosts.status, "active"))
    .orderBy(desc(mediaPosts.createdAt))
    .limit(limit);
}

export async function getMediaPostsByUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaPosts)
    .where(eq(mediaPosts.userId, userId))
    .orderBy(desc(mediaPosts.createdAt))
    .limit(limit);
}

export async function deleteMediaPost(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mediaPosts).set({ status: "removed" })
    .where(and(eq(mediaPosts.id, id), eq(mediaPosts.userId, userId)));
}

// ─── DAO Governance Helpers ──────────────────────────────────────

// --- Proposals ---
export async function createProposal(proposal: InsertProposal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(proposals).values(proposal);
}

export async function getProposals(status?: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(proposals)
      .where(eq(proposals.status, status as any))
      .orderBy(desc(proposals.createdAt))
      .limit(limit);
  }
  return db.select().from(proposals).orderBy(desc(proposals.createdAt)).limit(limit);
}

export async function getProposalById(proposalId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(proposals).where(eq(proposals.proposalId, proposalId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateProposal(id: number, data: Partial<InsertProposal>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(proposals).set(data).where(eq(proposals.id, id));
}

export async function updateProposalVotes(proposalId: string, votesFor: number, votesAgainst: number, votesAbstain: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(proposals).set({ votesFor, votesAgainst, votesAbstain }).where(eq(proposals.proposalId, proposalId));
}

// --- Votes ---
export async function castVote(vote: InsertVote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(votes).values(vote);
}

export async function getVotesByProposal(proposalId: number, limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(votes).where(eq(votes.proposalId, proposalId)).orderBy(desc(votes.createdAt)).limit(limit);
}

export async function getUserVote(proposalId: number, voterId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(votes)
    .where(and(eq(votes.proposalId, proposalId), eq(votes.voterId, voterId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// --- Delegates ---
export async function registerDelegate(delegate: InsertDelegate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(delegates).values(delegate);
}

export async function getDelegates(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(delegates)
    .where(eq(delegates.isActive, true))
    .orderBy(desc(delegates.votingPower))
    .limit(limit);
}

export async function getDelegateByAddress(address: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(delegates).where(eq(delegates.address, address)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateDelegate(id: number, data: Partial<InsertDelegate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(delegates).set(data).where(eq(delegates.id, id));
}

// --- Delegations ---
export async function createDelegation(delegation: InsertDelegation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(delegations).values(delegation);
}

export async function getDelegationsByDelegator(delegatorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(delegations)
    .where(and(eq(delegations.delegatorId, delegatorId), eq(delegations.isActive, true)))
    .orderBy(desc(delegations.createdAt));
}

export async function getDelegationsByDelegate(delegateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(delegations)
    .where(and(eq(delegations.delegateId, delegateId), eq(delegations.isActive, true)))
    .orderBy(desc(delegations.createdAt));
}

export async function revokeDelegation(id: number, delegatorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(delegations).set({ isActive: false })
    .where(and(eq(delegations.id, id), eq(delegations.delegatorId, delegatorId)));
}

// --- Treasury Snapshots ---
export async function saveTreasurySnapshot(snapshot: InsertTreasurySnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(treasurySnapshots).values(snapshot);
}

export async function getLatestTreasurySnapshots(chain?: string) {
  const db = await getDb();
  if (!db) return [];
  if (chain) {
    return db.select().from(treasurySnapshots)
      .where(eq(treasurySnapshots.chain, chain as any))
      .orderBy(desc(treasurySnapshots.snapshotAt))
      .limit(20);
  }
  return db.select().from(treasurySnapshots).orderBy(desc(treasurySnapshots.snapshotAt)).limit(40);
}

// --- Chain Data Cache ---
export async function getCachedChainData(chain: string, dataKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(chainDataCache)
    .where(and(eq(chainDataCache.chain, chain as any), eq(chainDataCache.dataKey, dataKey)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function setCachedChainData(chain: string, dataKey: string, dataValue: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getCachedChainData(chain, dataKey);
  if (existing) {
    await db.update(chainDataCache).set({ dataValue }).where(eq(chainDataCache.id, existing.id));
  } else {
    await db.insert(chainDataCache).values({ chain: chain as any, dataKey, dataValue });
  }
}
