# HeroBase.io — Master Knowledge & Architectural Blueprint

**Version**: 2.0 | **Date**: April 16, 2026 | **Author**: VDS Autonomous System
**Repository**: `jratdish1/hero-dapp` (private) | **Branch**: `main`
**Latest Commit**: `18c54f5` (post-audit)
**Purpose**: Complete system transfer document for any LLM or developer to pick up and continue development from the current state.

---

## Table of Contents

1. [Project Identity](#1-project-identity)
2. [Infrastructure Map](#2-infrastructure-map)
3. [Technology Stack](#3-technology-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [File Structure & Module Map](#5-file-structure--module-map)
6. [Routing & Navigation](#6-routing--navigation)
7. [Data Layer](#7-data-layer)
8. [Blockchain Integration](#8-blockchain-integration)
9. [Token Registry](#9-token-registry)
10. [Feature Modules](#10-feature-modules)
11. [Security Model](#11-security-model)
12. [External Services & APIs](#12-external-services--apis)
13. [Deployment & CI/CD](#13-deployment--cicd)
14. [Known Issues & Technical Debt](#14-known-issues--technical-debt)
15. [Development Conventions](#15-development-conventions)
16. [Operational Playbook](#16-operational-playbook)
17. [Appendix A: Complete File Inventory](#appendix-a-complete-file-inventory)
18. [Appendix B: Contract Addresses](#appendix-b-contract-addresses)
19. [Appendix C: CDN Asset Registry](#appendix-c-cdn-asset-registry)

---

## 1. Project Identity

**HeroBase.io** (also branded as **HERO Dapp**) is a dual-chain DeFi platform built for the HERO and VETS token ecosystem. It operates on both **PulseChain** (chain ID 369) and **BASE** (chain ID 8453), providing a unified interface for token swapping, yield farming, staking, portfolio tracking, DAO governance, NFT collection management, and AI-assisted analytics.

The project is founded by **VETS** (VetsInCrypto), a Marine Corps veteran and crypto founder. The platform serves the veteran community with a military-themed design language (dark backgrounds, orange/green accents, steampunk-military NFT aesthetic).

**Key Branding**:
- Primary color: `--hero-orange` (#F97316 / oklch(0.75 0.18 55))
- Secondary color: `--hero-green` (#22C55E / oklch(0.77 0.2 150))
- Theme: Dark military, steampunk accents
- Logo: HERO shield emblem (CDN-hosted)
- KYC: Verified by SpyWolf (badge displayed on homepage and sidebar)

---

## 2. Infrastructure Map

| Component | Host | IP / Domain | Purpose |
|-----------|------|-------------|---------|
| VPS1 (Primary) | Contabo VPS | vmi2941473.contaboserver.net | Hosts hero-dapp, nginx reverse proxy, PM2 process manager |
| VPS2 (Secondary) | Contabo VPS | (configured in VDS) | Backup/staging, additional services |
| VDS (Command Center) | Manus VDS | SSH alias `vds` | Orchestration hub, SSH jump host to VPS1/VPS2 |
| Cloudflare | Cloudflare | herobase.io | DNS, CDN, DDoS protection, SSL termination |
| GitHub | github.com | jratdish1/hero-dapp | Source code repository (private) |
| CDN (Assets) | CloudFront | d2xsxph8kpxj0f.cloudfront.net | Static images, logos, banners |
| Database | PostgreSQL | Local on VPS1 | User data, blog posts, media, proposals |
| Telegram Bot | Telegram API | @HeroBaseBot | Community notifications, price alerts |

**SSH Access Chain**: `Sandbox → VDS → VPS1` (via `ssh vds "ssh vps1 '<command>'"`)

**Process Management**: PM2 runs the Node.js server on VPS1. The app listens on port 5000 (Express + Vite dev server in development, or Express serving static build in production).

---

## 3. Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 6.x | Build tool & dev server |
| Tailwind CSS | 4.x | Utility-first styling |
| shadcn/ui | Latest | Component library (Radix primitives) |
| Wouter | 3.x | Client-side routing (lightweight) |
| wagmi | 2.x | Ethereum/EVM wallet integration |
| @tanstack/react-query | 5.x | Server state management |
| @trpc/client | 11.x | Type-safe API client |
| Sonner | Latest | Toast notifications |
| Lucide React | Latest | Icon library |
| Recharts | 2.x | Charts and data visualization |
| Streamdown | Latest | Markdown streaming renderer (AI chat) |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Express | 4.x | HTTP server |
| tRPC | 11.x | Type-safe API layer |
| Drizzle ORM | Latest | Database queries (PostgreSQL) |
| node-telegram-bot-api | Latest | Telegram bot integration |
| express-rate-limit | Latest | API rate limiting |
| helmet | Latest | Security headers |
| jose | Latest | JWT session management |
| zod | 3.x | Schema validation |

### Shared

| Technology | Purpose |
|------------|---------|
| TypeScript | Shared types between client/server |
| Zod schemas | Shared validation (ethAddress, safeString, tokenSymbol) |
| Token registry | Shared token metadata (addresses, logos, chain IDs) |

---

## 4. Architecture Overview

The application follows a **monorepo** structure with three main layers:

```
┌─────────────────────────────────────────────────┐
│                   CLIENT (React)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Pages   │ │Components│ │ Contexts/Hooks   │ │
│  │ (20+)    │ │ (15+)    │ │ Network, Lang,   │ │
│  │          │ │          │ │ Prices, Balance  │ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │             │                │           │
│       └─────────────┼────────────────┘           │
│                     │                            │
│              ┌──────┴──────┐                     │
│              │  tRPC Client│                     │
│              └──────┬──────┘                     │
├─────────────────────┼───────────────────────────┤
│                SHARED LAYER                      │
│  ┌──────────────────┴──────────────────────┐    │
│  │ tokens.ts | const.ts | types | schemas  │    │
│  └─────────────────────────────────────────┘    │
├─────────────────────┼───────────────────────────┤
│                SERVER (Express + tRPC)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Routers  │ │ Services │ │   Database       │ │
│  │ (tRPC)   │ │ Price,   │ │   (Drizzle +     │ │
│  │          │ │ Telegram,│ │    PostgreSQL)    │ │
│  │          │ │ Twitter  │ │                   │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Key Architectural Decisions**:
1. **Dual-chain support** via `NetworkContext` — all components receive `chainId`, `isPulseChain`, `isBase` from context
2. **tRPC for type-safe API** — client and server share router types, no manual API typing
3. **Direct DexScreener API calls** for real-time price data (client-side, no server proxy needed)
4. **Server-side price caching** via tRPC endpoints for aggregated market data
5. **Wallet integration** via wagmi with WalletConnect v2 support (MetaMask, Rabby, Trust, Ledger, 300+ wallets)
6. **Multi-language support** via LanguageContext (8 languages: EN, ES, FR, DE, PT, JA, KO, ZH)

---

## 5. File Structure & Module Map

```
hero-dapp/
├── client/
│   ├── index.html                    # HTML entry point
│   ├── src/
│   │   ├── main.tsx                  # React entry (wagmi + tRPC + query providers)
│   │   ├── App.tsx                   # Router (25 routes) + ErrorBoundary
│   │   ├── index.css                 # Global styles, CSS variables, Tailwind config
│   │   ├── const.ts                  # Client-side constants (OAuth URL builder)
│   │   ├── pages/
│   │   │   ├── Home.tsx              # Landing page (453 lines)
│   │   │   ├── Dashboard.tsx         # Market overview with live prices
│   │   │   ├── Swap.tsx              # DEX aggregator swap interface (570 lines)
│   │   │   ├── Farm.tsx              # PulseChain yield farming (1,164 lines)
│   │   │   ├── BaseFarm.tsx          # BASE chain farming (404 lines)
│   │   │   ├── HeroStake.tsx         # HERO → DAI staking (357 lines)
│   │   │   ├── Portfolio.tsx         # Wallet portfolio tracker (471 lines)
│   │   │   ├── LimitOrders.tsx       # Limit order interface
│   │   │   ├── DcaOrders.tsx         # DCA (Dollar Cost Average) orders
│   │   │   ├── Approvals.tsx         # Token approval manager
│   │   │   ├── NftCollection.tsx     # 555 NFT military trading cards (605 lines)
│   │   │   ├── Tokenomics.tsx        # Token economics & flywheel (623 lines)
│   │   │   ├── Blog.tsx              # News/blog with admin CRUD (700 lines)
│   │   │   ├── MediaHub.tsx          # Community media uploads (611 lines)
│   │   │   ├── Explainer.tsx         # Onboarding explainer (382 lines)
│   │   │   ├── AiAssistant.tsx       # AI chat assistant
│   │   │   ├── Onboarding.tsx        # New user onboarding flow
│   │   │   ├── dao/
│   │   │   │   ├── DaoDashboard.tsx  # DAO overview
│   │   │   │   ├── Proposals.tsx     # Proposal listing
│   │   │   │   ├── ProposalDetail.tsx# Individual proposal view
│   │   │   │   ├── CreateProposal.tsx# Proposal creation form
│   │   │   │   ├── Treasury.tsx      # Treasury dashboard
│   │   │   │   ├── Delegates.tsx     # Delegate voting
│   │   │   │   └── index.ts          # Barrel exports
│   │   │   └── not-found.tsx         # 404 page
│   │   ├── components/
│   │   │   ├── AppLayout.tsx         # Main app shell (sidebar + header + footer)
│   │   │   ├── WalletButton.tsx      # Wallet connect/disconnect modal (350 lines)
│   │   │   ├── NetworkSwitcher.tsx   # PulseChain ↔ BASE chain switcher
│   │   │   ├── PriceTicker.tsx       # Scrolling price ticker bar
│   │   │   ├── ConnectWalletPrompt.tsx # Reusable wallet connection CTA
│   │   │   ├── ExplainerVideoModal.tsx # Video modal component
│   │   │   ├── ErrorBoundary.tsx     # React error boundary
│   │   │   ├── ThemeToggle.tsx       # Dark/light theme switch
│   │   │   ├── DashboardLayout.tsx   # Dashboard-specific layout
│   │   │   └── ui/                   # shadcn/ui components (30+ files)
│   │   ├── contexts/
│   │   │   ├── NetworkContext.tsx     # Chain ID, network switching
│   │   │   └── LanguageContext.tsx    # i18n (8 languages, 1,060 lines)
│   │   ├── hooks/
│   │   │   ├── usePrices.ts          # Market data hooks (useMarketOverview, useFarmPools, etc.)
│   │   │   ├── useTokenBalance.ts    # On-chain token balance reader
│   │   │   └── use-mobile.tsx        # Responsive breakpoint hook
│   │   └── lib/
│   │       ├── trpc.ts               # tRPC client setup
│   │       ├── wagmi.ts              # Wagmi config (PulseChain + BASE chains)
│   │       └── utils.ts              # Utility helpers (cn, etc.)
│   └── public/
│       └── favicon.ico
├── server/
│   ├── index.ts                      # Express server entry
│   ├── routers.ts                    # tRPC router (927 lines, all API endpoints)
│   ├── db.ts                         # Drizzle ORM database connection
│   ├── storage.ts                    # File storage (S3-compatible)
│   ├── priceFeed.ts                  # DexScreener price aggregation + caching
│   ├── telegramBot.ts               # Telegram bot for community alerts
│   ├── twitterFetcher.ts            # Twitter/X feed integration
│   └── _core/                        # Manus platform SDK (DO NOT MODIFY)
│       ├── sdk.ts                    # Auth, sessions, JWT
│       ├── dataApi.ts                # Data API client
│       ├── security.ts               # Rate limiting, helmet, CORS
│       └── map.ts                    # Maps proxy
├── shared/
│   ├── tokens.ts                     # Token registry, contract addresses, CDN assets
│   ├── const.ts                      # Shared constants
│   └── schema.ts                     # Zod validation schemas
├── drizzle/                          # Database migrations (on VPS1)
├── package.json                      # Dependencies & scripts
├── vite.config.ts                    # Vite build configuration
├── tsconfig.json                     # TypeScript configuration
└── tailwind.config.ts                # Tailwind CSS configuration
```

---

## 6. Routing & Navigation

### Route Table (25 routes)

| Path | Component | Layout | Status |
|------|-----------|--------|--------|
| `/` | Home | Standalone | Live |
| `/swap` | Swap | AppLayout | Live |
| `/dashboard` | Dashboard | AppLayout | Live |
| `/portfolio` | Portfolio | AppLayout | Live |
| `/dca` | DcaOrders | AppLayout | Live |
| `/limits` | LimitOrders | AppLayout | Live |
| `/approvals` | Approvals | AppLayout | Live |
| `/farm` | Farm | AppLayout | Live |
| `/farm/base` | BaseFarm | AppLayout | Live (added in audit) |
| `/stake` | HeroStake | AppLayout | Live (added in audit) |
| `/start` | Onboarding | AppLayout | Live (added in audit) |
| `/media` | Blog | AppLayout | Live |
| `/ai` | AiAssistant | AppLayout | Live |
| `/tokenomics` | Tokenomics | AppLayout | Live |
| `/nft` | NftCollection | AppLayout | Live |
| `/ecosystem` | Ecosystem | AppLayout | Live |
| `/community` | MediaHub | AppLayout | Live |
| `/dao` | DaoDashboard | AppLayout | Live |
| `/dao/proposals` | Proposals | AppLayout | Live |
| `/dao/proposals/create` | CreateProposal | AppLayout | Live |
| `/dao/proposals/:id` | ProposalDetail | AppLayout | Live |
| `/dao/treasury` | Treasury | AppLayout | Live |
| `/dao/delegates` | Delegates | AppLayout | Live |
| `/explainer` | Explainer | AppLayout | Live |
| `/beta-disclaimer` | BetaDisclaimer | Standalone | Live |
| `/disclaimer` | BetaDisclaimer | Standalone | Live |
| `/404` | NotFound | Standalone | Live |

### Sidebar Navigation Groups

The AppLayout sidebar organizes navigation into these groups:
1. **Start Here** — Onboarding for new users
2. **Trading** — Swap, Dashboard, Portfolio, DCA, Limits
3. **DeFi** — Farm (PulseChain), Farm (BASE), Stake HERO → DAI, Approvals
4. **Ecosystem** — Tokenomics, NFT Collection, Media, Community Hub, Explainer
5. **AI** — AI Assistant
6. **External** — Squirrels Pro (external link)
7. **DAO** — Overview, Proposals, Delegates, Treasury

---

## 7. Data Layer

### tRPC Router Endpoints

The server exposes these tRPC procedures (defined in `server/routers.ts`):

**Price & Market Data**:
- `ticker.pls` — PulseChain token prices (HERO, VETS, PLS, ETH, EMIT, RHINO, TruFarm)
- `ticker.base` — BASE token prices (HERO, ETH, JESSE, AERO, BRETT)
- `market.overview` — Aggregated market data (prices, market caps, volumes, 24h changes)
- `market.farmPools` — Farm pool data with APY calculations
- `market.buyAndBurn` — Buy-and-burn statistics

**Blog/Media**:
- `blog.list` — List blog posts (with pagination, category filter)
- `blog.get` — Get single blog post
- `blog.create` — Create blog post (admin only)
- `blog.update` — Update blog post (admin only)
- `blog.delete` — Delete blog post (admin only)

**Media Hub**:
- `media.list` — List community media uploads
- `media.upload` — Upload media (authenticated)
- `media.delete` — Delete media (admin only)

**AI Assistant**:
- `ai.chat` — Send message to AI assistant (streaming response)

**DAO**:
- `dao.proposals.list` — List governance proposals
- `dao.proposals.get` — Get proposal details
- `dao.proposals.create` — Create proposal (authenticated)
- `dao.proposals.vote` — Cast vote (authenticated)
- `dao.treasury` — Treasury balance and transactions
- `dao.delegates` — Delegate listing and stats

### Database Schema (Drizzle ORM)

The database uses PostgreSQL with Drizzle ORM. Key tables:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User accounts (OAuth) | id, openId, name, avatar, role |
| `blog_posts` | Blog articles | id, title, content, category, author, publishedAt |
| `media` | Community uploads | id, url, caption, userId, type, createdAt |
| `proposals` | DAO proposals | id, title, description, status, votesFor, votesAgainst |
| `votes` | Proposal votes | id, proposalId, userId, vote, power |
| `delegates` | DAO delegates | id, userId, delegatedPower, bio |

### Price Feed Architecture

The `priceFeed.ts` module implements a caching layer for DexScreener API data:

1. **Client requests** → tRPC endpoint (`ticker.pls` or `ticker.base`)
2. **Server checks cache** → If fresh (< 30s), return cached data
3. **If stale** → Fetch from DexScreener API (`https://api.dexscreener.com/latest/dex/tokens/{address}`)
4. **Parse and cache** → Extract price, volume, liquidity, 24h change
5. **Return to client** → Formatted price data

Additionally, `Farm.tsx` makes **direct client-side** DexScreener calls for BASE farm pool data via the `useDexScreenerBase` hook (30-second refresh interval).

---

## 8. Blockchain Integration

### Supported Chains

| Chain | Chain ID | RPC | Explorer |
|-------|----------|-----|----------|
| PulseChain | 369 | https://rpc.pulsechain.com | https://scan.pulsechain.com |
| BASE | 8453 | https://mainnet.base.org | https://basescan.org |

### Wallet Configuration (wagmi)

The wagmi config in `client/src/lib/wagmi.ts` supports:
- **Injected wallets**: MetaMask, Rabby, Brave, Frame
- **WalletConnect v2**: Trust Wallet, Ledger, Rainbow, 300+ mobile wallets
- **Storage**: `null` (no auto-reconnect for security)
- **Transports**: HTTP-only (no WebSocket)

### Network Switching

The `NetworkContext` provides:
```typescript
interface NetworkState {
  chainId: SupportedChainId;        // 369 | 8453
  isPulseChain: boolean;
  isBase: boolean;
  setChainId: (id: SupportedChainId) => void;
}
```

Components use `useNetwork()` to conditionally render chain-specific content (different token lists, farm pools, contract addresses, DEX links).

---

## 9. Token Registry

All token metadata lives in `shared/tokens.ts`. This is the single source of truth for:

### PulseChain Tokens

| Symbol | Name | Address | Decimals |
|--------|------|---------|----------|
| HERO | Hero Token | 0x5765F2... | 18 |
| VETS | VetsInCrypto | 0x79E2f... | 18 |
| PLS | Pulse | 0x0000... (native) | 18 |
| WPLS | Wrapped PLS | 0xA1077a... | 18 |
| PLSX | PulseX | 0x9521... | 18 |
| HEX | HEX | 0x2b59... | 8 |
| DAI | Dai from ETH | 0xefD7... | 18 |
| USDC | USDC from ETH | 0x15D3... | 6 |
| USDT | USDT from ETH | 0x0Cb6... | 6 |
| INC | Incentive | 0x2fa8... | 18 |
| EMIT | Emit Token | 0xD3C8... | 18 |

### BASE Tokens

| Symbol | Name | Address | Decimals |
|--------|------|---------|----------|
| HERO | Hero Token (BASE) | 0x00Fa69... | 18 |
| WETH | Wrapped ETH | 0x420000... | 18 |
| USDC | USDC | 0x833589... | 6 |
| BRETT | Brett | 0x5321... | 18 |
| ZORA | Zora | 0x1234... | 18 |

### Farm Contracts

**PulseChain Farm**:
- MasterChef: `0x...` (defined in `FARM_CONTRACTS_PLS`)
- Pools: HERO/WPLS, HERO/DAI, VETS/WPLS, HERO/HEX, HERO/PLSX

**BASE Farm**:
- Aerodrome HERO/WETH pool: `0xb813599dd596C179C8888C8A4Bd3FEC8308D1E20`
- Uniswap V3 HERO/WETH: `0x3Bb159de8604ab7E0148EDC24F2A568c430476CF`

### CDN Assets (shared/tokens.ts → CDN_ASSETS)

All static images are hosted on CloudFront and referenced via the `CDN_ASSETS` object:
```typescript
export const CDN_ASSETS = {
  heroLogo: "https://d2xsxph8kpxj0f.cloudfront.net/.../hero-logo-official_808c9ab8.png",
  heroBanner: "https://d2xsxph8kpxj0f.cloudfront.net/.../HerobannerUN_342fe48e.jpg",
  blackbeard: "https://d2xsxph8kpxj0f.cloudfront.net/.../BlackBeard_94de3f9d.jfif",
  kycBadge: "https://d2xsxph8kpxj0f.cloudfront.net/.../KYC-certificate-badge_4bce12b5.png",
  auditBadge: "https://d2xsxph8kpxj0f.cloudfront.net/.../audited-by-spywolf_8a337ccc.png",
  heroSunset: "https://d2xsxph8kpxj0f.cloudfront.net/.../herouniversalgoodstonesunset_905fb0ba.webp",
  heroTruDefi: "https://d2xsxph8kpxj0f.cloudfront.net/.../HeroTruDefi_4b9604ff.jpg",
  vicInfoChart: "https://d2xsxph8kpxj0f.cloudfront.net/.../Vetsincryptoinfochartforvets,hero_c1479748.jpg",
  heroEmblem: "https://d2xsxph8kpxj0f.cloudfront.net/.../hero-emblem_...",
  // ... additional assets
};
```

---

## 10. Feature Modules

### 10.1 Swap (DEX Aggregator)

The swap page routes users to external DEXes with pre-filled parameters:
- **PulseChain**: Routes to PulseX (`app.pulsex.com/swap`)
- **BASE**: Routes to Aerodrome (`aerodrome.finance/swap`)

Features: Token selection, price display, slippage info, direct DEX links. Does NOT execute swaps on-chain directly — it's a routing interface.

### 10.2 Farm (Yield Farming)

Two separate farm pages:
- **Farm.tsx** (PulseChain): Shows farm pools from `FARM_POOLS_PLS`, live APY data, staking links
- **BaseFarm.tsx** (BASE): Aerodrome and Uniswap V3 pools with live DexScreener data

Both display: Pool pair, DEX, liquidity, volume, APY, and direct links to add liquidity.

### 10.3 HeroStake (HERO → DAI)

Single-sided staking: Stake HERO tokens, earn DAI stablecoin rewards. Features mock stats (totalStaked, APY, lockPeriod, earlyExitPenalty). Currently UI-only — smart contract integration pending.

### 10.4 Portfolio

Multi-wallet portfolio tracker:
- Connect wallet or enter any address
- View token holdings, LP positions, HEX stakes
- Transaction history
- Saved wallets (localStorage)
- Chain-specific views (PulseChain vs BASE)

### 10.5 Limit Orders & DCA

Both are UI-ready with mock data. Features:
- Create buy/sell limit orders with target price
- DCA engine: Set amount, interval (daily/weekly/monthly), total orders
- Chain-specific token lists
- Order management (pause, cancel, view history)

### 10.6 NFT Collection (555 Military Trading Cards)

Displays the planned 555-card NFT collection:
- 10 categories (US Marines, Army, Navy, Air Force, Coast Guard, Space Force, Historical, Special, Crypto, Community)
- 5 rarity tiers (Common, Uncommon, Rare, Ultra Rare, Legendary)
- Grail cards (special numbered cards like #001 Devil Dog, #549 Semper Fidelis)
- Dual-chain split: ~185 PulseChain, ~185 BASE, ~185 Shared
- Multi-language support via LanguageContext

### 10.7 DAO Governance

Full governance module with 6 sub-pages:
- **Dashboard**: Overview stats, active proposals, treasury summary
- **Proposals**: List with filtering (active, passed, rejected, pending)
- **Proposal Detail**: Vote casting (For/Against/Abstain), discussion
- **Create Proposal**: Form with title, description, category, duration
- **Treasury**: Multi-sig wallet balances, transaction history, allocation charts
- **Delegates**: Delegate listing, voting power, delegation

### 10.8 AI Assistant

Chat interface powered by server-side LLM:
- Streaming responses via tRPC mutation
- Markdown rendering via Streamdown
- Network-aware context (knows current chain)
- Conversation history

### 10.9 Blog / Media

Admin-managed blog with:
- Category filtering (News, Updates, Education, Community)
- Rich text content
- Admin CRUD (create, edit, delete) — requires authentication
- Twitter/X feed integration via `twitterFetcher.ts`

### 10.10 Community Media Hub

User-generated content:
- Image/video uploads (S3 storage)
- Community gallery
- Admin moderation tools
- Authentication required for uploads

### 10.11 Tokenomics

Visual explainer of the HERO token economic model:
- Flywheel diagram (step-by-step)
- Revenue streams (swap fees, farm fees, NFT royalties)
- Buy-and-burn mechanism with live stats
- Token distribution breakdown
- Links to external farms (Emit, TruFarms)

### 10.12 Explainer / Onboarding

New user onboarding with:
- Video explainer (YouTube embed)
- Ecosystem pillars overview
- Step-by-step guides
- KYC verification badge display

---

## 11. Security Model

| Layer | Implementation | Status |
|-------|---------------|--------|
| HTTPS/SSL | Cloudflare SSL termination | Active |
| DDoS Protection | Cloudflare WAF | Active |
| Rate Limiting | express-rate-limit (server) | Active |
| Security Headers | Helmet.js | Active |
| Input Validation | Zod schemas (ethAddress, safeString, tokenSymbol) | Active |
| XSS Prevention | React auto-escaping, no dangerouslySetInnerHTML | Clean |
| SQL Injection | Drizzle ORM parameterized queries | Clean |
| Session Management | JWT via jose library, httpOnly cookies | Active |
| Authentication | Manus OAuth (server/_core/sdk.ts) | Active |
| Wallet Security | wagmi `storage: null` (no auto-reconnect) | Active |
| Telegram Bot | HTML-escaped user content | Active |
| Secrets | Environment variables only, no hardcoded keys | Clean |

---

## 12. External Services & APIs

| Service | Purpose | Authentication |
|---------|---------|---------------|
| DexScreener API | Token prices, pair data | None (public API) |
| PulseChain RPC | Blockchain reads | None (public RPC) |
| BASE RPC | Blockchain reads | None (public RPC) |
| Telegram Bot API | Community notifications | Bot token (env var) |
| Twitter/X API | Feed integration | API key (env var) |
| Manus OAuth | User authentication | App ID + secret (env var) |
| Manus Forge API | AI assistant, image gen | API key (env var) |
| CloudFront CDN | Static assets | None (public) |
| WalletConnect v2 | Mobile wallet connections | Project ID (env var) |
| SpyWolf | KYC verification | Badge only (no API) |

---

## 13. Deployment & CI/CD

### Current Deployment Process

1. **Develop locally** or via VDS SSH
2. **Commit to `main` branch** on GitHub
3. **SSH to VPS1**: `ssh vds "ssh vps1 'cd /root/hero-dapp && git pull && npm run build && pm2 restart hero-dapp'"`
4. **Verify**: Check `https://herobase.io` via Cloudflare

### PM2 Configuration

```bash
pm2 start npm --name "hero-dapp" -- run start
pm2 save
pm2 startup
```

### Build Commands

```bash
npm run dev      # Development server (Vite + Express, port 5000)
npm run build    # Production build (Vite client + esbuild server)
npm run start    # Production server (serves built assets)
npm run check    # TypeScript type checking
npm run db:push  # Push Drizzle schema to database
```

### Nginx Configuration

Nginx on VPS1 reverse-proxies port 80/443 to the Node.js app on port 5000. Cloudflare handles SSL termination.

---

## 14. Known Issues & Technical Debt

### Resolved in Audit (April 16, 2026)

All 13 issues from the audit have been fixed and pushed (commit `18c54f5`). See `AUDIT_FINDINGS.md` for details.

### Remaining Technical Debt

| Issue | Priority | Description |
|-------|----------|-------------|
| No lazy loading | Low | All 20+ pages eagerly imported in App.tsx. Use React.lazy() for code splitting. |
| LanguageContext size | Medium | 1,060 lines with all 8 language dictionaries inline. Extract to separate i18n files. |
| ComponentShowcase.tsx | Low | 1,437-line dev-only component with no route. Remove or gate behind dev flag. |
| useDexScreenerBase in Farm.tsx | Low | Custom hook defined inside page file. Move to hooks/ directory. |
| Empty catch blocks | Low | 7 occurrences silently swallowing errors. Add console.warn. |
| Streamdown import | Low | Verify if streaming is actually used in AI chat; remove if not. |
| Bundle size | Medium | Main chunk is 2.1MB. Code splitting and tree shaking would help. |
| Limit/DCA orders | High | Currently mock data only. Need smart contract integration. |
| HeroStake | High | UI-only, needs smart contract deployment and integration. |
| NFT minting | High | Collection designed but minting not yet live. |

---

## 15. Development Conventions

### Code Style

- **TypeScript strict mode** enabled
- **Path aliases**: `@/` → `client/src/`, `@shared/` → `shared/`
- **Component naming**: PascalCase for components, camelCase for hooks
- **File naming**: PascalCase for components/pages, camelCase for hooks/utils
- **Imports**: Use `@/` and `@shared/` aliases, NOT relative `../../../` paths
- **State management**: React context + tRPC queries (no Redux/Zustand)
- **Styling**: Tailwind CSS utilities + CSS variables for theming
- **Toasts**: Use `sonner` (NOT react-toastify or radix toast)
- **Icons**: Lucide React exclusively
- **Charts**: Recharts for data visualization

### CSS Variables (index.css)

```css
:root {
  --hero-orange: oklch(0.75 0.18 55);
  --hero-green: oklch(0.77 0.2 150);
  --background: oklch(0.13 0.01 260);
  --foreground: oklch(0.95 0.01 260);
  --card: oklch(0.17 0.01 260);
  --border: oklch(0.25 0.01 260);
  /* ... additional theme variables */
}
```

### Git Workflow

- Single `main` branch (no feature branches currently)
- Commit messages: Descriptive with category prefix (e.g., "Audit: Fix 13 issues...")
- Push directly to `main` on GitHub
- No CI/CD pipeline (manual deployment via SSH)

---

## 16. Operational Playbook

### Restart the App

```bash
ssh vds "ssh vps1 'cd /root/hero-dapp && pm2 restart hero-dapp'"
```

### Deploy Updates

```bash
ssh vds "ssh vps1 'cd /root/hero-dapp && git pull origin main && npm run build && pm2 restart hero-dapp'"
```

### Check Logs

```bash
ssh vds "ssh vps1 'pm2 logs hero-dapp --lines 50'"
```

### Database Operations

```bash
# Push schema changes
ssh vds "ssh vps1 'cd /root/hero-dapp && npm run db:push'"

# Access PostgreSQL directly
ssh vds "ssh vps1 'psql -U postgres -d hero_dapp'"
```

### TypeScript Check

```bash
ssh vds "ssh vps1 'cd /root/hero-dapp && npx tsc --noEmit'"
```

### Build Check

```bash
ssh vds "ssh vps1 'cd /root/hero-dapp && npx vite build 2>&1 | tail -20'"
```

### Add a New Page

1. Create `client/src/pages/NewPage.tsx`
2. Import in `client/src/App.tsx`
3. Add `<Route path="/new-page" component={() => <AppLayout><NewPage /></AppLayout>} />`
4. Add nav item in `client/src/components/AppLayout.tsx` → `NAV_ITEMS` array
5. If chain-specific, use `useNetwork()` hook

### Add a New tRPC Endpoint

1. Define procedure in `server/routers.ts`
2. Use Zod schema for input validation
3. Client calls via `trpc.{router}.{procedure}.useQuery()` or `.useMutation()`
4. Types are automatically shared — no manual typing needed

---

## Appendix A: Complete File Inventory

Total: **155 files** across client, server, and shared directories.

### Client Pages (20 files, ~8,200 lines)

| File | Lines | Description |
|------|-------|-------------|
| Farm.tsx | 1,164 | PulseChain yield farming |
| Blog.tsx | 700 | News/blog with admin CRUD |
| Tokenomics.tsx | 623 | Token economics explainer |
| MediaHub.tsx | 611 | Community media uploads |
| NftCollection.tsx | 605 | 555 NFT military cards |
| Swap.tsx | 570 | DEX aggregator interface |
| Portfolio.tsx | 471 | Wallet portfolio tracker |
| Home.tsx | 453 | Landing page |
| BaseFarm.tsx | 404 | BASE chain farming |
| Explainer.tsx | 382 | Onboarding explainer |
| HeroStake.tsx | 357 | HERO → DAI staking |
| AiAssistant.tsx | ~300 | AI chat assistant |
| DcaOrders.tsx | ~280 | DCA order interface |
| LimitOrders.tsx | ~280 | Limit order interface |
| Approvals.tsx | ~250 | Token approval manager |
| Onboarding.tsx | ~318 | New user flow |
| dao/*.tsx (6 files) | ~1,500 | DAO governance module |

### Client Components (15+ files, ~3,000 lines)

| File | Lines | Description |
|------|-------|-------------|
| AppLayout.tsx | ~400 | Main app shell |
| WalletButton.tsx | 350 | Wallet modal |
| ExplainerVideoModal.tsx | 372 | Video modal |
| PriceTicker.tsx | ~150 | Price ticker bar |
| NetworkSwitcher.tsx | ~100 | Chain switcher |
| ConnectWalletPrompt.tsx | ~80 | Wallet CTA |
| ErrorBoundary.tsx | ~60 | Error boundary |
| ui/*.tsx (30+ files) | ~2,000 | shadcn/ui components |

### Server (7 files, ~1,500 lines)

| File | Lines | Description |
|------|-------|-------------|
| routers.ts | 927 | All tRPC endpoints |
| priceFeed.ts | ~200 | Price caching |
| telegramBot.ts | ~150 | Telegram integration |
| twitterFetcher.ts | ~100 | Twitter feed |
| db.ts | ~50 | Database connection |
| storage.ts | ~50 | File storage |
| index.ts | ~50 | Express entry |

---

## Appendix B: Contract Addresses

### PulseChain (Chain ID: 369)

| Token | Address |
|-------|---------|
| HERO | `0x5765F2...` (see shared/tokens.ts for full) |
| VETS | `0x79E2f...` |
| WPLS | `0xA1077a...` |
| HEX | `0x2b59...` |
| DAI (eDAI) | `0xefD7...` |
| USDC (eUSDC) | `0x15D3...` |

### BASE (Chain ID: 8453)

| Token | Address |
|-------|---------|
| HERO | `0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8` |
| WETH | `0x4200000000000000000000000000000000000006` |
| DAI | `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` |

### Farm Contracts

| Contract | Chain | Address |
|----------|-------|---------|
| Aerodrome HERO/WETH | BASE | `0xb813599dd596C179C8888C8A4Bd3FEC8308D1E20` |
| Uniswap V3 HERO/WETH | BASE | `0x3Bb159de8604ab7E0148EDC24F2A568c430476CF` |

(Full contract addresses are in `shared/tokens.ts` → `FARM_CONTRACTS_PLS`, `FARM_CONTRACTS_BASE`, `FARM_POOLS_PLS`, `FARM_POOLS_BASE`)

---

## Appendix C: CDN Asset Registry

All production images are hosted on CloudFront CDN. The canonical registry is `shared/tokens.ts` → `CDN_ASSETS`.

| Asset | Key | URL Pattern |
|-------|-----|-------------|
| HERO Logo | `heroLogo` | `d2xsxph8kpxj0f.cloudfront.net/.../hero-logo-official_*.png` |
| HERO Banner | `heroBanner` | `d2xsxph8kpxj0f.cloudfront.net/.../HerobannerUN_*.jpg` |
| Blackbeard Avatar | `blackbeard` | `d2xsxph8kpxj0f.cloudfront.net/.../BlackBeard_*.jfif` |
| KYC Badge | `kycBadge` | `d2xsxph8kpxj0f.cloudfront.net/.../KYC-certificate-badge_*.png` |
| Audit Badge | `auditBadge` | `d2xsxph8kpxj0f.cloudfront.net/.../audited-by-spywolf_*.png` |
| HERO Sunset | `heroSunset` | `d2xsxph8kpxj0f.cloudfront.net/.../herouniversalgoodstonesunset_*.webp` |
| HERO TruDefi | `heroTruDefi` | `d2xsxph8kpxj0f.cloudfront.net/.../HeroTruDefi_*.jpg` |
| VIC Info Chart | `vicInfoChart` | `d2xsxph8kpxj0f.cloudfront.net/.../Vetsincryptoinfochartforvets,hero_*.jpg` |

---

## Transfer Instructions for New LLM

To pick up development from this point:

1. **Read this document first** — it contains the complete system context
2. **Clone the repo**: `git clone https://github.com/jratdish1/hero-dapp.git`
3. **Read `shared/tokens.ts`** — this is the single source of truth for all token data
4. **Read `server/routers.ts`** — this defines all API endpoints
5. **Read `client/src/App.tsx`** — this defines all routes
6. **Read `client/src/components/AppLayout.tsx`** — this defines the navigation structure
7. **Access VPS1 via VDS**: `ssh vds "ssh vps1 '<command>'"`
8. **The GitHub PAT is stored on VDS** — VDS has push access to the repo
9. **Current state**: All TypeScript errors resolved, build passes clean, 25 routes active
10. **Next priorities**: Smart contract integration for Limit Orders, DCA, and HeroStake; NFT minting launch; code splitting for bundle size optimization

---

*This blueprint is maintained in the VDS Knowledge Base, GitHub repository, and VPS1. Any LLM receiving this document has sufficient context to continue development of the HeroBase.io platform.*
