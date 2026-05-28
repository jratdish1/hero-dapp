/**
 * HERO DAO — On-Chain Anchor Integration
 * ========================================
 * Production Condition #4: Wire up HeroDAOAnchor.anchorProposal() call after DB creation.
 *
 * This module provides the bridge between the off-chain DAO system and the
 * on-chain HeroDAOAnchor contract. It handles:
 * - Anchoring proposals on-chain after creation
 * - Finalizing proposals on-chain after voting ends
 * - Executing proposals after timelock expires
 *
 * ## Security Model
 * - Uses a server-side wallet (executor) to sign transactions.
 * - The executor private key is stored in environment variables.
 * - In production, this should be a multisig (Gnosis Safe) with a relay.
 * - All inputs are validated before on-chain calls.
 * - Retry with exponential backoff for transient failures.
 * - Non-blocking: anchor failures do not block proposal creation.
 *
 * ## Error Handling
 * | Scenario                | Behavior           | Rationale                              |
 * |-------------------------|--------------------|----------------------------------------|
 * | Invalid input           | Returns null + log | Prevents invalid on-chain calls        |
 * | Anchoring disabled      | Returns null       | Graceful degradation                   |
 * | Transaction failure     | Retry + log        | Transient RPC/gas issues               |
 * | All retries exhausted   | Returns null + log | Non-blocking to preserve availability  |
 * | Read function failure   | Returns default    | Best-effort for status checks          |
 *
 * @module dao-anchor-integration
 * @see dao-executor-config.ts — executor configuration
 * @see dao-security-hardening.ts — proposal hash generation
 */

import { createDaoLogger } from "./dao-logger";

const anchorLogger = createDaoLogger("dao-anchor");

