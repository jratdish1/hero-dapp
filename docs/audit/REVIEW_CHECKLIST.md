# Audit Review Checklist

## Access Control

- [ ] Every privileged function has an explicit authorization check.
- [ ] Role assignment and revocation are tested.
- [ ] Ownership transfer cannot be accidentally locked or hijacked.
- [ ] Multisig/timelock assumptions are documented.

## Upgradeability

- [ ] Initializers cannot be called twice.
- [ ] Implementation contracts are initialized or locked.
- [ ] Storage layout changes are reviewed.
- [ ] Upgrade authorization is restricted.

## Reentrancy and External Calls

- [ ] State is updated before external calls where applicable.
- [ ] Reentrancy guards are used where appropriate.
- [ ] ERC-777, ERC-1155, callback, and hook paths are considered.
- [ ] Cross-function reentrancy is considered.

## Oracle and Pricing

- [ ] Staleness checks exist.
- [ ] Decimal normalization is tested.
- [ ] Manipulation resistance is documented.
- [ ] Fallback behavior is safe.

## Token Accounting

- [ ] Fee-on-transfer tokens considered.
- [ ] Rebasing tokens considered.
- [ ] Non-standard ERC-20 return values considered.
- [ ] Rounding direction is explicit and tested.

## Testing

- [ ] Unit tests cover normal and failure paths.
- [ ] Fuzz tests cover boundary inputs.
- [ ] Invariants cover accounting and authorization.
- [ ] Deployment scripts are tested or simulated.
