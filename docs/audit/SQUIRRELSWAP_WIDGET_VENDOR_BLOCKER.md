# SquirrelSwap Widget — Integration Status Update (Post-Vendor Response)

**Date:** 2026-06-12
**Track:** SQUIRRELS
**Latest PR:** [#24 — fix: align SquirrelSwap widget iframe with official docs](https://github.com/jratdish1/hero-dapp/pull/24)
**Merge Commit:** `1d9bf02`
**Production Deploy:** NO

---

## Status Summary (Post-Vendor Response)

| Item | Status |
|---|---|
| Previous vendor-block suspicion | Superseded by vendor response |
| Official iframe embed support | Confirmed by vendor |
| Correct widget URL format | Confirmed by vendor |
| No vendor allow-listing needed | Confirmed by vendor |
| Widget requires no sandbox attribute | Confirmed by vendor |
| herobase.io code now works locally | Yes (after sandbox removal) |
| Production deploy path | Still pending repair and approval |
| Extension wallets inside iframe | May not work (browser injection behavior) |
| WalletConnect inside iframe | Expected to work |
| Link-out fallback for signing | Remains recommended |

---

## What Was Done (herobase.io Side)

The `client/src/pages/LimitOrders.tsx` file has been patched and merged to `main` across two PRs, now fully aligned with vendor specifications:

### PR #22 — Initial hardening
- Removed production `console.log` leak.
- Added `sandbox="allow-scripts allow-same-origin allow-forms"` (later removed in PR #24).
- Added `referrerPolicy="strict-origin-when-cross-origin"`.
- Preserved `title` and `aria-label`.
- Token addresses sourced exclusively from `@shared/tokens`.

### PR #24 — Official docs alignment
- Removed `sandbox` attribute entirely.
- Reason: Official SquirrelSwap documentation (https://app.squirrelswap.pro/#/docs) does not use or recommend a `sandbox` attribute for their widget embed, and the widget does not render with any `sandbox` configuration applied. Risk accepted by repo owner (trusts SquirrelSwap founder/team).

### Current iframe attributes on `main` (confirmed correct):
```html
allow="clipboard-write"
referrerPolicy="strict-origin-when-cross-origin"
title="SquirrelSwap Limit Orders"
aria-label="SquirrelSwap limit orders widget"
```

No `sandbox` attribute (intentional — per official docs and vendor trust).

---

## Why Sandbox Was Removed (Confirmed by Vendor)

Testing confirmed that the widget renders correctly only when the `sandbox` attribute is absent. The vendor has explicitly confirmed that their widget requires no `sandbox` attribute for proper functionality. The risk of running the iframe without sandbox is accepted and documented here, based on vendor confirmation and repo owner trust.

---

## Wallet Integration Notes (Confirmed by Vendor)

- **Extension Wallets:** May not work inside the iframe due to browser injection behavior. A link-out fallback for signing remains recommended.
- **WalletConnect:** Expected to work seamlessly inside the iframe.

---

## Security Posture

| Control | Status |
|---|---|
| `sandbox` attribute | Removed (intentional, documented, vendor-confirmed) |
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

1. **Audit `client/src/components/SquirrelSwapWidget.tsx`** (if it exists and contains iframe sandbox settings) to ensure consistency.
2. Deploy to production when explicitly approved by repo owner, after the deploy path is repaired.
3. Verify widget renders on live `herobase.io/limits`.
4. Test wallet connection flow (especially WalletConnect) through the embedded widget.

---

## Notes

- No secrets, API keys, or JWT values are included in this document.
- Production deploy is blocked until the deploy path is repaired and explicitly approved.
- This document should be updated after production deploy and live verification.
