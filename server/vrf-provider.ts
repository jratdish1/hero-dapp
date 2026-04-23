/**
 * HERO RNG — Chainlink VRF Provider (T2/T3 On-Chain Tiers)
 * 
 * Provides provably fair on-chain randomness using Chainlink VRF v2.5.
 * 
 * TIER ARCHITECTURE:
 * - T1 (Off-Chain): Block hash + keccak256 — FREE, 250 draws/day, used for previews & daily spins
 * - T2 (On-Chain Standard): Chainlink VRF Direct Funding — ~0.25 LINK per request
 * - T3 (On-Chain Premium): Chainlink VRF Subscription — batch requests, lower per-unit cost
 * 
 * SETUP REQUIREMENTS:
 * - Deploy VRFConsumer contract on PulseChain (or use existing Chainlink-compatible oracle)
 * - Fund with LINK tokens (or PLS equivalent for PulseChain VRF)
 * - Set VRF Coordinator address for the target chain
 * 
 * NOTE: PulseChain does not natively have Chainlink VRF. Options:
 * 1. Use a commit-reveal scheme as a VRF alternative on PulseChain
 * 2. Use Chainlink VRF on Ethereum/BASE and bridge the result
 * 3. Use a custom VRF oracle deployed on PulseChain
 * 
 * This module abstracts the VRF provider so the rest of the system
 * doesn't care which backend is used.
 */

import { ethers } from 'ethers';
import { randomBytes } from 'crypto';

// ─── Types ───────────────────────────────────────────────────────

export type VRFTier = 'T1_OFFCHAIN' | 'T2_DIRECT' | 'T3_SUBSCRIPTION';

export interface VRFConfig {
  tier: VRFTier;
  chain: 'pulsechain' | 'base' | 'ethereum';
  coordinatorAddress: string;
  consumerAddress: string;
  subscriptionId?: bigint;     // For T3 subscription model
  keyHash: string;             // Gas lane key hash
  callbackGasLimit: number;
  requestConfirmations: number;
  numWords: number;            // How many random words per request
  rpcUrl: string;
  privateKey?: string;         // For sending VRF requests (server-side only)
}

export interface VRFRequest {
  requestId: bigint;
  tier: VRFTier;
  chain: string;
  numWords: number;
  requestedAt: number;
  fulfilledAt?: number;
  randomWords?: bigint[];
  txHash: string;
  status: 'pending' | 'fulfilled' | 'failed' | 'timeout';
}

export interface VRFResult {
  requestId: bigint;
  randomWords: bigint[];
  proofTxHash: string;
  fulfillmentTxHash?: string;
  blockNumber: number;
  tier: VRFTier;
  chain: string;
  timestamp: number;
}

// ─── VRF Coordinator ABI (Chainlink VRF v2.5 compatible) ─────────

const VRF_COORDINATOR_ABI = [
  'function requestRandomWords(bytes32 keyHash, uint64 subId, uint16 requestConfirmations, uint32 callbackGasLimit, uint32 numWords) external returns (uint256 requestId)',
  'function getRequestStatus(uint256 requestId) external view returns (bool fulfilled, uint256[] memory randomWords)',
  'event RandomWordsRequested(bytes32 indexed keyHash, uint256 requestId, uint256 preSeed, uint64 indexed subId, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords, address indexed sender)',
  'event RandomWordsFulfilled(uint256 indexed requestId, uint256[] randomWords, uint256 payment)',
];

// ─── Commit-Reveal ABI (PulseChain alternative) ─────────────────

const COMMIT_REVEAL_ABI = [
  'function commit(bytes32 commitHash) external returns (uint256 commitId)',
  'function reveal(uint256 commitId, bytes32 secret) external returns (uint256 randomValue)',
  'function getCommitStatus(uint256 commitId) external view returns (uint8 status, bytes32 commitHash, uint256 revealBlock)',
  'event Committed(uint256 indexed commitId, address indexed committer, bytes32 commitHash)',
  'event Revealed(uint256 indexed commitId, uint256 randomValue)',
];

// ─── Default Configs ─────────────────────────────────────────────

