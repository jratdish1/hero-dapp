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

export interface VerifiedBindingSnapshot {
  block: number;
  confirmations: number;
  totalSupplyRaw: string;
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
