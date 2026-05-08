# HERO Ecosystem Architecture Blueprint v2
## Last Updated: May 7, 2026

---

## Overview
**HeroBase.io** is a multi-chain DeFi DApp serving PulseChain (369) and BASE (8453) networks. Built for Veterans, by Veterans. Supports $HERO and $VETS tokens with DEX aggregation, staking, DAO governance, and community features.

---

## Infrastructure

| Component | Location | Details |
|-----------|----------|---------|
| Frontend + Server | VPS1 (62.146.175.67) | Express + Vite SSR, PM2 managed |
| Domain | herobase.io | Cloudflare DNS + CDN |
| Database | MySQL on VPS1 | DAO proposals, votes, user data |
| CDN Assets | d2xsxph8kpxj0f.cloudfront.net | Images, videos, static assets |
| Git Repo | GitHub (private) | Auto-sync cron on VPS1 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + MARPAT Woodland Camo theme |
| State | React Context (Network, Language, Auth, Prices) |
| Backend | Express + tRPC |
| Database | MySQL (Drizzle ORM) |
| Auth | Wallet-based (ethers.js) + JWT sessions |
| Web3 | wagmi + viem + WalletConnect |
| Process Mgr | PM2 (id: 11, name: hero-dapp) |

---

## Routes (App.tsx)

| Route | Page | Description |
|-------|------|-------------|
| / | Home | Landing page |
| /start | StartHere | Onboarding guide |
| /wallet | HeroWallet | Multi-tab wallet (Send, Receive, History, Discover DApps) |
| /swap | Swap | DEX aggregator with route comparison + price impact |
| /dashboard | Dashboard | Market overview + Treasury display |
| /portfolio | Portfolio | Token balances, P&L, transaction history |
| /stake | Stake | Farm pools (PulseChain) |
| /stake/base | StakeBase | Farm pools (BASE) |
| /hero-stake | HeroStake | Single-sided HERO staking → DAI rewards |
| /spin | SpinWheel | Daily spin (requires HERO NFT) |
| /nft | NftCollection | HERO NFT gallery |
| /dao | DAO | Governance proposals + voting |
| /community | Blog | Blog posts + Twitter mentions |
| /community-hub | CommunityHub | Weekly Blog + Monster Threads + Video + Quick Vote |
| /media | MediaHub | Video content + explainer |
| /charts | Charts | TradingView integration |
| /analytics | Analytics | DexScreener + market data |
| /bridge | Bridge | Cross-chain bridge tools |

---

## Key Components (Phase 1-5 Additions)

### Phase 1: DApp Browser
- `client/src/components/DiscoverTab.tsx` — 42+ DApp directory with search, favorites, categories
- `client/src/components/AppLayout.tsx` — Collapsible sidebar with grouped dropdowns

### Phase 2: Swap Intelligence
- `client/src/components/RouteComparison.tsx` — Best-rate routing across DEXes
- `client/src/components/PriceImpactWarning.tsx` — Color-coded impact indicator
- `client/src/components/SlippageSettings.tsx` — Slippage/gas/MEV settings
- `client/src/components/SwapHistory.tsx` — Recent swaps with CSV export

### Phase 3: Portfolio & Analytics
- `client/src/components/PortfolioPnL.tsx` — P&L visualization with DexScreener
- `client/src/components/TransactionHistory.tsx` — TX history with explorer links

### Phase 4: Staking & Rewards
- `client/src/components/RewardsDashboard.tsx` — Consolidated rewards view
- `client/src/components/LPPositionMonitor.tsx` — LP tracking + impermanent loss

### Phase 5: Community & Governance
- `client/src/components/CommunityFeed.tsx` — Unified activity stream
- `client/src/components/QuickVote.tsx` — Inline proposal voting
- `client/src/components/CommunityStats.tsx` — Holder/voter/treasury stats

