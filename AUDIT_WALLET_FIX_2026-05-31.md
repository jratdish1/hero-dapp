# GPT-4.1 CODEX Audit — Wallet Connection Fix

**Date:** 2026-05-31
**Scope:** Wallet connection system (wagmi/viem/connectors)

# HERO Dapp Wallet Connection System Audit Report

Audit Scope: Wallet connection system for PulseChain (369) and Base (8453) chains  
Files audited:  
- client/src/lib/wagmi.ts  
- client/src/contexts/WagmiContext.tsx  
- client/src/components/WalletButton.tsx  
- client/src/components/ConnectWalletPrompt.tsx  
- package.json (dependencies review)  

---

## Summary

The wallet connection system is well-structured, uses modern wagmi v3 and viem v2 patterns, and follows good security practices such as disabling auto-connect and using fallback RPC transports. The UI components handle connection states and errors gracefully with user feedback.

However, a few issues and improvement opportunities were identified related to security, reliability, performance, and best practices.

---

# Detailed Findings

---

### 1. Missing Peer Dependencies Causing "s is not a function" Errors (Context)

- **Severity:** CRITICAL  
- **File:** N/A (build/runtime)  
- **Description:** The original critical bug was caused by missing peer dependencies for `@wagmi/connectors` v8, leading to runtime errors like `"s is not a function"`. This was due to missing or mismatched versions of wallet connector packages.  
- **Status:** Resolved by installing the following packages with compatible versions:  
  - `@metamask/connect-evm@^0.9.1`  
  - `@coinbase/wallet-sdk@^4.3.7`  
  - `@safe-global/safe-apps-provider@^0.18.6`  
  - `@safe-global/safe-apps-sdk@^9.1.0`  
  - `@walletconnect/ethereum-provider@^2.23.9`  
- **Recommendation:** Maintain strict version alignment with `@wagmi/connectors` peer dependencies. Use `pnpm` or `yarn` resolutions to avoid version conflicts. Add these dependencies explicitly in `package.json` as done.

---

### 2. Security: XSS via Unsanitized ENS Avatar URLs

- **Severity:** HIGH  
- **File:** `client/src/components/WalletButton.tsx` (lines ~150-170)  
- **Description:** ENS avatars are loaded directly from URLs returned by `useEnsAvatar`. These URLs are user-controlled and could potentially be crafted to deliver malicious content or trigger XSS attacks if not sanitized or validated.  
- **Risk:** Malicious avatar URLs could execute scripts or load unsafe content.  
- **Recommendation:**  
  - Sanitize avatar URLs before usage.  
  - Use a strict Content Security Policy (CSP) to restrict image sources.  
  - Consider proxying avatar images through a safe image CDN or sanitizer.  
  - Add `rel="noopener noreferrer"` and `crossOrigin="anonymous"` attributes if applicable.  
- **Example Fix:**  
```tsx
<img
  src={ensAvatar}
  alt="Avatar"
  className="h-7 w-7 rounded-full ring-2 ring-hero-orange/40 object-cover"
  onError={() => setAvatarError(true)}
  referrerPolicy="no-referrer"
/>
```
Also, ensure CSP headers on the server side restrict image sources.

---

### 3. Security: Clipboard API Usage Without User Gesture Check

- **Severity:** MEDIUM  
- **File:** `client/src/components/WalletButton.tsx` (copyAddress function)  
- **Description:** The clipboard write operation is triggered by a button click, which is good. However, no explicit check for user gesture or fallback for unsupported browsers is done beyond a simple feature check.  
- **Recommendation:**  
  - Confirm clipboard write is triggered by a user gesture (already true here).  
  - Provide fallback UI or instructions if clipboard API is unsupported.  
  - Consider catching and logging errors for analytics.  
- **No immediate code fix needed but monitor clipboard usage errors.**

---

### 4. Reliability: Timeout Handling in Wallet Connection

- **Severity:** LOW  
- **File:** `client/src/components/WalletButton.tsx` (handleConnect function)  
- **Description:** The connection timeout is set to 30 seconds, which is reasonable. However, if the user cancels the connection or the connector fails silently, the timeout resets the connecting state.  
- **Recommendation:**  
  - Consider exposing the timeout duration as a constant or config.  
  - Add more granular error handling for different connector errors.  
  - Log connection failures for monitoring.  
- **No critical fix needed.**

---

### 5. Performance: Bundle Size and Lazy Loading Wallet Connectors

- **Severity:** MEDIUM  
- **File:** `client/src/lib/wagmi.ts` and `client/src/components/WalletButton.tsx`  
- **Description:** All wallet connectors are imported and initialized eagerly, including WalletConnect which is conditionally added. This can increase bundle size unnecessarily for users who do not use certain wallets.  
- **Recommendation:**  
  - Lazy load wallet connectors and related SDKs only when needed (e.g., when user opens the connect modal).  
  - Use dynamic imports for heavy dependencies like WalletConnect and Safe connectors.  
- **Example Fix:**  
```tsx
// In WalletButton or wagmi.ts, dynamically import connectors on demand
const loadWalletConnect = async () => {
  const { walletConnect } = await import("@wagmi/connectors");
  return walletConnect({ projectId: wcProjectId, ... });
};
```
This reduces initial bundle size and improves performance.

