import { createHash } from "node:crypto";

export type ProposalChain = "base" | "pulsechain" | "both";
export type VoteChain = Exclude<ProposalChain, "both">;

export interface SnapshotRecord {
  chain: ProposalChain;
  governanceMode: "advisory" | "binding";
  snapshotVersion: number;
  snapshotConfirmations: number | null;
  snapshotBaseBlock: number | null;
  snapshotPulsechainBlock: number | null;
  snapshotBaseTotalSupply: string | null;
  snapshotPulsechainTotalSupply: string | null;
  snapshotVerifiedAt: Date | string | null;
  bindingDisabledReason: string | null;
}

export interface VoteableProposalRecord {
  status: string;
  startTime: Date | string;
  endTime: Date | string;
}

export interface VerifiedBindingSnapshot {
  block: number;
  confirmations: number;
  totalSupplyRaw: string;
}

export interface SnapshotCommitmentInput extends SnapshotRecord {
  baseContentHash: string;
  quorum: number;
}

export function requireBindingVotingEnabled(value: string | undefined): void {
  if (value !== "true") {
    throw new Error("Binding DAO voting is feature-fenced until snapshot capability is enabled");
  }
}

export function parseFinalityBlocks(value: string | undefined, fallback: bigint): bigint {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^[0-9]+$/.test(value)) throw new Error("Finality depth must be a positive integer");
  const parsed = BigInt(value);
  if (parsed < 1n || parsed > 10_000n) throw new Error("Finality depth is outside the approved range");
  return parsed;
}

export function finalizedPriorBlock(head: bigint, confirmations: bigint): bigint {
  if (confirmations < 1n) throw new Error("At least one confirmation is required");
  if (head <= confirmations) throw new Error("Chain head is too young for a finalized prior snapshot");
  return head - confirmations;
}

export function resolveBindingVoteChain(proposalChain: ProposalChain, requested: VoteChain): VoteChain {
  if (proposalChain === "both") {
    throw new Error("Binding multi-chain proposals must be split into chain-specific proposals");
  }
  if (proposalChain !== requested) {
    throw new Error(`Vote chain ${requested} does not match proposal chain ${proposalChain}`);
  }
  return proposalChain;
}

export function assertProposalVoteable(
  record: VoteableProposalRecord,
  at: Date = new Date(),
): void {
  const startTime = new Date(record.startTime);
  const endTime = new Date(record.endTime);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
    throw new Error("Proposal has an invalid voting window");
  }
  if (record.status !== "active") {
    throw new Error(`Proposal status is ${record.status}; voting requires active status`);
  }
  if (at < startTime) {
    throw new Error("Voting has not started");
  }
  if (at > endTime) {
    throw new Error("Voting period has ended");
  }
}

export function assertBindingSnapshotMetadata(
  record: SnapshotRecord,
  chain: VoteChain,
): VerifiedBindingSnapshot {
  if (record.governanceMode !== "binding") {
    throw new Error("Proposal is advisory and has no binding snapshot");
  }
  if (record.chain === "both" || record.chain !== chain) {
    throw new Error(`Binding snapshot chain ${record.chain} does not match vote chain ${chain}`);
  }
  if (record.snapshotVersion !== 2) {
    throw new Error("Binding proposal does not use the approved snapshot version");
  }
  if (!Number.isSafeInteger(record.snapshotConfirmations) || Number(record.snapshotConfirmations) < 1) {
    throw new Error("Binding proposal is missing an approved finality receipt");
  }
  if (!record.snapshotVerifiedAt || Number.isNaN(new Date(record.snapshotVerifiedAt).getTime())) {
    throw new Error("Binding proposal is missing a verified snapshot timestamp");
  }
  if (record.bindingDisabledReason !== null) {
    throw new Error("Binding proposal is disabled and must fail closed");
  }

  const block = chain === "base" ? record.snapshotBaseBlock : record.snapshotPulsechainBlock;
  const totalSupplyRaw = chain === "base"
    ? record.snapshotBaseTotalSupply
    : record.snapshotPulsechainTotalSupply;
  const otherBlock = chain === "base" ? record.snapshotPulsechainBlock : record.snapshotBaseBlock;
  const otherSupply = chain === "base"
    ? record.snapshotPulsechainTotalSupply
    : record.snapshotBaseTotalSupply;

  if (otherBlock !== null || otherSupply !== null) {
    throw new Error("Binding proposal contains conflicting cross-chain snapshot metadata");
  }
  if (!Number.isSafeInteger(block) || Number(block) <= 0) {
    throw new Error(`Missing trustworthy ${chain} snapshot block`);
  }
  if (!totalSupplyRaw || !/^[0-9]+$/.test(totalSupplyRaw) || BigInt(totalSupplyRaw) <= 0n) {
    throw new Error(`Missing trustworthy ${chain} historical total supply`);
  }

  return {
    block: Number(block),
    confirmations: Number(record.snapshotConfirmations),
    totalSupplyRaw,
  };
}

export function snapshotBlockForChain(record: SnapshotRecord, chain: VoteChain): number {
  return assertBindingSnapshotMetadata(record, chain).block;
}

/**
 * Bind the historical snapshot policy to the proposal's existing content hash.
 * The returned digest is the value anchored on-chain. Any change to mode,
 * chain, block, supply, finality, verification time, quorum, or disable state
 * produces a different commitment.
 */
export function generateProposalSnapshotCommitment(input: SnapshotCommitmentInput): string {
  if (!/^[0-9a-f]{64}$/i.test(input.baseContentHash)) {
    throw new Error("Proposal base content hash is invalid");
  }
  if (!Number.isSafeInteger(input.quorum) || input.quorum < 1) {
    throw new Error("Proposal quorum is invalid");
  }

  let verifiedAt: string | null = null;
  if (input.governanceMode === "binding") {
    const chain = resolveBindingVoteChain(input.chain, input.chain as VoteChain);
    assertBindingSnapshotMetadata(input, chain);
    verifiedAt = new Date(input.snapshotVerifiedAt as Date | string).toISOString();
  } else {
    if (input.snapshotVersion !== 1) {
      throw new Error("Advisory proposal must use snapshot version 1");
    }
    if (
      input.snapshotConfirmations !== null
      || input.snapshotBaseBlock !== null
      || input.snapshotPulsechainBlock !== null
      || input.snapshotBaseTotalSupply !== null
      || input.snapshotPulsechainTotalSupply !== null
      || input.snapshotVerifiedAt !== null
    ) {
      throw new Error("Advisory proposal must not carry binding snapshot metadata");
    }
    if (!input.bindingDisabledReason?.trim()) {
      throw new Error("Advisory proposal must record why binding is disabled");
    }
  }

  const canonicalPayload = JSON.stringify({
    domain: "HERO_DAO_SNAPSHOT_v2",
    baseContentHash: input.baseContentHash.toLowerCase(),
    governanceMode: input.governanceMode,
    chain: input.chain,
    snapshotVersion: input.snapshotVersion,
    snapshotConfirmations: input.snapshotConfirmations,
    snapshotBaseBlock: input.snapshotBaseBlock,
    snapshotPulsechainBlock: input.snapshotPulsechainBlock,
    snapshotBaseTotalSupply: input.snapshotBaseTotalSupply,
    snapshotPulsechainTotalSupply: input.snapshotPulsechainTotalSupply,
    snapshotVerifiedAt: verifiedAt,
    bindingDisabledReason: input.bindingDisabledReason,
    quorum: input.quorum,
  });

  return createHash("sha256").update(canonicalPayload).digest("hex");
}
