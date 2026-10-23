[2026-10-23 23:11 UTC / 16:11 PDT]

# HERO V3 contract provenance

Owner: **VETS (jratdish1)**. Recovered and prepared by Grok Bot under the VETS Tier A GO. **NOT AUDITED FOR V3.** Nothing here is deployed.

## Where each file came from

The old (V2) contract addresses are on the KB #776 / KB #792 §8 lists, so they are **masked** (first 6 / last 4) and recorded as `sha256(lowercase address)`. Full values and file hashes are in `security/provenance.json`.

| Label | Chain | Old address (masked) | sha256(addr) | Source | Explorer status | solc | EVM / runs | Verified main file | Verbatim sha256 | V3 file | Local recompile vs on-chain runtime |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `HERO_base` | 8453 | `0x00Fa…b5f8` | `1e0c9e7f9a439fa9…` | Sourcify v2 API | exact_match | 0.8.26+commit.8a97fa7a | paris / 200 | `contracts/Base/Hero.sol` | `6e5410126092502f…` | `src/base/Hero.sol` | exact |
| `BB_base` | 8453 | `0x67bE…6670` | `154f91cbf1afe919…` | Sourcify v2 API | exact_match | 0.8.26+commit.8a97fa7a | paris / 200 | `contracts/Base/HeroBuyAndBurn.sol` | `abf2900ae2c5c0d5…` | `src/base/HeroBuyAndBurn.sol` | exact |
| `ABLE_base` | 8453 | `0xaE55…5423` | `4bb2ec9f3fd819a8…` | Sourcify v2 API | exact_match | 0.8.30+commit.73712a01 | default / 200 | `contracts/HeroABLE.sol` | `bf74ab9aa3d7df6c…` | `src/base/HeroABLE.sol` | exact |
| `HERO_pls` | 369 | `0x35a5…3D27` | `7addcbcb72d39e5c…` | PulseChain Blockscout API | full | 0.8.26+commit.8a97fa7a | paris / 200 | `contracts/Pulsechain/Hero.sol` | `1716d2e89419748f…` | `src/pulsechain/Hero.sol` | exact |
| `BB_pls` | 369 | `0x9016…04E9` | `0c1a77ef9a4e5a4b…` | PulseChain Blockscout API | full | 0.8.26+commit.8a97fa7a | paris / 200 | `contracts/Pulsechain/HeroBuyAndBurn.sol` | `85fd9902729c5238…` | `src/pulsechain/HeroBuyAndBurn.sol` | exact |
| `ABLE_pls` | 369 | `0xC24c…e151` | `1269e8833b6a32fb…` | PulseChain Blockscout API | partial | 0.8.27+commit.40a35a09 | default / 200 | `HeroABLE.sol` | `f98608f031a82edd…` | `src/pulsechain/HeroABLE.sol` | match excl. metadata only |

* Base sources: Sourcify v2 API (`fields=all`). Base Blockscout returned a Cloudflare challenge page, so it was not used.
* PulseChain sources: PulseChain Blockscout API v2 (`api.scan.pulsechain.com`).
* "Local recompile" means the verbatim std-json input was compiled with the exact solc release and compared with `eth_getCode` from the public RPCs (`mainnet.base.org`, `rpc.pulsechain.com`), with immutables masked.
* `ABLE_pls` is a **partial** Blockscout verification. The flattened source reproduces the runtime except for the metadata hash, so the source logic matches, but the original file layout and metadata are not recovered.
* The B&B instance on each chain was created by the Hero constructor (`new HeroBuyAndBurn(msg.sender, ...)`). It was not a separate deploy. That conflicts with the KB #792 deploy order, which lists B&B as its own step.

Re-check any row (read-only; the address is passed as an argument and checked against the hash, never stored):

```
python3 script/verify_provenance.py HERO_base 0x<full old address>
```

## Vendored libraries (`vendor/`, byte-for-byte from the verified bundles)

* `vendor/oz-4.9.0/contracts`: OpenZeppelin 4.9.0, used by Hero, B&B and PLS HeroABLE.
* `vendor/oz-5.0.0/contracts`: OpenZeppelin 5.0.0 from the Base HeroABLE bundle, used by `src/base/HeroABLE.sol` only (context remapping in `foundry.toml`).
* `vendor/uniswap-v2`: the `@uniswap/v2-core` and `@uniswap/v2-periphery` interfaces.
* The PulseChain bundles carry the same library files as Base (byte-identical).

## What V3 changed (the only edits to verified logic)

`HeroBuyAndBurn.sol` (both chains): **unchanged**, byte-identical to the verified source.

`Hero.sol` (Base and PulseChain):
* `pragma ^0.8.20` → `0.8.26`, pinned to the verified compiler.
* Removed the three hardcoded receivers (`autoLiquidityReceiver` 0x43f3…02a8, `donationReceiver` 0x94E5…89f7, `stakeRewardsReceiver` 0xCFa2…6a81, all on the KB #792 §8 list).
* The constructor now takes `(_startTimestamp, _autoLiquidityReceiver, _donationReceiver, _stakeRewardsReceiver)` and **reverts `"V3: receiver TBD"`** if any of them is zero. It fails closed.
* `stakeRewardsReceiver = msg.sender` → `= _stakeRewardsReceiver`.
* Added a header comment and normalized line endings from CRLF to LF.

`HeroABLE.sol` (Base 0.8.30, PulseChain 0.8.27):
* Removed the hardcoded `heroToken` (old HERO on each chain, 0x00Fa…b5f8 and 0x35a5…3D27).
* The constructor now takes `_heroToken` and **reverts `"V3: heroToken TBD"`** if it is zero. The pragma is pinned.

Infrastructure constants are kept as verified: WETH/WPLS, USDC/DAI, the routers, the Chainlink ETH/USD feed, the Tellor oracle and queryId, and the VETS token. None of them is on the #776 or #792 §8 lists; `script/check_no_old_addresses.py` enforces this.

## Not recovered (no verified source found)

* Base HeroABLE 0x9f8E…0612
* PLS HeroABLE 0xcc3c…1f54, 0x7916…4353, 0x93dF…9262 and 0x6172…a2bb
* Single-sided staking: Base 0xAD79…C722, PLS 0xD5F1…297E
* HABFF 0x1e8B…8c55

Staking source is handled in a separate PR, taken from hero-dapp #119 and #115.
