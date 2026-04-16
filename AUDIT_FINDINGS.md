# HeroBase.io Full Code Audit — Findings Report

**Date**: April 16, 2026
**Codebase**: `/root/hero-dapp` on VPS1 (vmi2941473)
**Commit**: 870f869 on `jratdish1/hero-dapp` branch `main`
**Files Analyzed**: 155 TypeScript/React files, ~13,000 lines of custom code

---

## CRITICAL Issues (Must Fix)

### C1. Missing Routes for Nav Items (3 broken nav links)
**Files**: `client/src/App.tsx`, `client/src/components/AppLayout.tsx`
**Issue**: AppLayout sidebar has nav items that link to routes not defined in App.tsx Router:
- `/start` (🇺🇸 Start Here) — No route, leads to 404
- `/farm/base` (Farm BASE) — No route, leads to 404
- `/stake` (Stake HERO → DAI) — No route, leads to 404
**Pages Exist**: `BaseFarm.tsx` and `HeroStake.tsx` are implemented but never imported/routed.
**Fix**: Add routes for `/farm/base` → BaseFarm, `/stake` → HeroStake, `/start` → Onboarding (or Explainer redirect).

### C2. `setInterval` Shadowed by React State in DcaOrders.tsx
**File**: `client/src/pages/DcaOrders.tsx`, line 51
**Issue**: `const [interval, setInterval] = useState("daily")` shadows the global `setInterval` function. If any code in this component tries to use `setInterval()` for timers, it will fail silently.
**Fix**: Rename to `[dcaInterval, setDcaInterval]`.

### C3. DRY Violation — CDN URLs Duplicated Across Files
**Files**: `Home.tsx` (lines 6-9), `AppLayout.tsx` (lines 45-48), `Explainer.tsx` (lines 17-22)
**Issue**: Same CDN asset URLs (`HERO_LOGO_URL`, `HERO_BANNER_URL`, `BLACKBEARD_URL`, `KYC_BADGE_URL`, etc.) are declared as local constants in 3+ files. Any URL change requires updating multiple files.
**Fix**: Centralize all CDN URLs in `shared/tokens.ts` under the existing `CDN_ASSETS` object (which already has `heroBanner` and `heroEmblem`). Import from there.

---

## HIGH Issues (Should Fix)

### H1. Relative Path Imports Instead of Aliases (9 occurrences)
**Files**: Multiple pages and components
**Issue**: Using `../../../shared/tokens` instead of `@shared/tokens` alias. Works but fragile and inconsistent with the rest of the codebase.
**Affected Files**:
- `Approvals.tsx`, `Dashboard.tsx`, `Home.tsx`, `Swap.tsx`, `DcaOrders.tsx`, `LimitOrders.tsx` → `../../../shared/tokens`
- `NetworkSwitcher.tsx`, `NetworkContext.tsx` → `../../../shared/tokens`
- `trpc.ts` → `../../../server/routers`
**Fix**: Replace with `@shared/tokens` alias (already configured in vite.config.ts).

### H2. Unused Page Components (2 files, ~1,755 lines dead code)
**Files**: `ComponentShowcase.tsx` (1,437 lines), `Onboarding.tsx` (318 lines)
**Issue**: Neither is imported in App.tsx or any other file. ComponentShowcase is a dev-only demo page. Onboarding could be used for `/start` route.
**Fix**: Remove ComponentShowcase.tsx (or move to a dev-only route). Wire Onboarding.tsx to `/start` route.

### H3. Backup Files in Source Tree
**Files**: `ExplainerVideoModal.tsx.bak3`, `LanguageSelector.tsx.bak`
**Issue**: Backup files should not be in the source tree. They add noise and could confuse build tools.
**Fix**: Delete both `.bak` files.

### H4. Duplicate `React` Import in Farm.tsx
**File**: `client/src/pages/Farm.tsx`, line 1
**Issue**: `import React from "react"` alongside destructured imports from "react". With React 19 JSX transform, the default import is unnecessary.
**Fix**: Remove `import React from "react"` and use `React.useState` → `useState`, `React.useEffect` → `useEffect` (or keep React import but remove duplicate).

