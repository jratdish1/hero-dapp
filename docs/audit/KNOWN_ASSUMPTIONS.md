# Known Assumptions

## Protocol Assumptions

- Smart contracts are deployed on PulseChain and BASE networks.
- RPC endpoints may be rate-limited or temporarily unavailable.
- Transaction confirmation times vary by network congestion.

## Token Assumptions

- ERC-20 standard compliance is assumed for listed tokens.
- Fee-on-transfer tokens are identified and handled separately.
- Token decimals are verified from on-chain data, not hardcoded.

## Oracle Assumptions

- DEX price data is sourced from on-chain reserves.
- Price impact calculations account for pool depth.

## Governance Assumptions

- Contract upgrades require multisig approval.
- Admin functions are timelocked where applicable.

## Deployment Assumptions

- Frontend is served via CDN with HTTPS enforced.
- Backend APIs require authentication for state-changing operations.
- Private keys never leave the user's device (client-side signing).
