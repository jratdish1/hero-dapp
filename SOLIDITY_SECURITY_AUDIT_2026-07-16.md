# HERO Dapp — Solidity Contract Security Analysis

**Date:** 2026-07-16  
**Auditor:** Manus (automated security review)  
**Scope:** All 7 production contracts in `contracts/` and `contracts/v2/`  
**Solidity Version:** ^0.8.20 / ^0.8.26  
**Framework:** OpenZeppelin Contracts v5.x, Hardhat 3  
**Test Coverage:** 337/337 tests passing (Vitest + Hardhat)

---

## Executive Summary

The HERO Dapp Solidity contracts demonstrate **strong security posture** overall. The codebase follows established patterns (CEI, ReentrancyGuard, Ownable2Step/Ownable, Pausable) and has clearly been through prior Codex/Grok audit iterations. No critical vulnerabilities were identified. Several medium and low findings are documented below for completeness and future hardening.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 3 | Documented |
| Low | 5 | Documented |
| Informational | 4 | Documented |

---

## Contracts Reviewed

| Contract | Lines | Purpose |
|----------|-------|---------|
| HeroCards.sol | 456 | V1 ERC-721 NFT (1,500 supply, whitelist, randomization) |
| HeroDAOAnchor.sol | 286 | Hybrid DAO governance anchor (proposals, timelock, execution) |
| v2/HeroCardsV2.sol | 343 | V2 ERC-721 NFT (buy/burn router integration, overpayment refund) |
| v2/HeroBuyBurnRouter.sol | 190 | Fee split router (receive → distribute to N recipients) |
| v2/HeroCardsMarketplace.sol | 219 | P2P NFT marketplace with ERC-2981 royalties |
| v2/HeroCardsRewardsDistributor.sol | 187 | Merkle-based epoch reward claims (native + ERC-20) |
| v2/HeroCardsV2Registry.sol | 146 | Module registry (address book per chain) |

---

## MEDIUM Findings

### M-1: Marketplace `buy()` — Reentrancy via ETH transfers to seller/royalty receiver

**Contract:** `HeroCardsMarketplace.sol` (lines ~130-170)  
**Description:** The `buy()` function performs 4 sequential ETH transfers (NFT safeTransferFrom, platform fee, royalty, seller proceeds, overpayment refund) after setting `listing.active = false`. While `nonReentrant` is applied, the function relies on `call{value:}` to multiple external addresses. If any recipient is a malicious contract that reverts, the entire purchase fails (griefing vector). A malicious royalty receiver contract could permanently block sales of tokens that set it as the royalty recipient.

**Impact:** Denial-of-service on specific token sales if royalty receiver is a reverting contract.  
**Recommendation:** Consider a pull-payment pattern for royalty/seller proceeds, or add a gas-limited `call` with a fallback to escrow. Alternatively, wrap royalty transfer in a try/catch and credit to escrow on failure.

### M-2: HeroCardsV2 `_routeFunds()` — Silent fund trapping when router is paused

**Contract:** `HeroCardsV2.sol` (line 189-193)  
**Description:** When `buyBurnRouter` is set but the router is paused, the `receive()` on the router reverts with `RouterPaused()`. This causes the entire mint transaction to revert. The comment in `HeroBuyBurnRouter.sol` acknowledges this ("Upstream callers must check router pause state"). However, `HeroCardsV2.mint()` does not check `Pausable(buyBurnRouter).paused()` before forwarding — it simply reverts on failure.

**Impact:** If the router is paused while minting is active, all mints revert (DoS). The operator SOP says "do not pause router while minting is active," but there is no on-chain enforcement.  
**Recommendation:** Add a check: `if (Pausable(buyBurnRouter).paused()) return;` in `_routeFunds()` to allow mints to succeed with funds held in the NFT contract for later emergency withdrawal. Or add an `isPaused` view call before the external call.

### M-3: HeroCards V1 `randomStartIndex` — Miner influence on blockhash

**Contract:** `HeroCards.sol` (line 244-251)  
**Description:** The randomization uses `blockhash(_randomSeedBlock)` where `_randomSeedBlock = block.number + 1` at request time. A validator/miner can influence the blockhash of the next block. For a 1,500-item collection, the economic incentive to manipulate is low, but this is a known weakness of blockhash-based randomness.

**Impact:** Low economic impact for this collection size. A miner could theoretically bias the metadata offset to get a specific rare NFT.  
**Recommendation:** For future collections, consider Chainlink VRF or commit-reveal with user-contributed entropy. The existing 256-block expiry and two-step process (request → finalize) partially mitigate this. **Already documented in prior audit — no action required for V1.**

---

## LOW Findings

### L-1: HeroDAOAnchor — Owner and executor are separate but owner can change executor

**Contract:** `HeroDAOAnchor.sol`  
**Description:** The owner can call `setExecutor()` to change the executor at any time. If the owner key is compromised, the attacker can set themselves as executor and finalize/execute proposals without the original multisig.