import { createPublicClient, createWalletClient, http, keccak256, toHex, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { pulsechain } from "viem/chains";

// ─── Contract ABI (minimal — only what we need) ────────────────────────

const HERO_DAO_ANCHOR_ABI = [
  {
    name: "anchorProposal",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalIdHash", type: "bytes32" },
      { name: "contentHash", type: "bytes32" },
      { name: "votingEndsAt", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "finalizeProposal",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalIdHash", type: "bytes32" },
      { name: "votesFor", type: "uint256" },
      { name: "votesAgainst", type: "uint256" },
      { name: "votesAbstain", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "isExecutable",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalIdHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "timelockRemaining",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalIdHash", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "verifyContentHash",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "proposalIdHash", type: "bytes32" },
      { name: "expectedHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── Configuration ──────────────────────────────────────────────────────

interface AnchorConfig {
  /** HeroDAOAnchor contract address on PulseChain */
  contractAddress: `0x${string}`;
  /** Executor private key (for signing anchor transactions) */
  executorPrivateKey: `0x${string}`;
  /** RPC URL for PulseChain */
  rpcUrl: string;
  /** Whether on-chain anchoring is enabled */
  enabled: boolean;
}

function getConfig(): AnchorConfig {
  const contractAddress = process.env.DAO_ANCHOR_CONTRACT as `0x${string}` | undefined;
  const executorKey = process.env.DAO_EXECUTOR_PRIVATE_KEY as `0x${string}` | undefined;

  return {
    contractAddress: contractAddress || "0x0000000000000000000000000000000000000000",
    executorPrivateKey: executorKey || "0x0000000000000000000000000000000000000000000000000000000000000000",
    rpcUrl: process.env.PULSECHAIN_RPC_URL || "https://rpc.pulsechain.com",
    enabled: Boolean(contractAddress && executorKey && contractAddress !== "0x0000000000000000000000000000000000000000"),
  };
}

// ─── Clients ────────────────────────────────────────────────────────────

function getClients() {
  const config = getConfig();
  if (!config.enabled) return null;

  const account = privateKeyToAccount(config.executorPrivateKey);

  const publicClient = createPublicClient({
    chain: pulsechain,
    transport: http(config.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: pulsechain,
    transport: http(config.rpcUrl),
  });

  return { publicClient, walletClient, account, config };
}

// ─── Core Functions ─────────────────────────────────────────────────────

/**
 * Anchor a proposal on-chain after it's created in the database.
 * This creates a tamper-proof record of the proposal's content hash.
 * 
 * @param proposalId - The off-chain proposal ID (e.g., "HERO-M1234-ABCD1234")
 * @param contentHash - SHA-256 hash of proposal content (from dao-security-hardening.ts)
 * @param votingEndsAt - Unix timestamp when voting closes
 * @returns Transaction hash if successful, null if anchoring is disabled
 */
export async function anchorProposalOnChain(
  proposalId: string,
  contentHash: string,
  votingEndsAt: Date,
  maxRetries: number = 2
): Promise<string | null> {
  // Input validation: proposalId must match expected format
  if (!proposalId || !/^HERO-M\d+-[A-Za-z0-9]+$/.test(proposalId)) {
    anchorLogger.error("Invalid proposalId format", { proposalId });
    throw new Error(`Invalid proposalId format: ${proposalId}`);
  }
  // Input validation: contentHash must be a 64-char hex string (SHA-256)
  if (!contentHash || !/^[a-fA-F0-9]{64}$/.test(contentHash)) {
    anchorLogger.error("Invalid contentHash format (expected 64 hex chars)");
    throw new Error("Invalid contentHash format");
  }
  // Input validation: votingEndsAt must be a valid future date
  if (!(votingEndsAt instanceof Date) || isNaN(votingEndsAt.getTime()) || votingEndsAt.getTime() < Date.now()) {
    anchorLogger.error("Invalid votingEndsAt: must be a valid future date");
    throw new Error("Invalid votingEndsAt");
  }

  const clients = getClients();
  if (!clients) {
    anchorLogger.info(" On-chain anchoring disabled — skipping");
    return null;
  }

  const { publicClient, walletClient, account, config } = clients;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Convert proposal ID to keccak256 hash (bytes32)
      const proposalIdHash = keccak256(toHex(proposalId));

      // Convert content hash (SHA-256 hex string) to bytes32
      const contentHashBytes = `0x${contentHash}` as `0x${string}`;

      // Convert voting end time to unix timestamp
      const votingEndsAtUnix = BigInt(Math.floor(votingEndsAt.getTime() / 1000));

      // Simulate first to check for errors
      const { request } = await publicClient.simulateContract({
        address: config.contractAddress,
        abi: HERO_DAO_ANCHOR_ABI,
        functionName: "anchorProposal",
        args: [proposalIdHash, contentHashBytes, votingEndsAtUnix],
        account,
      });

      // Execute the transaction
      const txHash = await walletClient.writeContract(request);

      anchorLogger.info(` Proposal ${proposalId} anchored on-chain (attempt ${attempt + 1}): ${txHash}`);
      return txHash;
    } catch (err: any) {
      anchorLogger.error(`Attempt ${attempt + 1}/${maxRetries + 1} failed for ${proposalId}`, { error: err?.message });
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff: 1s, 2s)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      // All retries exhausted — don't throw, anchoring failure shouldn't block proposal creation
      // AUDIT FIX: Enhanced alerting for anchor failures
      const alertMsg = `[DAO Anchor] ALERT: All ${maxRetries + 1} attempts FAILED for ${proposalId}. Proposal created WITHOUT on-chain anchor. Last error: ${err.message}`;
      anchorLogger.fatal(alertMsg);
      // Log to audit trail for monitoring
      try {
        const { logDaoAction } = await import('./dao-rate-limiter');
        await logDaoAction(proposalId, 'anchor_failed', 0, { error: err.message, attempts: maxRetries + 1 });
      } catch { /* best-effort audit logging */ }
      return null;
    }
  }
  return null;
}

/**
 * Finalize a proposal on-chain after voting ends.
 * This starts the 48-hour timelock before execution.
 * 
 * @param proposalId - The off-chain proposal ID
 * @param votesFor - Total votes in favor
 * @param votesAgainst - Total votes against
 * @param votesAbstain - Total abstentions
 * @returns Transaction hash if successful, null if disabled
 */
export async function finalizeProposalOnChain(
  proposalId: string,
  votesFor: number,
  votesAgainst: number,
  votesAbstain: number
): Promise<string | null> {
  // Input validation: proposalId format
  if (!proposalId || !/^HERO-M\d+-[A-Za-z0-9]+$/.test(proposalId)) {
    anchorLogger.error("Invalid proposalId format", { proposalId });
    throw new Error(`Invalid proposalId format: ${proposalId}`);
  }
  // Input validation: vote counts must be safe integers and non-negative
  if (!Number.isSafeInteger(votesFor) || votesFor < 0 ||
      !Number.isSafeInteger(votesAgainst) || votesAgainst < 0 ||
      !Number.isSafeInteger(votesAbstain) || votesAbstain < 0) {
    anchorLogger.error("Invalid vote counts: must be non-negative safe integers");
    throw new Error("Invalid vote counts");
  }

  const clients = getClients();
  if (!clients) return null;

  const { publicClient, walletClient, account, config } = clients;

  try {
    const proposalIdHash = keccak256(toHex(proposalId));

    const { request } = await publicClient.simulateContract({
      address: config.contractAddress,
      abi: HERO_DAO_ANCHOR_ABI,
      functionName: "finalizeProposal",
      args: [proposalIdHash, BigInt(votesFor), BigInt(votesAgainst), BigInt(votesAbstain)],
      account,
    });

    const txHash = await walletClient.writeContract(request);
    anchorLogger.info(` Proposal ${proposalId} finalized on-chain: ${txHash}`);
    return txHash;
  } catch (err: any) {
    anchorLogger.error(`Failed to finalize proposal ${proposalId}`, { error: err?.message });
    return null;
  }
}

/**
 * Check if a proposal is executable on-chain (timelock expired).
 */
export async function isProposalExecutableOnChain(proposalId: string): Promise<boolean> {
  if (!proposalId) {
    anchorLogger.error("isProposalExecutableOnChain called with empty proposalId");
    return false;
  }

  const clients = getClients();
  if (!clients) return false;

  const { publicClient, config } = clients;

  try {
    const proposalIdHash = keccak256(toHex(proposalId));
    const result = await publicClient.readContract({
      address: config.contractAddress,
      abi: HERO_DAO_ANCHOR_ABI,
      functionName: "isExecutable",
      args: [proposalIdHash],
    });
    return result as boolean;
  } catch (err: any) {
    anchorLogger.error("isExecutable read failed", { error: err?.message, proposalId });
    return false;
  }
}

/**
 * Get remaining timelock duration from on-chain contract.
 */
export async function getOnChainTimelockRemaining(proposalId: string): Promise<number> {
  if (!proposalId) {
    anchorLogger.error("getOnChainTimelockRemaining called with empty proposalId");
    return 0;
  }

  const clients = getClients();
  if (!clients) return 0;

  const { publicClient, config } = clients;

  try {
    const proposalIdHash = keccak256(toHex(proposalId));
    const result = await publicClient.readContract({
      address: config.contractAddress,
      abi: HERO_DAO_ANCHOR_ABI,
      functionName: "timelockRemaining",
      args: [proposalIdHash],
    });
    return Number(result);
  } catch (err: any) {
    anchorLogger.error("timelockRemaining read failed", { error: err?.message, proposalId });
    return 0;
  }
}

/**
 * Verify a proposal's content hash on-chain.
 */
export async function verifyContentHashOnChain(proposalId: string, contentHash: string): Promise<boolean> {
  if (!proposalId || !contentHash) {
    anchorLogger.error("verifyContentHashOnChain called with empty args", { proposalId, contentHash: contentHash ? "set" : "empty" });
    return false;
  }

  const clients = getClients();
  if (!clients) return false;

  const { publicClient, config } = clients;

  try {
    const proposalIdHash = keccak256(toHex(proposalId));
    const contentHashBytes = `0x${contentHash}` as `0x${string}`;
    const result = await publicClient.readContract({
      address: config.contractAddress,
      abi: HERO_DAO_ANCHOR_ABI,
      functionName: "verifyContentHash",
      args: [proposalIdHash, contentHashBytes],
    });
    return result as boolean;
  } catch (err: any) {
    anchorLogger.error("verifyContentHash read failed", { error: err?.message, proposalId });
    return false;
  }
}

// ─── Status Check ───────────────────────────────────────────────────────

/**
 * Check if on-chain anchoring is properly configured.
 * Useful for health checks and dashboard status.
 */
export function isAnchoringEnabled(): boolean {
  return getConfig().enabled;
}

export function getAnchorStatus(): {
  enabled: boolean;
  contractAddress: string;
  executorConfigured: boolean;
} {
  const config = getConfig();
  return {
    enabled: config.enabled,
    contractAddress: config.contractAddress,
    executorConfigured: config.executorPrivateKey !== "0x0000000000000000000000000000000000000000000000000000000000000000",
  };
}