---

### 6. Best Practices: Use of wagmi v3 and viem v2 Patterns

- **Severity:** INFO  
- **File:** All  
- **Description:** The code uses wagmi v3 hooks and viem v2 utilities correctly, including `createConfig`, `fallback` transport, and ENS normalization.  
- **Recommendation:** Continue following wagmi and viem docs for updates. Consider upgrading to latest patch versions regularly.

---

### 7. Configuration: RPC Endpoint Reliability and Security

- **Severity:** LOW  
- **File:** `client/src/lib/wagmi.ts` (RPC URLs and fallback transports)  
- **Description:** Multiple RPC endpoints are configured with fallback and retry logic, which is good for reliability. However, some endpoints are public and may have rate limits or privacy concerns.  
- **Recommendation:**  
  - Monitor RPC endpoint health and usage.  
  - Consider adding private or dedicated RPC endpoints for production.  
  - Use HTTPS exclusively (already done).  
  - Validate environment variable `VITE_WALLETCONNECT_PROJECT_ID` is set in production.  
- **No immediate fix needed.**

---

### 8. Wallet Safety: Auto-Connect Disabled and Session Storage

- **Severity:** INFO  
- **File:** `client/src/lib/wagmi.ts` (wagmiConfig)  
- **Description:** Auto-connect is disabled by setting `storage: null`, requiring explicit user wallet connection each session. This is a strong security practice to prevent stale or compromised sessions.  
- **Recommendation:** Maintain this setting. Optionally, provide a user-controlled "remember me" feature with clear warnings.

---

### 9. Wallet Safety: Signature Verification Not Present

- **Severity:** MEDIUM  
- **File:** N/A (not implemented in audited files)  
- **Description:** The wallet connection flow does not include explicit signature verification or challenge-response to prove wallet ownership beyond connection. This may be acceptable depending on app requirements but is a common best practice for sensitive actions.  
- **Recommendation:**  
  - Implement optional signature challenge on login or sensitive operations to verify wallet control.  
  - Use nonce-based signed messages to prevent replay attacks.  
- **Example:**  
```ts
const message = `Sign this message to authenticate with HERO Dapp at ${new Date().toISOString()}`;
const signature = await signer.signMessage(message);
// Verify signature server-side or client-side
```

---

### 10. React Best Practices: Avoid Unnecessary Re-renders

- **Severity:** LOW  
- **File:** `client/src/components/WalletButton.tsx`  
- **Description:** The component uses `useMemo` and `useCallback` appropriately. However, some inline functions and JSX could be memoized further to optimize rendering.  
- **Recommendation:**  
  - Memoize `truncateAddress` and `formatBalance` if used frequently.  
  - Extract connector button rendering into a memoized subcomponent.  
- **No critical fix needed.**

---

# Summary Table of Issues

| Severity | File                         | Description                                      | Recommendation Summary                         |
|----------|------------------------------|------------------------------------------------|-----------------------------------------------|
| CRITICAL | N/A                          | Missing peer dependencies caused runtime errors| Already fixed by installing required packages |
| HIGH     | WalletButton.tsx              | Potential XSS via ENS avatar URLs                | Sanitize URLs, enforce CSP, proxy images      |
| MEDIUM   | WalletButton.tsx              | Clipboard API usage without fallback             | Add fallback UI, error logging                 |
| LOW      | WalletButton.tsx              | Connection timeout handling                       | Expose timeout config, improve error handling |
| MEDIUM   | wagmi.ts + WalletButton.tsx   | Eager loading of wallet connectors               | Lazy load connectors dynamically               |
| INFO     | All                          | Good use of wagmi v3 and viem v2 patterns        | Continue following best practices               |
| LOW      | wagmi.ts                     | Public RPC endpoints may have limits/privacy     | Monitor and consider private RPCs               |
| INFO     | wagmi.ts                     | Auto-connect disabled for wallet safety          | Maintain current config                          |
| MEDIUM   | N/A                          | No signature verification on wallet connect      | Implement optional signature challenge          |
| LOW      | WalletButton.tsx              | Minor React performance optimizations possible   | Memoize helper functions and subcomponents      |

---

# Overall Grade: **A-**

**Rationale:**  
The wallet connection system is robust, secure, and user-friendly with good error handling and fallback logic. The critical peer dependency issue has been resolved. The main security concern is the potential XSS risk from untrusted ENS avatar URLs, which should be mitigated with sanitization and CSP. Performance can be improved by lazy loading wallet connectors. Wallet safety is strong with auto-connect disabled, but signature verification could be added for enhanced security.

---

# Actionable Recommendations Summary

1. **Sanitize ENS Avatar URLs and enforce CSP** to prevent XSS attacks.  
2. **Lazy load wallet connectors** to reduce initial bundle size and improve performance.  
3. **Consider implementing signature verification** for wallet ownership proof on login or sensitive actions.  
4. **Monitor RPC endpoints** and consider private endpoints for production.  
5. **Maintain auto-connect disabled** to prevent stale wallet sessions.  
6. **Add clipboard API fallbacks and error logging** for better UX and diagnostics.  
7. **Memoize helper functions and subcomponents** in React to optimize rendering.

---

Please reach out if you need code examples or assistance implementing these recommendations.