**Recommendation:** Consider `Ownable2Step` (already used in HeroCards V1) for the DAO anchor to prevent single-tx ownership takeover. The current contract uses basic `Ownable`.

### L-2: HeroBuyBurnRouter — No minimum split count validation

**Contract:** `HeroBuyBurnRouter.sol`  
**Description:** `_setSplits()` allows a single recipient with 10,000 bps. While this is valid, it means the "buy and burn" intent could be circumvented by the owner setting all funds to a single non-burn address.

**Recommendation:** Consider a minimum recipient count or a locked burn-address slot that cannot be removed.

### L-3: HeroCardsMarketplace — `require` string vs custom error inconsistency

**Contract:** `HeroCardsMarketplace.sol` (line ~setFee)  
**Description:** `setFee()` uses `require(feeBps <= 1000, "Fee too high")` while all other functions use custom errors. This is a gas/consistency issue only.

**Recommendation:** Replace with `if (feeBps > 1000) revert FeeTooHigh();`

### L-4: HeroCardsRewardsDistributor — No epoch duration bounds

**Contract:** `HeroCardsRewardsDistributor.sol`  
**Description:** `createEpoch()` accepts any `duration_` value including 0 or extremely large values. A zero-duration epoch would be immediately expired and unclaimable.

**Recommendation:** Add `if (duration_ < MIN_EPOCH_DURATION || duration_ > MAX_EPOCH_DURATION) revert InvalidDuration();`

### L-5: HeroCardsV2 — `setRandomStartIndex()` uses `block.number - 1` (single-block randomness)

**Contract:** `HeroCardsV2.sol`  
**Description:** Unlike V1's two-step request/finalize pattern, V2's `setRandomStartIndex()` uses `blockhash(block.number - 1)` in a single transaction. This is slightly weaker than V1's approach because the owner can choose when to call it (selecting a favorable block).

**Recommendation:** Adopt V1's two-step pattern or Chainlink VRF for V2 if randomization fairness is critical.

---

## INFORMATIONAL Findings

### I-1: All contracts use `call{value:}` for ETH transfers

All contracts correctly avoid `transfer()` and `send()` (which have a 2300 gas stipend that can break with EIP-1884). The use of `call{value:}` is the recommended pattern.

### I-2: HeroCardsV2Registry — No upgrade path

The registry is a simple mapping with no proxy pattern. If a bug is found, a new registry must be deployed and all consumers re-pointed. This is acceptable for a module registry but worth noting.

### I-3: Compiler settings use `viaIR` with optimizer

The Hardhat config uses `viaIR: true` with optimizer runs. This is fine for production but can occasionally produce unexpected behavior with very complex functions. No issues observed in testing.

### I-4: HeroDAOAnchor `executeProposal` — No return value check on Address.functionCallWithValue

`Address.functionCallWithValue` from OpenZeppelin already reverts on failure, so this is correct. The prior `ExecutionFailed` error is now unreachable (dead code) but harmless.

---

## Security Patterns Verified

| Pattern | Status | Notes |
|---------|--------|-------|
| Reentrancy Guard | PASS | Applied on all state-changing external functions |
| Checks-Effects-Interactions | PASS | State updated before external calls in all contracts |
| Access Control | PASS | onlyOwner / onlyExecutor consistently applied |
| Integer Overflow | PASS | Solidity ^0.8.x built-in overflow protection |
| Pausable | PASS | Emergency pause on all critical contracts |
| Pull vs Push Payment | PARTIAL | Marketplace uses push (see M-1) |
| Input Validation | PASS | Zero-address, zero-amount, bounds checks present |
| Event Emission | PASS | All critical state changes emit events |
| Merkle Proof | PASS | Standard OZ MerkleProof.verify usage |
| Royalty (ERC-2981) | PASS | Correctly implemented with try/catch in marketplace |

---

## Recommendations Summary

1. **M-1 (Marketplace griefing):** Add try/catch on royalty transfer with escrow fallback
2. **M-2 (Router pause DoS):** Add pause-state check in `_routeFunds()` before external call
3. **M-3 (Blockhash randomness):** Documented, no action for V1 — use VRF for future collections
4. **L-1 (DAO Ownable):** Upgrade to Ownable2Step
5. **L-3 (require string):** Replace with custom error for consistency
6. **L-4 (Epoch duration):** Add min/max bounds
7. **L-5 (V2 randomness):** Consider two-step or VRF

---

## Conclusion

The HERO Dapp contract suite is **production-ready** with no critical or high vulnerabilities. The 3 medium findings are edge-case DoS vectors that require either malicious royalty receivers or operator error (pausing router during active mint). The low and informational findings are hardening opportunities for future iterations.

**Overall Grade: A-**

The contracts demonstrate mature security practices including CEI pattern, reentrancy guards, two-step ownership, proper event emission, and comprehensive input validation. The prior Codex audit fixes are visible in the code comments and have been correctly implemented.
