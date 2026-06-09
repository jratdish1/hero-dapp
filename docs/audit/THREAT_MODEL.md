# Threat Model

## Assets

- User funds
- Admin privileges
- Governance authority
- Oracle inputs
- Upgrade authority
- Deployment credentials
- Protocol accounting integrity

## Actors

- External attacker
- Malicious token contract
- Compromised admin key
- Malicious governance participant
- MEV/searcher
- Honest user
- Keeper/bot
- AI coding agent exposed to malicious repository content

## Entry Points

- Public contract functions
- Admin functions
- Upgrade functions
- Oracles
- Bridges
- Token callbacks
- Deployment scripts
- CI workflows
- Agent-readable docs, PR comments, and generated files

## Security Invariants

- Unauthorized users cannot gain privileged roles.
- Funds cannot be withdrawn beyond entitlement.
- Accounting totals remain internally consistent.
- Upgrades require authorized approval.
- Oracle failures do not create unsafe prices.
- Deployment scripts do not expose or misuse secrets.
