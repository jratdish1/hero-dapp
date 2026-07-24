/**
 * Read-only Snapshot GraphQL integration for HERO DAO.
 */
import { createDaoLogger } from "./dao-logger";

const daoLogger = createDaoLogger("snapshot-integration");
const SNAPSHOT_HUB = "https://hub.snapshot.org/graphql";
const SPACE_ID = "hero-dao.eth";
const SNAPSHOT_TIMEOUT_MS = 10_000;

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

export interface NormalizedProposal {
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

interface SnapshotGraphqlEnvelope<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

function mapSnapshotState(state: string): string {
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

function normalizeProposal(proposal: SnapshotProposal): NormalizedProposal {
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
    createdAt: new Date(proposal.created * 1000).toISOString(),
    endTime: new Date(proposal.end * 1000).toISOString(),
    proposerAddress: proposal.author,
    category: "protocol",
    chain: "both",
    source: "snapshot",
    snapshotUrl: `https://snapshot.org/#/${SPACE_ID}/proposal/${encodeURIComponent(proposal.id)}`,
  };
}

async function querySnapshot<T>(
  operation: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  try {
    const response = await fetch(SNAPSHOT_HUB, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
    });

    if (!response.ok) {
      daoLogger.error("snapshot_fetch_failed", {
        operation,
        status: response.status,
      });
      return null;
    }

    const envelope = (await response.json()) as SnapshotGraphqlEnvelope<T>;
    if (envelope.errors?.length || !envelope.data) {
      daoLogger.warn("snapshot_graphql_error", {
        operation,
        errors: envelope.errors?.map((error) => error.message || "unknown") || [],
      });
      return null;
    }

    return envelope.data;
  } catch (error) {
    daoLogger.error("snapshot_request_error", {
      operation,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function fetchSnapshotProposals(limit = 20): Promise<NormalizedProposal[]> {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const data = await querySnapshot<{ proposals: SnapshotProposal[] }>(
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
    { first: boundedLimit, space: SPACE_ID },
  );

  return (data?.proposals || []).map(normalizeProposal);
}

export async function fetchSnapshotProposalById(
  snapshotId: string,
): Promise<NormalizedProposal | null> {
  const data = await querySnapshot<{ proposal: SnapshotProposal | null }>(
    "get_proposal",
    `query GetProposal($id: String!) {
      proposal(id: $id) {
        id title body choices start end snapshot state scores scores_total votes
        author created type space { id name }
      }
    }`,
    { id: snapshotId },
  );

  return data?.proposal ? normalizeProposal(data.proposal) : null;
}
