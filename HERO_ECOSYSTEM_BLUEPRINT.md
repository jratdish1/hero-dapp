# HERO Ecosystem Architecture Blueprint
## herobase.io — Master Knowledge Document
**Last Updated:** 2025-05-08 | **Auto-Update:** Daily via Manus scheduled task

---

## 1. System Overview

| Property | Value |
|----------|-------|
| Domain | herobase.io |
| Server | VPS1 (Contabo vmi2941473) |
| Reverse Proxy | Nginx + SSL (Let's Encrypt) |
| App Server | PM2 → Node.js (Express + tRPC) |
| Port | 3001 (internal) → 443 (public) |
| Database | MySQL (drizzle-orm) |
| Frontend | React 19 + Tailwind 4 + shadcn/ui |
| Routing | Wouter (client-side) |
| State | Wagmi + TanStack Query + tRPC |
| Wallet | WalletConnect + MetaMask + Rabby |
| Git | /root/hero-dapp (main branch) |
| Production | /var/www/hero-dapp |
| Build | Vite 7 → dist/ |

---

## 2. Chain Configuration

| Chain | ID | RPC | HERO Token |
|-------|-----|-----|------------|
| PulseChain | 369 | https://rpc.pulsechain.com | 0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27 |
| BASE | 8453 | https://mainnet.base.org | 0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8 |

---

## 3. Route Architecture (37 routes)

### Core Pages
| Route | Component | Description |
|-------|-----------|-------------|
| / | Home | Landing page with hero, tokenomics preview, live ticker |
| /wallet | HeroWallet | Multi-tab wallet: Assets, Send, Receive, Activity, Discover |
| /swap | Swap | DEX aggregator with Switch.xyz, SquirrelSwap, Liberty Swap |
| /portfolio | Portfolio | Token balances, P&L tracker, transaction history |
| /stake | Stake | Farm pools overview, partner protocols |
| /stake/dai | HeroStake | HERO staking with DAI rewards |
| /stake/base | BaseStake | BASE chain staking |

### DeFi & Trading
| Route | Component | Description |
|-------|-----------|-------------|
| /bootcamp | Farm | Yield farming bootcamp |
| /limit-orders | LimitOrders | Limit order placement |
| /dca | DcaOrders | Dollar-cost averaging |
| /approvals | Approvals | Token approval management |
| /bots | AbleBots | ABLE trading bots interface |
| /burn | BuyAndBurn | Buy & burn mechanism tracker |
| /dex-analytics | DexAnalytics | DEX volume/liquidity analytics |

### Community & Governance
| Route | Component | Description |
|-------|-----------|-------------|
| /community-hub | CommunityHub | Unified feed + voting + stats |
| /community | Blog | Blog/news articles |
| /dao | DaoDashboard | DAO governance overview |
| /dao/proposals | Proposals | All proposals list |
| /dao/proposals/create | CreateProposal | Create new proposal |
| /dao/proposals/:id | ProposalDetail | Proposal detail + voting |
| /dao/treasury | Treasury | Treasury management |
| /dao/delegates | Delegates | Delegate directory |
| /dao-proposals | DAOProposals | Legacy proposals page |
| /holder-rewards | HolderRewards | Holder reward tracking |

### NFT & Media
| Route | Component | Description |
|-------|-----------|-------------|
| /nft | NftCollection | NFT gallery |
| /nft-mint | NFTMint | NFT minting interface |
| /media | MediaHub | Community media sharing |
| /giveaways | Giveaways | Raffle/giveaway system |
| /spin | SpinWheel | Spin-to-win game |

### Info & Onboarding
| Route | Component | Description |
|-------|-----------|-------------|
| /tokenomics | Tokenomics | Token economics breakdown |
| /explainer | Explainer | Video explainer page |
| /start | Onboarding | New user onboarding flow |
| /ecosystem | EcosystemDirectory | Partner ecosystem directory |
| /directory | EcosystemDirectory | DApp directory (alt route) |
| /ai | AiAssistant | AI chat assistant |

---

## 4. Component Architecture

### Custom Components (35 files)
```
components/
├── AIChatBox.tsx          — AI assistant chat interface
├── AppLayout.tsx          — Main layout with collapsible sidebar
├── CommunityFeed.tsx      — [Phase 5] Unified activity stream
├── CommunityStats.tsx     — [Phase 5] Community metrics banner
├── ConnectWalletPrompt.tsx — Wallet connection CTA
├── DashboardLayout.tsx    — Dashboard grid layout
├── DiscoverTab.tsx        — [Phase 1] DApp browser (42+ apps)
├── ErrorBoundary.tsx      — React error boundary
├── FloatingSocial.tsx     — Floating social links
├── IntroOverlay.tsx       — First-visit overlay
├── LPPositionMonitor.tsx  — [Phase 4] LP tracking + IL calc
├── LiveTicker.tsx         — Real-time price ticker
├── NFTCarousel.tsx        — NFT image carousel
├── NetworkSwitcher.tsx    — PulseChain/BASE toggle
├── PortfolioPnL.tsx       — [Phase 3] P&L visualization
├── PriceImpactWarning.tsx — [Phase 2] Swap price impact
├── PriceTicker.tsx        — Token price display
├── QuickVote.tsx          — [Phase 5] Inline proposal voting
├── RewardsDashboard.tsx   — [Phase 4] Consolidated rewards
├── RouteComparison.tsx    — [Phase 2] DEX route comparison
├── SlippageSettings.tsx   — [Phase 2] Swap settings panel
├── SquirrelSwapWidget.tsx — SquirrelSwap embed
├── SwapHistory.tsx        — [Phase 2] Recent swaps log
├── ThemeToggle.tsx        — Dark/light theme switch
├── TradingViewChart.tsx   — TradingView chart embed
├── TransactionCostCalc.tsx — Gas cost calculator
├── TransactionHistory.tsx — [Phase 3] TX history with filters
├── WalletButton.tsx       — Wallet connect button
└── ui/                    — 40+ shadcn/ui primitives
```

### Hooks (7 files)
```
hooks/
├── useComposition.ts    — Input composition handling
├── useMobile.tsx        — Mobile breakpoint detection
├── usePageSEO.ts        — Dynamic SEO meta tags
├── usePersistFn.ts      — Stable function reference
├── usePrices.ts         — DexScreener price fetching
├── useStaking.ts        — Staking contract interactions
└── useTokenBalance.ts   — ERC-20 balance reading
```

### Contexts (4 files)
```
contexts/
├── LanguageContext.tsx   — i18n language state
├── NetworkContext.tsx    — Active chain (PLS/BASE) + DEX sources
├── ThemeContext.tsx      — Dark/light theme
└── WagmiContext.tsx      — Wallet connection provider
```

---

## 5. Server Architecture

### Backend Stack
- **Express** — HTTP server
- **tRPC** — Type-safe API layer
- **Drizzle ORM** — MySQL database access
- **PM2** — Process management (id: 11, name: hero-dapp)

### Server Modules
| File | Purpose |
|------|---------|
| routers.ts | Main tRPC router (DAO, blog, votes, delegates, mentions) |
| db.ts | Database connection + schema |
| priceFeed.ts | Token price aggregation |
| telegramBot.ts | Telegram notification bot |
| twitterFetcher.ts | Twitter/X mention scraping |
| mentionScheduler.ts | Scheduled mention collection |
| vrf-provider.ts | Verifiable random function for raffles |
| spin-engine.ts | Spin wheel game logic |
| raffle-engine.ts | Giveaway/raffle engine |
| rewards-engine.ts | Holder reward distribution |
| email-notify.ts | Email notification system |
| storage.ts | S3 file storage |

### tRPC Router Endpoints
- `dao.stats` — DAO statistics
- `dao.proposals.list/get/create/updateStatus` — Proposal CRUD
- `dao.votes.list/getUserVote/cast` — Voting system
- `dao.delegates.list/register` — Delegate management
- `blog.list/get/generate` — Blog with AI generation
- `mentions.list/create` — Social mention tracking

---

## 6. Deployment Pipeline

```
Developer → git push → VPS1:/root/hero-dapp
                              ↓
                        npx vite build
                              ↓
                        cp dist/* /var/www/hero-dapp/
                              ↓
                        pm2 restart hero-dapp
                              ↓
                        Nginx (443) → Node (3001)
                              ↓
                        herobase.io LIVE
```

### Git History (Key Commits)
```
4d2b9a2 Phase 5 audit: setTimeout cleanup refs
5c18452 Phase 5: Community & Governance Hub
312af51 Phase 4 audit fixes
5d62e87 Phase 4: Staking & Rewards Dashboard
2bd6a99 Phase 3 audit fixes
045f525 Phase 3: Portfolio & Analytics
dd485a2 Phase 2 audit fixes
6a1ec13 Phase 2: Swap Intelligence
532e9b6 Discover DApps without wallet
f46b9eb Add /wallet route
8e796ce Phase 1: DApp Browser
70f44b8 SNAPSHOT: Pre-Phase1 fallback
```

---

## 7. Dependencies (Key Packages)

| Category | Packages |
|----------|----------|
| UI | React 19, Tailwind 4, shadcn/ui (Radix), Lucide icons, Framer Motion |
| State | TanStack Query 5, tRPC 11, Wagmi 3 |
| Wallet | WalletConnect, @wagmi/connectors |
| Charts | TradingView (embed), Lightweight Charts 5 |
| Server | Express 4, Helmet, express-rate-limit |
| Database | Drizzle ORM, MySQL2 |
| Auth | Jose (JWT), cookie-based sessions |
| Build | Vite 7, TypeScript 5.9, esbuild |
| Testing | Vitest 2 |

---

## 8. Security Measures

- **Helmet** — HTTP security headers
- **Rate Limiting** — express-rate-limit on all endpoints
- **On-Chain Voting Verification** — Reads real HERO balance for voting power
- **JWT Auth** — Jose library for session tokens
- **SSL/TLS** — TLSv1.2/1.3 only, strong cipher suite
- **Input Validation** — Zod schemas on all tRPC inputs
- **XSS Prevention** — React default escaping + no dangerouslySetInnerHTML

---

## 9. Roadmap Status

| Phase | Feature | Status | Commit |
|-------|---------|--------|--------|
| 1 | DApp Browser + Sidebar | ✅ COMPLETE | 8e796ce |
| 2 | Swap Intelligence | ✅ COMPLETE + AUDITED | dd485a2 |
| 3 | Portfolio & Analytics | ✅ COMPLETE + AUDITED | 2bd6a99 |
| 4 | Staking & Rewards | ✅ COMPLETE + AUDITED | 312af51 |
| 5 | Community & Governance | ✅ COMPLETE + AUDITED | 4d2b9a2 |

---

## 10. PM2 Process Ecosystem (VPS1)

| ID | Name | Purpose | Status |
|----|------|---------|--------|
| 11 | hero-dapp | Main DApp server | online |
| 4 | Hero-ABLE | ABLE bot (PulseChain) | online |
| 5 | Hero-ABLE-Base | ABLE bot (BASE) | online |
| 7 | base-hero-vol | Volume bot (BASE) | online |
| 6 | hero-vets-pulse | HERO/VETS bot (PLS) | online |
| 0 | hero-terminal | Trading terminal (PLS) | online |
| 1 | hero-terminal-base | Trading terminal (BASE) | online |
| 22 | cross-exchange-arb | Cross-exchange arbitrage | online |
| 14 | hermes-control-interface | Hermes control panel | online |
| 20 | kalshi-scalper | Kalshi prediction scalper | online |
| 19 | volt-kraken | Kraken trading bot | online |
| 21 | weather-forecast-bot | Weather forecast bot | online |
| 3 | regen-admin | Regen Valor admin | online |
| 9 | regen-valor | Regen Valor site | online |
| 2 | valor-peptides | Valor Peptides site | online |

---

## 11. Fallback & Recovery

- **Pre-Phase1 Snapshot:** Commit `70f44b8` — clean state before all roadmap work
- **Git History:** Full rollback capability to any commit
- **Production Path:** /var/www/hero-dapp (separate from source)
- **Daily Blueprint Update:** Scheduled task auto-checks for changes

---

## 12. API Integrations

| Service | Usage | Endpoint |
|---------|-------|----------|
| DexScreener | Token prices, charts | https://api.dexscreener.com/latest/dex/ |
| Switch.xyz | Swap aggregation | Embedded widget |
| SquirrelSwap | DEX swap | Embedded widget |
| PulseChain RPC | On-chain reads | https://rpc.pulsechain.com |
| BASE RPC | On-chain reads | https://mainnet.base.org |
| Telegram Bot API | Notifications | Bot token in .env |
| Twitter/X | Mention tracking | Scraper module |
| S3 (AWS) | File storage | @aws-sdk/client-s3 |

---

## 13. Environment Variables (Required)

```
DATABASE_URL=mysql://...
SESSION_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TWITTER_BEARER_TOKEN=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_BUCKET_NAME=...
OPENAI_API_KEY=... (for AI assistant)
```

---

*This blueprint is auto-updated daily. Any structural changes to herobase.io are captured and reflected here.*
