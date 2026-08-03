/**
 * HERO DAO advisory-mode on-chain boundary.
 *
 * On-chain anchoring, finalization, timelocks, and execution reads are disabled
 * while governance is advisory. This module intentionally contains no wallet
 * client, private-key loading, transaction simulation, or transaction signing.
 * A later binding-governance change must replace this boundary in a separately
 * audited release with finalized snapshots and an approved execution contract.
 */

import { createDaoLogger } from "./dao-logger";
import { DAO_BINDING_DISABLED_REASON } from "./dao-governance-policy";

const anchorLogger = createDaoLogger("dao-anchor");

function recordDisabled(operation: string, proposalId?: string): null {
  anchorLogger.info("DAO on-chain operation blocked by advisory governance boundary", {
    operation,
    proposalId,
    reason: DAO_BINDING_DISABLED_REASON,
  });
  return null;
}

export async function anchorProposalOnChain(
  proposalId: string,
  _contentHash: string,
  _votingEndsAt: Date,
  _maxRetries: number = 0,
): Promise<string | null> {
  return recordDisabled("anchorProposal", proposalId);
}

export async function finalizeProposalOnChain(
  proposalId: string,
  _votesFor: number,
  _votesAgainst: number,
  _votesAbstain: number,
): Promise<string | null> {
  return recordDisabled("finalizeProposal", proposalId);
}

export async function isProposalExecutableOnChain(
  proposalId: string,
): Promise<boolean> {
  recordDisabled("isExecutable", proposalId);
  return false;
}

export async function getOnChainTimelockRemaining(
  proposalId: string,
): Promise<number> {
  recordDisabled("timelockRemaining", proposalId);
  return 0;
}

export async function verifyContentHashOnChain(
  proposalId: string,
  _contentHash: string,
): Promise<boolean> {
  recordDisabled("verifyContentHash", proposalId);
  return false;
}

export function isAnchoringEnabled(): boolean {
  return false;
}

export function getAnchorStatus(): {
  enabled: boolean;
  contractAddress: string;
  executorConfigured: boolean;
  disabledReason: string;
} {
  return {
    enabled: false,
    contractAddress: "0x0000000000000000000000000000000000000000",
    executorConfigured: false,
    disabledReason: DAO_BINDING_DISABLED_REASON,
  };
}
