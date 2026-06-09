---
name: access-control-review
origin: local-ecc-inspired
---

# Access Control Review

Review all privileged functions for proper authorization.

## Checklist

- Verify every `onlyOwner`, `onlyAdmin`, `onlyRole` modifier is applied correctly.
- Check that role assignment cannot be self-granted.
- Verify ownership transfer requires two-step confirmation where appropriate.
- Check that admin functions cannot be called by non-admins via proxy/delegate patterns.
- Verify timelocks on sensitive operations.
- Check that emergency functions have appropriate access controls.

