Review note: this branch is intentionally limited to holder-verification safety and NFT V2 planning docs. No deployment is included.

---

## Build Hotfix Review Note (2026-06-18)

**Reviewer action required:** The build hotfix adds 3 minimal component stubs and 1 route redirect. These are the minimum changes required to unblock `pnpm build`.

**Stubs added:**
- `WalletButton.tsx` — renders login link only; no wallet custody
- `WalletIdentity.tsx` — renders truncated address; no wallet custody
- `ConnectWalletPrompt.tsx` — renders login link card; no wallet custody

**Route change:**
- `/wallet` now redirects to `/portfolio` (the existing holdings page)

**These stubs are intentionally minimal.** Full wallet connect UI (wagmi/RainbowKit) should be implemented in a separate PR after V2 contracts are deployed and audited.

**No secrets. No contract writes. No API calls. No private key handling.**
