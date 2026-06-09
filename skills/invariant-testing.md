---
name: invariant-testing
origin: local-ecc-inspired
---

# Invariant Testing

Guide for writing invariant and fuzz tests.

## Approach

1. Identify core accounting invariants (total supply == sum of balances, etc.).
2. Identify authorization invariants (only admin can X).
3. Write stateful fuzz tests that call random sequences of functions.
4. Verify invariants hold after every call sequence.
5. Add boundary value tests for edge cases.
6. Test with fee-on-transfer and rebasing token mocks where applicable.