### Additional
- `client/src/components/TreasuryDisplay.tsx` — Real-time treasury balances (PLS + BASE)
- `client/src/pages/CommunityHub.tsx` — Weekly Blog + Monster Threads + Video

---

## Contexts

| Context | Purpose |
|---------|---------|
| NetworkContext | Chain switching (PLS/BASE), DEX sources, RPC URLs |
| LanguageContext | i18n with 12 languages (ES, FR, DE, JA, KO, ZH, etc.) |
| AuthContext | Wallet connection, JWT sessions |
| PriceContext | DexScreener price feeds for HERO, VETS, PLS |

---

## Smart Contracts

### PulseChain (369)
| Contract | Address | Purpose |
|----------|---------|---------|
| HERO Token | 0x...TBD | ERC-20 |
| VETS Token | 0x...TBD | ERC-20 |
| SSS Staking | Configured in useStaking.ts | Single-sided staking → DAI |
| Treasury | 0x94e52915b99ffdd298939f9e0b4a7af80e6789f7 | Community treasury |

### BASE (8453)
| Contract | Address | Purpose |
|----------|---------|---------|
| HERO Token | Configured in tokens.ts | ERC-20 |
| SSS Staking | Configured in useStaking.ts | Single-sided staking → DAI |
| Treasury | 0x94e52915b99ffdd298939f9e0b4a7af80e6789f7 | Community treasury |

---

## On-Chain Status (as of May 7, 2026)

| Metric | PulseChain | BASE |
|--------|-----------|------|
| Treasury HERO | 0 | 0 |
| Treasury Native | 4,974,444 PLS | 0 ETH |
| SSS Reward Pool | 500 DAI | 0 DAI |
| Total Staked | 0 HERO | 0 HERO |
| APY | 0% (no stakers) | 0% (no stakers) |
| DAO Proposals | 1 (TEST) | N/A |
| DAO Votes Cast | 0 | N/A |

---

## Deployment Pipeline

```
1. Edit source on VPS1: /root/hero-dapp/
2. Build: cd /root/hero-dapp && npx vite build
3. Deploy: cp -r dist/* /var/www/hero-dapp/
4. Restart: pm2 restart hero-dapp
5. Verify: curl -s http://localhost:3001
6. Commit: git add -A && git commit -m "..." && git push
7. Purge CDN: Cloudflare API purge cache
```

---

## PM2 Processes on VPS1

| ID | Name | Status | Purpose |
|----|------|--------|---------|
| 11 | hero-dapp | online | Main DApp server |
| 0 | hero-terminal | online | PulseChain trading terminal |
| 1 | hero-terminal-base | online | BASE trading terminal |
| 4 | Hero-ABLE | online | PulseChain ABLE bot |
| 5 | Hero-ABLE-Base | online | BASE ABLE bot |
| 6 | hero-vets-pulse | online | VETS volume bot |
| 7 | base-hero-vol | online | BASE HERO volume bot |

---

## Security Measures
- Wallet-based auth (no passwords stored)
- JWT sessions with expiry
- CORS restricted to herobase.io
- Cloudflare WAF + DDoS protection
- Rate limiting on API endpoints
- On-chain token verification for DAO voting
- URL validation on all external links
- BigInt guards on RPC responses
- Mounted ref cleanup on async operations

---

## Design System
- **Theme**: MARPAT Woodland Digital Camo (USMC)
- **Background**: CDN-hosted camo image with navy overlay (72% opacity)
- **Colors**: Coyote Brown primary, Navy dark, Cream accents, Orange highlights
- **Font**: System + custom heading fonts
- **Branding**: "HERO DApp" (not DEX), enlarged HERO text in sidebar
- **Header**: HERO banner image from CDN

---

## Daily Auto-Update Checklist
1. Check for new git commits on VPS1
2. Verify all routes respond 200
3. Check PM2 process health
4. Regenerate blueprint if changes detected
5. Verify treasury balances haven't changed unexpectedly
6. Check Cloudflare for any security alerts
