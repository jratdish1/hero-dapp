---
name: reentrancy-review
origin: local-ecc-inspired
---

# Reentrancy Review

Review for reentrancy vulnerabilities.

## Checklist

- Verify checks-effects-interactions pattern is followed.
- Check that reentrancy guards are used on state-changing external calls.
- Verify ERC-777 and ERC-1155 callback paths are considered.
- Check cross-function reentrancy (multiple functions sharing state).
- Verify read-only reentrancy is considered for view functions used in pricing.
- Check that callback-based patterns (flash loans, etc.) are safe.

