# SquirrelSwap Widget — Vendor Blocker Notice

**Date:** 2026-06-11
**Track:** SQUIRRELS
**PR:** [#22 — fix: harden SquirrelSwap limit orders iframe](https://github.com/jratdish1/hero-dapp/pull/22)
**Merge Commit:** `a218a768af006eee137b292a65ae92eda8633532`
**Production Deploy:** NO

---

## Status Summary

| Item | Status |
|---|---|
| herobase.io repo code | Clean and configured |
| LimitOrders iframe hardened | Yes |
| Widget renders on herobase.io/limits | **No** |
| Root cause | External vendor iframe/embed block (SquirrelSwap side) |
| Production deploy performed | No |

---

## What Was Done (herobase.io Side)

The `client/src/pages/LimitOrders.tsx` file has been patched and merged to `main` with the following security hardening:

- `sandbox="allow-scripts allow-same-origin allow-forms"` — restrictive iframe sandboxing restored.
- `referrerPolicy="strict-origin-when-cross-origin"` — strict referrer policy restored.
- `console.log("Generated Widget URL:", widgetUrl)` — production console leak removed.
- `title="SquirrelSwap Limit Orders"` — preserved.
- `aria-label="SquirrelSwap limit orders widget"` — preserved.
- `allow-top-navigation` — not present (intentionally excluded).
- `allow-popups` — not present (intentionally excluded unless SquirrelSwap explicitly requires it).
- Token addresses sourced exclusively from `@shared/tokens` (no hardcoded addresses).
- No `.env` changes.
- No Nginx changes.
- No JWT_SECRET changes.

Token registry scanner confirms: **0 actionable violations**.

---

## Why the Widget Still Does Not Render

The SquirrelSwap widget at `https://app.squirrelswap.pro/#/widget?...` is not rendering inside the iframe on `herobase.io/limits`. This is **not a herobase.io code issue**. The suspected causes are one or more of the following on the SquirrelSwap vendor side:

1. **`X-Frame-Options: DENY` or `SAMEORIGIN`** — SquirrelSwap's server may be sending a header that blocks all cross-origin iframe embedding.
2. **`Content-Security-Policy: frame-ancestors 'self'`** — SquirrelSwap's CSP may restrict embedding to their own origin only.
3. **Widget URL format not confirmed** — The URL format `https://app.squirrelswap.pro/#/widget?modes=limit&...` has not been officially confirmed by SquirrelSwap as a supported embed endpoint.
4. **Embedding not officially supported** — SquirrelSwap may not have a publicly documented iframe/widget embedding feature.

---

## Required Action from SquirrelSwap

To unblock the widget, SquirrelSwap must confirm and/or implement the following:

1. **Confirm the supported widget/embed URL format** (e.g., `/#/widget?modes=limit&tokenOut=...`).
2. **Add `herobase.io` to their `frame-ancestors` CSP allowlist** or remove the `X-Frame-Options` restriction for the widget endpoint.
3. **Confirm which iframe `sandbox` permissions are required** — if `allow-popups` or `allow-top-navigation` is needed, document the security rationale.
4. **Provide official widget integration documentation** if available.

---

## Vendor Contact Template

> Subject: SquirrelSwap Widget Iframe Embedding — herobase.io Integration Request
>
> We are integrating the SquirrelSwap limit orders widget into herobase.io via an iframe.
> The widget URL we are using is: `https://app.squirrelswap.pro/#/widget?modes=limit&tokenOut=<HERO_PLS_ADDRESS>&...`
>
> The widget is not rendering. We suspect this is due to `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` restrictions on your server.
>
> Could you please:
> 1. Confirm the supported widget embed URL format.
> 2. Add `herobase.io` to your `frame-ancestors` allowlist for the widget endpoint.
> 3. Confirm any required iframe `sandbox` permissions.
>
> Thank you.

---

## Notes

- No secrets, API keys, or JWT values are included in this document.
- Production deploy is blocked until widget renders and security posture is verified end-to-end.
- This document should be updated when SquirrelSwap responds or the widget begins rendering.
