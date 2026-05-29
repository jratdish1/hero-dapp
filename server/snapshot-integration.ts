/**
 * Snapshot GraphQL Integration for HERO DAO
 * 
 * Fetches proposals from the hero-dao.eth Snapshot space
 * and provides them to the frontend via tRPC endpoints.
 * 
 * @module snapshot-integration
 * @security No secrets required - read-only public GraphQL API
 */

import { daoLogger } from "./dao-structured-logger";

const SNAPSHOT_HUB = "https://hub.snapshot.org/graphql";
const SPACE_ID = "hero-dao.eth";

interface SnapshotProposal {
  id: string;
  title: string;
  body: string;
  choices: string[];
  start: number;
  end: number;
  snapshot: string;
  state: string;
  scores: number[];
  scores_total: number;
  votes: number;
  author: string;
  created: number;
  type: string;
  space: { id: string; name: string };
}

interface NormalizedProposal {
  proposalId: string;
  title: string;
  description: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalVotes: number;
  createdAt: string;
  endTime: string;
  proposerAddress: string;
  category: string;
  chain: string;
  source: "snapshot";
  snapshotUrl: string;
}

/**
 * Maps Snapshot state to our internal status format
 */
function mapSnapshotState(state: string): string {
  switch (state) {
    case "active": return "active";
    case "pending": return "pending";
    case "closed": return "passed"; // We'll refine based on scores
    default: return state;
  }
}

/**
 * Fetches proposals from Snapshot GraphQL API
 */
export async function fetchSnapshotProposals(limit = 20): Promise<NormalizedProposal[]> {
  const query = `
    query {
      proposals(
        first: ${limit},
        skip: 0,
        where: { space_in: ["${SPACE_ID}"] },
        orderBy: "created",
        orderDirection: desc
      ) {
        id
        title
        body
        choices
        start
        end
        snapshot
        state
        scores
        scores_total
        votes
        author
        created
        type
        space { id name }
      }
    }
  `;

  try {
    const response = await fetch(SNAPSHOT_HUB, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      daoLogger.error("snapshot_fetch_failed", { status: response.status });
      return [];
    }

    const data = await response.json();
    const proposals: SnapshotProposal[] = data?.data?.proposals || [];

    return proposals.map((p) => {
      // Determine final status for closed proposals
      let status = mapSnapshotState(p.state);
      if (p.state === "closed") {
        const forVotes = p.scores[0] || 0;
        const againstVotes = p.scores[1] || 0;
        status = forVotes > againstVotes ? "passed" : "defeated";
      }

      return {
        proposalId: `SNAP-${p.id.slice(0, 8)}`,
        title: p.title,
        description: p.body,
        status,
        votesFor: Math.round(p.scores[0] || 0),
        votesAgainst: Math.round(p.scores[1] || 0),
        votesAbstain: Math.round(p.scores[2] || 0),
        totalVotes: p.votes,
        createdAt: new Date(p.created * 1000).toISOString(),
        endTime: new Date(p.end * 1000).toISOString(),
        proposerAddress: p.author,
        category: "protocol",
        chain: "both",
        source: "snapshot" as const,
        snapshotUrl: `https://snapshot.org/#/${SPACE_ID}/proposal/${p.id}`,
      };
    });
  } catch (error) {
    daoLogger.error("snapshot_integration_error", { error: String(error) });
    return [];
  }
}

/**
 * Fetches a single proposal by its Snapshot ID
 */
export async function fetchSnapshotProposalById(snapshotId: string): Promise<NormalizedProposal | null> {
  const query = `
    query {
      proposal(id: "${snapshotId}") {
        id
        title
        body
        choices
        start
        end
        snapshot
        state
        scores
        scores_total
        votes
        author
        created
        type
        space { id name }
      }
    }
  `;

  try {
    const response = await fetch(SNAPSHOT_HUB, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const p = data?.data?.proposal;
    if (!p) return null;

    let status = mapSnapshotState(p.state);
    if (p.state === "closed") {
      const forVotes = p.scores[0] || 0;
      const againstVotes = p.scores[1] || 0;
      status = forVotes > againstVotes ? "passed" : "defeated";
    }

    return {
      proposalId: `SNAP-${p.id.slice(0, 8)}`,
      title: p.title,
      description: p.body,
      status,
      votesFor: Math.round(p.scores[0] || 0),
      votesAgainst: Math.round(p.scores[1] || 0),
      votesAbstain: Math.round(p.scores[2] || 0),
      totalVotes: p.votes,
      createdAt: new Date(p.created * 1000).toISOString(),
      endTime: new Date(p.end * 1000).toISOString(),
      proposerAddress: p.author,
      category: "protocol",
      chain: "both",
      source: "snapshot" as const,
      snapshotUrl: `https://snapshot.org/#/${SPACE_ID}/proposal/${p.id}`,
    };
  } catch (error) {
    daoLogger.error("snapshot_proposal_fetch_error", { error: String(error) });
    return null;
  }
}