export const VRF_CONFIGS: Record<string, Partial<VRFConfig>> = {
  // BASE (Chainlink VRF v2.5 available)
  base: {
    chain: 'base',
    coordinatorAddress: '0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634', // BASE VRF Coordinator
    keyHash: '0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71',
    callbackGasLimit: 100000,
    requestConfirmations: 3,
    numWords: 1,
    rpcUrl: 'https://mainnet.base.org',
  },
  // PulseChain (Commit-Reveal alternative — no native Chainlink)
  pulsechain: {
    chain: 'pulsechain',
    coordinatorAddress: '', // To be deployed
    keyHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    callbackGasLimit: 200000,
    requestConfirmations: 5,
    numWords: 1,
    rpcUrl: 'https://rpc.pulsechain.com',
  },
};

// ─── VRF Provider Class ─────────────────────────────────────────

export class VRFProvider {
  private config: VRFConfig;
  private provider: ethers.JsonRpcProvider;
  private signer?: ethers.Wallet;
  private pendingRequests: Map<string, VRFRequest> = new Map();

  constructor(config: VRFConfig) {
    // Validate required config fields
    if (!config.chain) throw new Error('VRFConfig: chain is required');
    if (!config.rpcUrl) throw new Error('VRFConfig: rpcUrl is required');
    if (!config.keyHash) throw new Error('VRFConfig: keyHash is required');
    if (config.requestConfirmations < 1) throw new Error('VRFConfig: requestConfirmations must be >= 1');
    if (config.callbackGasLimit < 50000) throw new Error('VRFConfig: callbackGasLimit must be >= 50000');

    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
    }
  }

  /**
   * Request random words via Chainlink VRF (T2/T3)
   * Only available on chains with Chainlink support (BASE, Ethereum)
   */
  async requestRandomWords(numWords: number = 1): Promise<VRFRequest> {
    if (!this.signer) {
      throw new Error('VRF requests require a signer (private key). Server-side only.');
    }
    if (!this.config.coordinatorAddress) {
      throw new Error(`VRF Coordinator not configured for ${this.config.chain}. Use commit-reveal instead.`);
    }
    // Validate numWords to prevent gas waste or unexpected behavior
    if (!Number.isInteger(numWords) || numWords < 1 || numWords > 500) {
      throw new Error(`numWords must be between 1 and 500, got: ${numWords}`);
    }

    const coordinator = new ethers.Contract(
      this.config.coordinatorAddress,
      VRF_COORDINATOR_ABI,
      this.signer
    );

    let receipt;
    try {
      const tx = await coordinator.requestRandomWords(
        this.config.keyHash,
        this.config.subscriptionId || 0n,
        this.config.requestConfirmations,
        this.config.callbackGasLimit,
        numWords
      );
      receipt = await tx.wait();
    } catch (err: any) {
      throw new Error(`VRF requestRandomWords failed on ${this.config.chain}: ${err.message || err}`);
    }
    
    // Parse requestId from event logs
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = coordinator.interface.parseLog(log);
        return parsed?.name === 'RandomWordsRequested';
      } catch { return false; }
    });

    const requestId = event 
      ? coordinator.interface.parseLog(event)!.args.requestId
      : 0n;

    const request: VRFRequest = {
      requestId,
      tier: this.config.tier,
      chain: this.config.chain,
      numWords,
      requestedAt: Date.now(),
      txHash: receipt.hash,
      status: 'pending',
    };

    this.pendingRequests.set(requestId.toString(), request);
    return request;
  }

  /**
   * Commit-Reveal scheme for PulseChain (VRF alternative)
   * 
   * Step 1: Commit a hash of (secret + salt)
   * Step 2: Wait N blocks for finality
   * Step 3: Reveal the secret — contract combines with future block hash for randomness
   */
  async commitReveal(salt: string): Promise<VRFResult> {
    if (!this.signer) {
      throw new Error('Commit-reveal requires a signer (private key). Server-side only.');
    }

    // Generate a cryptographic secret using CSPRNG (NOT Date.now())
    // randomBytes provides 32 bytes of cryptographically secure entropy
    const randomEntropy = '0x' + randomBytes(32).toString('hex');
    const secret = ethers.keccak256(
      ethers.solidityPacked(['string', 'bytes32'], [salt, randomEntropy])
    );

    // Commit phase
    const commitHash = ethers.keccak256(
      ethers.solidityPacked(['bytes32', 'address'], [secret, await this.signer.getAddress()])
    );

    // If no commit-reveal contract deployed, use block hash method (T1 enhanced)
    if (!this.config.coordinatorAddress) {
      return this.enhancedBlockHashRNG(salt);
    }

    const contract = new ethers.Contract(
      this.config.coordinatorAddress,
      COMMIT_REVEAL_ABI,
      this.signer
    );

    // Step 1: Commit
    let commitReceipt;
    try {
      const commitTx = await contract.commit(commitHash);
      commitReceipt = await commitTx.wait();
    } catch (err: any) {
      throw new Error(`Commit-reveal commit phase failed on ${this.config.chain}: ${err.message || err}`);
    }
    
    const commitEvent = commitReceipt.logs.find((log: any) => {
      try {
        return contract.interface.parseLog(log)?.name === 'Committed';
      } catch { return false; }
    });

    const commitId = commitEvent
      ? contract.interface.parseLog(commitEvent)!.args.commitId
      : 0n;

    // Step 2: Wait for confirmations
    const targetBlock = commitReceipt.blockNumber + this.config.requestConfirmations;
    while ((await this.provider.getBlockNumber()) < targetBlock) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Step 3: Reveal
    let revealReceipt;
    try {
      const revealTx = await contract.reveal(commitId, secret);
      revealReceipt = await revealTx.wait();
    } catch (err: any) {
      throw new Error(`Commit-reveal reveal phase failed on ${this.config.chain}: ${err.message || err}`);
    }

    const revealEvent = revealReceipt.logs.find((log: any) => {
      try {
        return contract.interface.parseLog(log)?.name === 'Revealed';
      } catch { return false; }
    });

    const randomValue = revealEvent
      ? contract.interface.parseLog(revealEvent)!.args.randomValue
      : 0n;

    return {
      requestId: commitId,
      randomWords: [randomValue],
      proofTxHash: commitReceipt.hash,
      fulfillmentTxHash: revealReceipt.hash,
      blockNumber: revealReceipt.blockNumber,
      tier: 'T2_DIRECT',
      chain: this.config.chain,
      timestamp: Date.now(),
    };
  }

  /**
   * Enhanced block hash RNG (T1+)
   * Uses multiple block hashes + keccak256 for better entropy
   * Suitable when no VRF contract is deployed
   */
  async enhancedBlockHashRNG(salt: string): Promise<VRFResult> {
    const currentBlock = await this.provider.getBlock('latest');
    if (!currentBlock) throw new Error('Failed to fetch current block');

    // Use 3 consecutive block hashes for better entropy
    const blocks = await Promise.all([
      this.provider.getBlock(currentBlock.number - 1),
      this.provider.getBlock(currentBlock.number - 2),
      this.provider.getBlock(currentBlock.number - 3),
    ]);

    const combinedEntropy = ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'string', 'uint256'],
        [
          currentBlock.hash!,
          blocks[0]?.hash || ethers.ZeroHash,
          blocks[1]?.hash || ethers.ZeroHash,
          blocks[2]?.hash || ethers.ZeroHash,
          salt,
          BigInt(Date.now()),
        ]
      )
    );

    const randomWord = BigInt(combinedEntropy);

    return {
      requestId: BigInt(currentBlock.number),
      randomWords: [randomWord],
      proofTxHash: currentBlock.hash!,
      blockNumber: currentBlock.number,
      tier: 'T1_OFFCHAIN',
      chain: this.config.chain,
      timestamp: Date.now(),
    };
  }

  /**
   * Wait for a VRF request to be fulfilled
   * Polls the coordinator contract for the result
   */
  async waitForFulfillment(requestId: bigint, timeoutMs: number = 120000): Promise<VRFResult> {
    if (!this.config.coordinatorAddress) {
      throw new Error('No VRF coordinator configured');
    }

    const coordinator = new ethers.Contract(
      this.config.coordinatorAddress,
      VRF_COORDINATOR_ABI,
      this.provider
    );

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const [fulfilled, randomWords] = await coordinator.getRequestStatus(requestId);
        
        if (fulfilled && randomWords.length > 0) {
          const request = this.pendingRequests.get(requestId.toString());
          if (request) {
            request.status = 'fulfilled';
            request.fulfilledAt = Date.now();
            request.randomWords = randomWords;
          }

          return {
            requestId,
            randomWords,
            proofTxHash: request?.txHash || '',
            blockNumber: await this.provider.getBlockNumber(),
            tier: this.config.tier,
            chain: this.config.chain,
            timestamp: Date.now(),
          };
        }
      } catch {
        // Request not yet fulfilled, continue polling
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Timeout
    const request = this.pendingRequests.get(requestId.toString());
    if (request) request.status = 'timeout';
    
    throw new Error(`VRF request ${requestId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Get the recommended tier based on use case
   */
  static recommendTier(useCase: string): { tier: VRFTier; reason: string; cost: string } {
    switch (useCase) {
      case 'daily_spin':
      case 'preview':
        return { tier: 'T1_OFFCHAIN', reason: 'Low stakes, high frequency — off-chain is sufficient', cost: 'FREE' };
      case 'nft_mint':
      case 'raffle':
      case 'dao_fallback':
        return { tier: 'T2_DIRECT', reason: 'Medium stakes — on-chain proof required for fairness', cost: '~0.25 LINK per request' };
      case 'holder_rewards':
      case 'jackpot':
        return { tier: 'T3_SUBSCRIPTION', reason: 'High stakes, batch draws — subscription is cost-effective', cost: '~0.10 LINK per request (batched)' };
      default:
        return { tier: 'T1_OFFCHAIN', reason: 'Default to off-chain for unknown use cases', cost: 'FREE' };
    }
  }

  /**
   * Estimate cost for a VRF request
   */
  static estimateCost(tier: VRFTier, numWords: number): { linkCost: number; description: string } {
    switch (tier) {
      case 'T1_OFFCHAIN':
        return { linkCost: 0, description: 'Free — uses block hash entropy' };
      case 'T2_DIRECT':
        return { linkCost: 0.25 * numWords, description: `~${(0.25 * numWords).toFixed(2)} LINK — direct funding per request` };
      case 'T3_SUBSCRIPTION':
        return { linkCost: 0.10 * numWords, description: `~${(0.10 * numWords).toFixed(2)} LINK — subscription batch rate` };
    }
  }
}

// ─── Convenience Functions ───────────────────────────────────────

/**
 * Get a random number using the appropriate VRF tier
 * Automatically selects the best method based on chain and config
 */
export async function getVRFRandom(
  max: number,
  salt: string,
  tier: VRFTier = 'T1_OFFCHAIN',
  chain: 'pulsechain' | 'base' = 'pulsechain',
  config?: Partial<VRFConfig>
): Promise<{ value: number; proof: VRFResult }> {
  if (max <= 0 || max > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Max must be between 1 and ${Number.MAX_SAFE_INTEGER}, got: ${max}`);
  }

  const fullConfig: VRFConfig = {
    tier,
    chain,
    coordinatorAddress: config?.coordinatorAddress || VRF_CONFIGS[chain]?.coordinatorAddress || '',
    consumerAddress: config?.consumerAddress || '',
    keyHash: config?.keyHash || VRF_CONFIGS[chain]?.keyHash || '',
    callbackGasLimit: config?.callbackGasLimit || 100000,
    requestConfirmations: config?.requestConfirmations || 3,
    numWords: 1,
    rpcUrl: config?.rpcUrl || VRF_CONFIGS[chain]?.rpcUrl || 'https://rpc.pulsechain.com',
    privateKey: config?.privateKey,
  };

  const provider = new VRFProvider(fullConfig);

  let result: VRFResult;

  switch (tier) {
    case 'T1_OFFCHAIN':
      result = await provider.enhancedBlockHashRNG(salt);
      break;
    case 'T2_DIRECT':
      if (chain === 'pulsechain') {
        // PulseChain: use commit-reveal
        result = await provider.commitReveal(salt);
      } else {
        // BASE/Ethereum: use Chainlink VRF
        const request = await provider.requestRandomWords(1);
        result = await provider.waitForFulfillment(request.requestId);
      }
      break;
    case 'T3_SUBSCRIPTION':
      if (chain === 'pulsechain') {
        result = await provider.commitReveal(salt);
      } else {
        const request = await provider.requestRandomWords(1);
        result = await provider.waitForFulfillment(request.requestId);
      }
      break;
  }

  const randomWord = result.randomWords[0];
  const value = Number(randomWord % BigInt(max));

  return { value, proof: result };
}
