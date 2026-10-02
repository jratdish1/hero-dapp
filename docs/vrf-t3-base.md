# Tier 3 randomness for HERO spins on Base - Chainlink VRF v2.5
Contract: `contracts/v2/HeroSpinVRFConsumer.sol` · Tests: `test/v2/HeroSpinVRFConsumer.test.mjs` · Written 2026-09-25.
PulseChain has no Chainlink VRF coordinator, so PulseChain spins use Tier 2 (`server/lib/spin-rng-t2.ts`).

## What it costs (official sources)
- Billing formula: https://docs.chain.link/vrf/v2-5/billing - `(total gas cost) x (100 + premium %) / 100`.
- Base values: https://docs.chain.link/vrf/v2-5/supported-networks (BASE Mainnet, Subscription):
  premium **60% paying in ETH, 50% paying in LINK**; max callback gas 2,500,000; minimum confirmations 0.
- Live numbers for your subscription: https://vrf.chain.link (Subscription Manager shows each request's actual cost).

Per request, gas = callback used (**37,106 measured** in the tests) + coordinator overhead (~128,500 on Base, from the
direct-funding table - use it as an estimate) = **~165,600 gas**, plus a small Base L1 data fee.

| Base gas price | ETH per spin (ETH billing, +60%) | USD per spin at $2,000/ETH | USD per 1,000 spins |
|---|---|---|---|
| 0.01 gwei (typical) | ~0.0000027 | ~$0.005 | ~$5 |
| 0.1 gwei (busy) | ~0.000027 | ~$0.05 | ~$53 |
Paying in LINK is ~6% cheaper (50% vs 60% premium) but adds LINK buying and transfers. ETH billing is the default.

## Settings chosen (and why)
| Setting | Value | Reason |
|---|---|---|
| Coordinator (Base mainnet) | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` | official table |
| Key hash | 2 gwei lane `0x00b81b5a830cb0a4009fbd8904de511e28631e62ce5ad231373d3cdad373ccab` | cheapest lane; Base gas is far below 2 gwei |
| callbackGasLimit | 100,000 | billed on gas actually used (37,106); 2.7x headroom costs nothing extra |
| requestConfirmations | 3 | reorg margin for ~6 s of latency |
| numWords | 1 | one spin = one word |
| nativePayment | true | pay in ETH; set false to pay in LINK |
| maxSpinsPerDay | 1 | enforced on-chain: no rerolls |

## Deploy checklist (VETS actions; test on Base Sepolia first)
1. Base Sepolia: coordinator `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE`, 30 gwei key hash
   `0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71`. Create + fund a subscription at vrf.chain.link.
2. Deploy `HeroSpinVRFConsumer(coordinator, keyHash, subId, 100000, 3, true, owner)` with owner = a hardware/multisig wallet.
3. Add the contract as a consumer on the subscription. `setRequester(serverHotWallet, true)` - the hot wallet can only request.
4. Request one spin, confirm fulfillment and the charged cost in the Subscription Manager, then repeat on Base mainnet.
5. Keep ~0.01 ETH in the subscription and alert below 0.003 ETH; requests wait unfulfilled when the balance is too low.