### H5. `useDexScreenerBase` Hook Defined Inside Page Component
**File**: `client/src/pages/Farm.tsx`, line 54
**Issue**: Custom hook `useDexScreenerBase` is defined inside the Farm.tsx page file rather than in `hooks/` directory. This violates separation of concerns and prevents reuse.
**Fix**: Move to `client/src/hooks/useDexScreenerBase.ts` and import it.

---

## MEDIUM Issues (Nice to Fix)

### M1. Empty `alt=""` on Favicon Images
**File**: `client/src/pages/Tokenomics.tsx`, lines 303, 330
**Issue**: `<img alt="">` on favicon images. Should have descriptive alt text for accessibility.
**Fix**: Add descriptive alt text like `alt="Emit Farm logo"`.

### M2. Empty Catch Blocks (7 occurrences)
**Files**: `Portfolio.tsx` (2), `WalletButton.tsx` (1), `NetworkContext.tsx` (1), `dataApi.ts` (1), `security.ts` (1), `twitterFetcher.ts` (1)
**Issue**: `catch {}` blocks silently swallow errors. Should at minimum log to console.warn.
**Fix**: Add `console.warn` in catch blocks for debugging.

### M3. Single `console.log` in Client Code
**File**: 1 occurrence in client code
**Issue**: Production code should not have console.log statements.
**Fix**: Remove or convert to console.warn/debug.

### M4. LanguageContext.tsx is 1,060 Lines
**File**: `client/src/contexts/LanguageContext.tsx`
**Issue**: All 8 language dictionaries (~200 entries each) are inline in a single file. This makes the file very large and hard to maintain.
**Fix**: Extract each language dictionary to a separate file in `client/src/i18n/` directory.

### M5. `FEATURED_TOKENS` Backward-Compat Alias Points to PulseChain Only
**File**: `shared/tokens.ts`
**Issue**: `export const FEATURED_TOKENS = PULSECHAIN_TOKENS;` — LimitOrders and DcaOrders import FEATURED_TOKENS but then filter for BASE tokens manually. This is fragile.
**Fix**: Use `getTokensForChain(chainId)` helper instead of FEATURED_TOKENS in chain-aware components.

---

## LOW Issues (Cosmetic/Future)

### L1. No Lazy Loading for Route Components
**Issue**: All 20+ page components are eagerly imported in App.tsx. This increases initial bundle size.
**Fix**: Use `React.lazy()` with `Suspense` for code splitting.

### L2. `Streamdown` Import in AiAssistant and Blog
**Issue**: `streamdown` package is imported but the AI chat doesn't appear to use streaming responses (uses `useMutation` not streaming).
**Fix**: Verify if streaming is actually used; remove import if not.

### L3. No Rate Limiting on Client-Side API Calls
**Issue**: DexScreener direct fetch in Farm.tsx has no rate limiting beyond the 30s interval. Multiple instances could exceed limits.
**Fix**: Server-side caching already handles this for tRPC calls. The direct fetch in Farm.tsx should use the server-side cache instead.

---

## Security Assessment

| Area | Status | Notes |
|------|--------|-------|
| XSS Protection | ✅ Good | No dangerouslySetInnerHTML except in shadcn chart (safe) |
| Input Validation | ✅ Good | Zod schemas with ethAddress, safeString, tokenSymbol validation |
| CORS | ✅ Good | No explicit CORS config (same-origin) |
| Rate Limiting | ✅ Good | express-rate-limit + helmet configured |
| Secrets | ✅ Good | All secrets via env vars, no hardcoded keys |
| Wallet Security | ✅ Good | `storage: null` disables auto-reconnect |
| HTML Escaping | ✅ Good | Telegram bot escapes all user content |
| SQL Injection | ✅ Good | Drizzle ORM parameterized queries |

---

## Summary

| Severity | Count | Lines Affected |
|----------|-------|----------------|
| CRITICAL | 3 | ~50 lines to add/fix |
| HIGH | 5 | ~100 lines to refactor |
| MEDIUM | 5 | ~50 lines to improve |
| LOW | 3 | Future optimization |

**Overall Assessment**: The codebase is well-structured with good security practices. The main issues are missing routes (3 nav items lead to 404), DRY violations with CDN URLs, and some dead code. No security vulnerabilities found. The architecture follows DRY/KISS principles with good separation between client/server/shared layers.
