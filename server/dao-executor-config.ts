/**
 * HERO DAO — Executor Security Configuration
 * =============================================
 * Production Condition #2: Deploy with multisig (Gnosis Safe) as executor.
 * 
 * This module manages the executor configuration for the DAO.
 * The executor is the entity that can finalize and execute proposals on-chain.
 * 
 * SECURITY MODEL:
 * - In development: Single EOA (deployer wallet) for testing
 * - In production: Gnosis Safe multisig (2-of-3 or 3-of-5)
 * - The executor address is set in the HeroDAOAnchor contract at deployment
 * - It can be changed by the contract owner (which should also be a multisig)
 * 
 * ENVIRONMENT VARIABLES:
 * - DAO_EXECUTOR_TYPE: "eoa" | "gnosis_safe" | "timelock_controller"
 * - DAO_EXECUTOR_ADDRESS: The executor's address (Safe address for multisig)
 * - DAO_EXECUTOR_PRIVATE_KEY: Only used for EOA mode (development)
 * - DAO_SAFE_TX_SERVICE_URL: Gnosis Safe Transaction Service URL
 * - DAO_SAFE_CHAIN_ID: Chain ID for the Safe (369 for PulseChain)
 */

export type ExecutorType = "eoa" | "gnosis_safe" | "timelock_controller";

export interface ExecutorConfig {
  type: ExecutorType;
  address: string;
  chainId: number;
  isProduction: boolean;
  safeConfig?: {
    txServiceUrl: string;
    threshold: number;
    owners: string[];
  };
}

/**
 * Get the current executor configuration from environment.
 */
export function getExecutorConfig(): ExecutorConfig {
  const type = (process.env.DAO_EXECUTOR_TYPE || "eoa") as ExecutorType;
  const address = process.env.DAO_EXECUTOR_ADDRESS || "";
  const chainId = parseInt(process.env.DAO_SAFE_CHAIN_ID || "369");
  const isProduction = process.env.NODE_ENV === "production";

  const config: ExecutorConfig = {
    type,
    address,
    chainId,
    isProduction,
  };

  if (type === "gnosis_safe") {
    config.safeConfig = {
      txServiceUrl: process.env.DAO_SAFE_TX_SERVICE_URL || "https://safe-transaction.pulsechain.com",
      threshold: parseInt(process.env.DAO_SAFE_THRESHOLD || "2"),
      owners: (process.env.DAO_SAFE_OWNERS || "").split(",").filter(Boolean),
    };
  }

  return config;
}

/**
 * Validate executor configuration. Call at server startup.
 * In production, this will throw if configuration is insecure.
 * Returns warnings for development mode, errors for production misconfigurations.
 */
export function validateExecutorConfig(): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const config = getExecutorConfig();
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!config.address) {
    errors.push("DAO_EXECUTOR_ADDRESS is not set");
  }

  if (config.isProduction) {
    if (config.type === "eoa") {
      errors.push(
        "CRITICAL: Using EOA executor in production. " +
        "Set DAO_EXECUTOR_TYPE=gnosis_safe and configure a multisig."
      );
    }

    if (config.type === "gnosis_safe") {
      if (!config.safeConfig?.txServiceUrl) {
        errors.push("DAO_SAFE_TX_SERVICE_URL is required for Gnosis Safe executor");
      }
      if (!config.safeConfig?.owners?.length || config.safeConfig.owners.length < 2) {
        errors.push("Gnosis Safe must have at least 2 owners configured");
      }
      if ((config.safeConfig?.threshold || 0) < 2) {
        errors.push("Gnosis Safe threshold must be at least 2 for production");
      }
    }
  } else {
    if (config.type === "eoa") {
      warnings.push(
        "Using EOA executor in development mode. " +
        "This is acceptable for testing but MUST use multisig in production."
      );
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Generate the deployment instructions for setting up the Gnosis Safe executor.
 */
export function getMultisigSetupInstructions(): string {
  return `
═══════════════════════════════════════════════════════════════════════
HERO DAO — Gnosis Safe Multisig Setup (Production Condition #2)
═══════════════════════════════════════════════════════════════════════

1. CREATE GNOSIS SAFE:
   - Go to: https://safe.pulsechain.com (or use Safe{Wallet} on PulseChain)
   - Create a new Safe with 3 owners (recommended: 2-of-3 threshold)
   - Owners should be hardware wallets (Ledger/Trezor)

2. RECOMMENDED OWNER STRUCTURE:
   - Owner 1: VETS primary hardware wallet
   - Owner 2: VIC Foundation operational wallet
   - Owner 3: Trusted team member / cold storage backup
   - Threshold: 2 (any 2 of 3 must sign)

3. ENVIRONMENT VARIABLES:
   DAO_EXECUTOR_TYPE=gnosis_safe
   DAO_EXECUTOR_ADDRESS=<safe_address>
   DAO_SAFE_TX_SERVICE_URL=https://safe-transaction.pulsechain.com
   DAO_SAFE_CHAIN_ID=369
   DAO_SAFE_THRESHOLD=2
   DAO_SAFE_OWNERS=<owner1>,<owner2>,<owner3>

4. UPDATE CONTRACT:
   After deploying the Safe, call setExecutor() on HeroDAOAnchor:
   - Connect owner wallet to contract
   - Call: setExecutor(<safe_address>)
   - This transfers execution rights to the multisig

5. TRANSFER OWNERSHIP:
   For maximum security, also transfer contract ownership to the Safe:
   - Call: transferOwnership(<safe_address>)
   - After this, only the multisig can change executor or ownership

═══════════════════════════════════════════════════════════════════════
`;
}
