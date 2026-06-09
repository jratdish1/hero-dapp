---
name: upgradeability-review
origin: local-ecc-inspired
---

# Upgradeability Review

Review upgrade mechanisms for safety.

## Checklist

- Verify initializers cannot be called twice.
- Check that implementation contracts are initialized or self-destructed.
- Verify storage layout compatibility across upgrades.
- Check that upgrade authorization is restricted to appropriate roles.
- Verify that upgrade functions emit events.
- Check for storage collision between proxy and implementation.

