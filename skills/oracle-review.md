---
name: oracle-review
origin: local-ecc-inspired
---

# Oracle Review

Review oracle integrations for safety and correctness.

## Checklist

- Verify staleness checks on all oracle reads.
- Check decimal normalization between oracle and protocol.
- Verify fallback behavior when oracle is unavailable.
- Check for manipulation resistance (TWAP vs spot).
- Verify oracle update frequency assumptions are documented.
- Check that oracle failures cannot brick the protocol.

