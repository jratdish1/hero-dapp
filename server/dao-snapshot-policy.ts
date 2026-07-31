export type ProposalChain = "base" | "pulsechain" | "both";
export type VoteChain = Exclude<ProposalChain, "both">;

export interface SnapshotRecord {
  chain: ProposalChain;
  governanceMode: "advisory" | "binding";
  snapshotBaseBlock: number | null;
  snapshotPulsechainBlock: number | null;
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

export function snapshotBlockForChain(record: SnapshotRecord, chain: VoteChain): number {
  if (record.governanceMode !== "binding") throw new Error("Proposal is advisory and has no binding snapshot");
  const block = chain === "base" ? record.snapshotBaseBlock : record.snapshotPulsechainBlock;
  if (!Number.isSafeInteger(block) || Number(block) <= 0) throw new Error(`Missing trustworthy ${chain} snapshot block`);
  return Number(block);
}
