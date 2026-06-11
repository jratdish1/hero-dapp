# SquirrelSwap Widget — Integration Status

**Date:** 2026-06-11
**Track:** SQUIRRELS
**Latest PR:** [#24 — fix: align SquirrelSwap widget iframe with official docs](https://github.com/jratdish1/hero-dapp/pull/24)
**Merge Commit:** `1d9bf02`
**Production Deploy:** NO

---

## Status Summary

| Item | Status |
|---|---|
| herobase.io repo code | Clean and configured |
| LimitOrders iframe aligned with official docs | Yes |
| Widget renders locally | **Yes** |
| Widget renders on production herobase.io | **Pending deploy** |
| Production deploy performed | No |

---

## What Was Done (herobase.io Side)

The `client/src/pages/LimitOrders.tsx` file has been patched and merged to `main` across two PRs:

### PR #22 — Initial hardening
- Removed production `console.log` leak.
- Added `sandbox="allow-scripts allow-same-origin allow-forms"`.
- Added `referrerPolicy="strict-origin-when-cross-origin"`.
- Preserved `title` and `aria-label`.
- Token addresses sourced exclusively from `@shared/tokens`.

### PR #24 — Official docs alignment
- Removed `sandbox` attribute entirely.
- Reason: Official SquirrelSwap documentation (https://app.squirrelswap.pro/#/docs) does not use or recommend a `sandbox` attribute for their widget embed.
- The widget does not render with any `sandbox` configuration applied.
- Risk accepted by repo owner (trusts SquirrelSwap founder/team).

### Current iframe attributes on main:
```
allow="clipboard-write"
referrerPolicy="strict-origin-when-cross-origin"
title="SquirrelSwap Limit Orders"
aria-label="SquirrelSwap limit orders widget"
```

No `sandbox` attribute (intentional — per official docs and vendor trust).

---

## Why Sandbox Was Removed

Testing confirmed:
1. `sandbox="allow-scripts allow-same-origin allow-forms"` — widget did NOT render.
2. `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` — widget did NOT render.
3. No `sandbox` attribute — widget renders correctly.

The official SquirrelSwap embed documentation shows no `sandbox` attribute. The repo owner trusts the SquirrelSwap founder. The risk of running the iframe without sandbox is accepted and documented here.

---

## Security Posture

| Control | Status |
|---|---|
| `sandbox` attribute | Removed (intentional, documented) |
| `allow="clipboard-write"` | Present (per official docs) |
| `referrerPolicy` | `strict-origin-when-cross-origin` |
| `title` | Present |
| `aria-label` | Present |
| `console.log` | None |
| Token addresses | From `@shared/tokens` only |
| Scanner result | 0 actionable violations |
| `.env` changes | None |
| Nginx changes | None |
| JWT_SECRET changes | None |

---

## Next Steps

1. Deploy to production when explicitly approved by repo owner.
2. Verify widget renders on live `herobase.io/limits`.
3. Test wallet connection flow through the embedded widget.

---

## Notes

- No secrets, API keys, or JWT values are included in this document.
- Production deploy is blocked until explicitly approved.
- This document should be updated after production deploy and live verification.
