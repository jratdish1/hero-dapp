# HERO Ecosystem Architecture Blueprint v7
## Last Updated: May 27, 2026

---

## Overview
**HeroBase.io** is a multi-chain DeFi DApp serving PulseChain (369) and BASE (8453) networks. Built for Veterans, by Veterans. Supports $HERO and $VETS tokens with DEX aggregation, V2 Synthetix-style staking, DAO governance (on-chain anchored), community features, AI assistant, NFT ecosystem, spin wheel, raffles/giveaways, and holder rewards.

---

## Infrastructure

| Component | Location | Details |
|-----------|----------|---------|
| Frontend + Server | VPS1 (62.146.175.67) | Express + Vite SSR, PM2 managed |
| Domain | herobase.io | Cloudflare DNS + CDN + WAF + HTTP/3 + Early Hints |
| Database | MySQL on VPS1 | Drizzle ORM, 8 migrations (0000–0007) + DAO security hardening |
| CDN Assets | d2xsxph8kpxj0f.cloudfront.net | Images, videos, static assets |
| Git Repo | GitHub (jratdish1/hero-dapp) | Public, auto-sync cron on VPS1 |
| Static Serving | Nginx (direct) | Bypasses Express for /assets/, brotli_static + gzip_static |
| Smart Contract | HeroDAOAnchor.sol | On-chain proposal anchoring, timelocks, vote snapshots |
| CI/CD | GitHub Dependabot | Monthly grouped dependency updates |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19.2 + TypeScript + Vite |
| Styling | Tailwind CSS + MARPAT Woodland Camo theme |
| State | React Context (Network, Language, Theme, Wagmi) + Hooks |
| Backend | Express 4.21 + tRPC 11.6 |
| Database | MySQL (Drizzle ORM 0.44) — 15 tables + DAO security columns |
| Auth | Wallet-based (wagmi 3.6 + WalletConnect) + JWT sessions (jose 6.1) |
| Web3 | wagmi 3.6 + viem 2.47 + WalletConnect (env-gated) |
| Process Mgr | PM2 (id: 19, name: hero-dapp) |
| Testing | Vitest (9 test files) |
| Formatting | Prettier |
| Charts | Recharts 2.15 + TradingView (lightweight-charts) |
| Routing | wouter 3.3 |
| Forms | react-hook-form 7.64 + zod 4.1 |
| Code Splitting | React.lazy + Suspense (40+ lazy-loaded routes/components) |
| Compression | Brotli 11 + Gzip 9 pre-compression (precompress.mjs) |
| Font | Self-hosted Inter (inter-latin.woff2) |
| Validation | zod schemas (ethAddressSchema, txHashSchema, safeStringSchema, tokenSymbolSchema) |

---

## Routes (App.tsx) — Complete

| Route | Page Component | Lazy | Description |
|-------|---------------|------|-------------|
| / | Home | No | Landing page |
| /login | LoginPage | Yes | Login page |
| /wallet | HeroWallet | Yes | Multi-tab wallet (Overview, Send, Privacy, Bridge, Approvals, Discover) |
| /swap | Swap | Yes | DEX aggregator with route comparison + price impact |
| /portfolio | Portfolio | Yes | Token balances, P&L, transaction history (chain-aware) |
| /dca | DcaOrders | Yes | Dollar-cost averaging order management |
| /limits | LimitOrders | Yes | Limit order management |
| /approvals | ApprovalsEnhanced | Yes | Token approval manager with real wallet data |
| /bootcamp | Farm | Yes | PulseChain farm pools (aliased from /dapp-farm) |
| /stake | Stake | Yes | Farm pools (PulseChain) |
| /stake/base | BaseStake | Yes | Farm pools (BASE) |
| /stake/dai | HeroStake | Yes | V2 SSS single-sided HERO staking → DAI rewards |
| /bots | AbleBots | Yes | ABLE bot status display |
| /spin | SpinWheel | Yes | Daily spin (requires HERO NFT, streak bonuses) |
| /nft | NftCollection | Yes | HERO NFT gallery |
| /nft-mint | NFTMint | Yes | NFT minting interface |
| /burn | BuyAndBurn | Yes | Buy-and-burn mechanism display |
| /giveaways | Giveaways | Yes | Community giveaways |
| /holder-rewards | HolderRewards | Yes | Holder reward distribution |
| /dao | DaoDashboard | Yes | DAO governance dashboard |
| /dao/proposals | Proposals | Yes | Governance proposals list |
| /dao/proposals/create | CreateProposal | Yes | Create new proposal |
| /dao/proposals/:id | ProposalDetail | Yes | Individual proposal detail + voting |
| /dao/treasury | Treasury | Yes | DAO treasury overview |
| /dao/delegates | Delegates | Yes | Delegate voting power |
| /dao-proposals | DAOProposals | Yes | Legacy DAO proposals page |
| /community | Blog | Yes | Blog posts + Twitter mentions |
| /community-hub | CommunityHub | Yes | Weekly Blog + Monster Threads + Video + Quick Vote |
| /media | MediaHub | Yes | Video content + explainer |
| /ai | AiAssistant | Yes | AI chat assistant |
| /tokenomics | Tokenomics | Yes | Token economics display |
| /ecosystem | EcosystemDirectory | Yes | Ecosystem directory (DApp catalog) |
| /directory | Subdomains | Yes | Ecosystem subdomain directory |
| /dex-analytics | DexAnalytics | Yes | DEX analytics + pool data |
| /explainer | Explainer | Yes | Platform explainer |
| /beta-disclaimer | BetaDisclaimer | Yes | Beta disclaimer page |
| /start | Onboarding | Yes | Onboarding guide |
| /404 | NotFound | No | 404 page |

**Redirects**: /dapp-farm → /bootcamp, /ai-assistant → /ai, /able-bots → /bots, /liberty-swap → /swap, /buy-and-burn → /burn, /pools → /dex-analytics, /stake-base → /stake/base, /stake-dai → /stake/dai, /nfts → /nft, /farm → /bootcamp, /disclaimer → /beta-disclaimer, /whitepaper → docs.vicfoundation.com

---

## Key Components

| Component | Purpose |
|-----------|---------|
| AIChatBox.tsx | AI chat interface |
| AppLayout.tsx | Collapsible sidebar + main layout + ScrollToTop + CodexAuditBadge |
| BetaDisclaimer.tsx | Beta warning modal |
| ChainStatsWidget.tsx | On-chain statistics widget |
| CommaInput.tsx | Number input with comma formatting for readability |
| CommunityFeed.tsx | Unified activity stream |
| CommunityStats.tsx | Holder/voter/treasury stats |
| ConnectWalletPrompt.tsx | Wallet connection CTA |
| DashboardLayout.tsx | Dashboard-specific layout with sidebar + user menu |
| DashboardLayoutSkeleton.tsx | Loading skeleton for dashboard layout |
| DiscoverTab.tsx | 42+ DApp directory with search, favorites, categories |
| ErrorBoundary.tsx | React class-based error boundary with crash recovery UI |
| ExplainerVideoModal.tsx | Video explainer overlay (deferred download — plays on click only) |
| FloatingSocial.tsx | Floating social media links |
| IntroOverlay.tsx | First-visit intro video overlay (8s delayed load) |
| LPPositionMonitor.tsx | LP tracking + impermanent loss calculator |
| LanguageSelector.tsx | i18n language picker |
| LiveTicker.tsx | Live price ticker (PLS + BASE tokens) |
| ManusDialog.tsx | Manus integration dialog |
| Map.tsx | Geographic map component |
| NFTCarousel.tsx | NFT image carousel |
| NetworkSwitcher.tsx | Chain switching (PLS/BASE) |
| PortfolioPnL.tsx | P&L visualization with DexScreener |
| PriceImpactWarning.tsx | Color-coded swap impact indicator |
| PriceTicker.tsx | Token price ticker |
| QuickVote.tsx | Inline proposal voting |
| RewardsDashboard.tsx | Consolidated rewards view |
| RouteComparison.tsx | Best-rate routing across DEXes |
| ScrollToTop.tsx | Auto-scroll to top on route change |
| SlippageSelector.tsx | Preset + custom slippage selector (0.1%, 0.5%, 1%, 3%, custom) |
| SlippageSettings.tsx | Slippage/gas/MEV settings (swap page) |
| SquirrelSwapWidget.tsx | Squirrel swap integration |
| SwapHistory.tsx | Recent swaps with CSV export |
| ThemeToggle.tsx | Dark/light theme toggle |
| TradingViewChart.tsx | TradingView chart integration |
| TransactionCostCalc.tsx | Gas cost calculator |
| TransactionHistory.tsx | TX history with explorer links |
| TreasuryDisplay.tsx | Real-time treasury balances (PLS + BASE) |
| WalletButton.tsx | Multi-connector wallet dialog (MetaMask, Coinbase, WalletConnect, Safe) |

---

## Contexts

| Context | Purpose |
|---------|---------|
| NetworkContext | Chain switching (PLS/BASE), DEX sources, RPC URLs |
| LanguageContext | i18n with multi-language support |
| ThemeContext | Dark/light theme management (switchable) |
| WagmiContext | Web3 wallet connection (wagmi + WalletConnect) |

---

## Hooks

| Hook | Purpose |
|------|---------|
| useAuth.ts | Core authentication hook |
| useComposition.ts | Component composition utilities |
| useMobile.tsx | Mobile responsive detection |
| usePageSEO.ts | Dynamic SEO meta tags |
| usePersistFn.ts | Persistent function reference |
| usePrices.ts | DexScreener price feeds for HERO, VETS, PLS + useMarketOverview |
| useStaking.ts | V2 Synthetix-style SSS staking contract interactions |
| useTokenBalance.ts | ERC-20 token balance queries |

---

## Client Libraries (client/src/lib/)

| File | Purpose |
|------|---------|
| nft-trait-constants.ts | NFT trait definitions and rarity tables |
| rng/ | Random number generation utilities (7 modules) |
| rng/dao-rng-fallback.ts | DAO RNG fallback logic |
| rng/email-notify.ts | Email notification from RNG events |
| rng/nft-trait-engine.ts | NFT trait randomization |
| rng/raffle-engine.ts | Raffle/giveaway engine |
| rng/rewards-engine.ts | Reward calculation |
| rng/rng-engine.ts | Core RNG engine |
| rng/spin-engine.ts | Spin wheel logic |
| sss-config.ts | SSS staking configuration (addresses, ABIs per chain) |
| staking-abi.ts | Staking contract ABI definitions |
| trpc.ts | tRPC client configuration |
| utils.ts | General utility functions |
| validation.ts | Input validation (isValidChainId, isValidAmount, sanitizeString, validateDecimalInput) |
| wagmi.ts | Wagmi configuration (chains, transports, connectors) |

---

## Smart Contracts

### HeroDAOAnchor.sol (Solidity ^0.8.20)

On-chain anchor contract for hybrid DAO governance. Stores proposal hashes, vote snapshots, and execution timelocks. Implements:
- Proposal hash commitment (prevents tampering)
- 48-hour timelock on execution
- ReentrancyGuard on all state-changing functions
- Role-based access (owner + executor)
- Event emission for all critical state changes
- No unbounded loops
- Checks-Effects-Interactions pattern
- Zero-value input validation
- OpenZeppelin Ownable + ReentrancyGuard

### PulseChain (369)

| Contract | Address | Purpose |
|----------|---------|---------|
| HERO Token | 0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27 | ERC-20 (3% transfer tax) |
| VETS Token | 0x4013abBf94A745EfA7cc848989Ee83424A770060 | ERC-20 |
| SSS V2 Staking | 0xD5F173973eC653E6CD1A6B31d742501A1004297E | Synthetix-style staking → DAI |
| DAI Reward | 0xefD766cCb38EaF1dfd701853BFCe31359239F305 | DAI on PulseChain |
| Treasury | 0x94e52915b99ffdd298939f9e0b4a7af80e6789f7 | Community treasury |

### BASE (8453)

| Contract | Address | Purpose |
|----------|---------|---------|
| HERO Token | 0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8 | ERC-20 |
| SSS V2 Staking | 0xAD7991a61e5d5C242839445EAAFE244500EEC722 | Synthetix-style staking → DAI |
| DAI Reward | 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb | DAI on BASE |
| Treasury | 0x94e52915b99ffdd298939f9e0b4a7af80e6789f7 | Community treasury |

### V2 SSS Staking ABI (Synthetix-style)

| Function | Type | Description |
|----------|------|-------------|
| totalSupply() | view | Total staked tokens |
| balanceOf(account) | view | User's staked balance |
| earned(account) | view | Pending DAI rewards |
| rewardRate() | view | DAI per second distribution |
| rewardsDuration() | view | Reward period length |
| periodFinish() | view | Current period end timestamp |
| rewardPerToken() | view | Accumulated reward per token |
| lastTimeRewardApplicable() | view | Last applicable reward time |
| stakingToken() | view | HERO token address |
| rewardsToken() | view | DAI token address |
| paused() | view | Contract pause state |
| stake(amount) | write | Stake HERO tokens |
| withdraw(amount) | write | Withdraw staked HERO |
| getReward() | write | Claim DAI rewards |
| exit() | write | Withdraw all + claim rewards |

**Key V2 Changes (May 11, 2026)**:
- Migrated from custom lock-period staking to Synthetix StakingRewards pattern
- No lock period for withdrawals (isUnlocked always true)
- No early exit penalty (penaltyBps = 0)
- APY computed dynamically from rewardRate / totalSupply
- Reward pool balance computed from rewardRate * (periodFinish - now)
- Compatibility aliases exported: `useUserStake`, `HERO_STAKING_ADDRESS`, `formatHero`, `formatDai`, `formatAPY`, `formatLockPeriod`, `useCountdown`

---

## DEX Sources

### PulseChain

| DEX | Router |
|-----|--------|
| PulseX V1 | 0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02 |
| PulseX V2 | 0x165C3410fC91EF562C50559f7d2289fEbed552d9 |
| 9inch | (aggregator) |
| Liberty Swap | (aggregator) |

### BASE

| DEX | Router |
|-----|--------|
| Uniswap V3 | 0x2626664c2603336E57B271c5C0b26F421741e481 |
| Aerodrome | 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43 |
| BaseSwap | 0x327Df1E6de05895d2ab08513aaDD9313Fe505d86 |

---

## BASE Farm Pools (Aerodrome)

| Pool | LP Token | Active |
|------|----------|--------|
| HERO/WETH | 0x7Cc5... | Yes |
| HERO/USDC | 0x3Bd1... | Yes |
| HERO/DAI | 0xAe2B... | Yes |
| HERO/DEGEN | 0x9F5c... | Yes |
| ZORA/HERO | 0x4052... | Yes |
| jesse/HERO | 0xbAd8... | Yes |

---

## Server API (tRPC Routers)

| Router | Procedures | Description |
|--------|-----------|-------------|
| auth | me, logout | Wallet-based auth + JWT sessions |
| dca | list, create, updateStatus | Dollar-cost averaging orders |
| limitOrder | list, create, cancel | Limit order management |
| swap | history, record | Swap history tracking |
| watchlist | list, add, remove | Token watchlist |
| blog | published, bySlug, create, all, update | Blog/content management |
| mvs | save, list, byId | Monster Video Series |
| media | create, byCategory, all, byUser, delete | Media posts + NFT gallery |
| prices | (price procedures) | DexScreener price feeds |
| dao.proposals | create, list, byId, update, updateVotes | Governance proposals (anchored on-chain) |
| dao.votes | cast, byProposal, userVote | On-chain voting with token verification |
| dao.delegates | register, list, byAddress, update | Delegation management |
| dao.delegations | create, byDelegator, byDelegate, revoke | Delegation tracking |
| dao.treasury | save, latest | Treasury snapshots |
| ai | (AI procedures) | AI assistant backend |
| influencer | upsert, list, byTweetId, togglePin, toggleHighlight, toggleHidden, updateCategory, addManual, stats | Influencer mention tracking |
| spin | canSpin, execute, history | Daily spin wheel (streak bonuses, chain-aware) |
| raffle | list, enter, draw | Raffle/giveaway system |
| system | (system router) | Health checks + system info |

---

## Database Tables (MySQL via Drizzle)

| Table | Purpose |
|-------|---------|
| users | Wallet-based user accounts (roles: user, admin) |
| dca_orders | DCA order configurations |
| limit_orders | Limit order configurations |
| swap_history | Swap transaction records (with gasless flag) |
| watchlist | User token watchlists |
| blog_posts | Blog/content posts (with hero/vets mention flags) |
| mvs_content | Monster Video Series content |
| media_posts | Media posts (images, videos, NFTs) — 6 categories |
| proposals | DAO governance proposals (7 statuses, 4 categories) + contentHash, timelockExpiresAt, anchoredOnChain, anchorTxHash |
| votes | DAO votes (on-chain verified, 3 choices) + receiptHash, verifiedOnChain, unique(proposalId, voterId) |
| delegates | DAO delegates (with activity tracking) |
| delegations | Voting power delegations + effectiveAfter, cooldownExpired |
| treasury_snapshots | Treasury balance history |
| chain_data_cache | On-chain data cache |
| influencer_mentions | Twitter/social influencer mentions (with sentiment, categories) |

---

## Server Engines & Services

| File | Purpose |
|------|---------|
| server/priceFeed.ts | DexScreener price feed integration |
| server/telegramBot.ts | Telegram bot notifications |
| server/twitterFetcher.ts | Twitter/X mention fetching |
| server/mentionScheduler.ts | Scheduled mention scanning |
| server/email-notify.ts | Email notification service |
| server/spin-engine.ts | Daily spin wheel logic (streak bonuses, chain-aware prizes) |
| server/rewards-engine.ts | Reward distribution engine |
| server/raffle-engine.ts | Raffle/giveaway engine (weighted entries by HERO balance) |
| server/dao-rng-fallback.ts | DAO random number fallback |
| server/dao-router-hardened.ts | Hardened DAO router with security middleware |
| server/dao-router-production.ts | Production DAO router |
| server/dao-security-hardening.ts | DAO security hardening (rate limiter, anchor integration) |
| server/dao-rate-limiter.ts | Fail-closed rate limiter for DAO operations |
| server/dao-anchor-integration.ts | On-chain anchor contract integration |
| server/dao-executor-config.ts | DAO executor configuration |
| server/standalone-auth.ts | Standalone auth handler |
| server/storage.ts | S3 file storage management |
| server/vrf-provider.ts | Verifiable random function provider |
| server/lib/artist-pipeline.ts | NFT art generation pipeline |
| server/lib/nft-trait-engine.ts | NFT trait randomization |
| server/lib/rng-engine.ts | Random number generation |
| server/lib/rewards-engine.ts | Reward calculation engine |
| server/lib/email-notify.ts | Email notification (lib) |
| server/lib/vrf-provider.ts | VRF provider (lib) |
| server/_core/llm.ts | LLM integration (AI assistant) |
| server/_core/imageGeneration.ts | Image generation service |
| server/_core/voiceTranscription.ts | Voice transcription service |
| server/_core/notification.ts | Push notification service |
| server/_core/security.ts | Security middleware |
| server/_core/sdk.ts | Core SDK utilities |
| server/_core/dataApi.ts | Data API layer |
| server/_core/oauth.ts | OAuth integration |
| server/_core/map.ts | Map service |

---

## Test Suite (Vitest)

| Test File | Coverage |
|-----------|----------|
| server/hero-dapp.test.ts | Main app integration tests |
| server/security.test.ts | Security middleware tests |
| server/dao.test.ts | DAO governance tests |
| server/priceFeed.test.ts | Price feed tests |
| server/influencer.test.ts | Influencer mention tests |
| server/auth.logout.test.ts | Auth logout flow tests |
| server/scheduler-telegram.test.ts | Telegram scheduler tests |
| server/seo.test.ts | SEO meta tag tests |
| server/walletconnect.test.ts | WalletConnect integration tests |

---

## PM2 Processes on VPS1

| ID | Name | Status | Purpose |
|----|------|--------|---------|
| 19 | hero-dapp | online | Main DApp server (port 3000, Nginx proxy) |
| 22 | hero-terminal | online | PulseChain trading terminal |
| 23 | hero-terminal-base | online | BASE trading terminal |
| 20 | Hero-ABLE | online | PulseChain ABLE bot |
| 21 | Hero-ABLE-Base | online | BASE ABLE bot |
| 4 | hero-vets-pulse | online | VETS volume bot |
| 5 | base-hero-vol | online | BASE HERO volume bot |

---

## HeroWallet Tabs (May 12 update)

| Tab | Features |
|-----|----------|
| Overview | Token balances, native balance, recent transactions |
| Send | Token transfer with address validation + CommaInput |
| Privacy | Privacy-focused transaction features |
| Bridge | Cross-chain bridge (PulseChain ↔ BASE) with SlippageSelector |
| Approvals | Token approval management |
| Discover | 42+ DApp directory with search, favorites, categories |

---

## Security Measures

### Core Security
- Wallet-based auth (no passwords stored)
- JWT sessions with expiry (jose library)
- CORS restricted to herobase.io
- Cloudflare WAF + DDoS protection
- Rate limiting on API endpoints (express-rate-limit)
- Helmet.js security headers
- On-chain token verification for DAO voting (verifyVotingPower)
- URL validation on all external links
- BigInt guards on RPC responses
- Mounted ref cleanup on async operations

### DAO Security Hardening (May 2026)
- **Fail-closed rate limiter** — blocks requests when rate limit state is uncertain
- **Anchor failure alerting** — notifications when on-chain anchoring fails
- **48-hour timelock** on proposal execution
- **Proposal hash commitment** — prevents post-vote tampering
- **Vote receipt hashing** — audit trail for all votes
- **Unique constraint** on (proposalId, voterId) — prevents double voting at DB level
- **Delegation cooldown** — prevents rapid delegation gaming
- **ReentrancyGuard** on all state-changing contract functions
- **Exponential backoff** on Cloudflare cache purge retries

### Input Validation & Sanitization
- ethAddressSchema, txHashSchema, safeStringSchema, tokenSymbolSchema (zod)
- HTML/script injection prevention (sanitizeString)
- CSV injection prevention on exports
- Division-by-zero guards
- localStorage try/catch wrappers
- Path traversal prevention
- SSRF protection
- Token symbol sanitization and allowlist validation

### Frontend Security
- **ErrorBoundary** component for graceful crash recovery
- **retryWithBackoff** helper (1s/2s/4s exponential backoff) on all network calls
- **handleRpcError** with error differentiation (network/RPC/user rejection/unknown)
- **navigator.onLine** check before RPC calls
- **AbortController** cleanup on unmount for async operations
- 3x RPC fallback transports per chain with timeouts
- WalletConnect project ID moved to env var (VITE_WALLETCONNECT_PROJECT_ID)
- Tightened iframe sandbox (removed allow-popups)
- Address validation via isAddress() before transactions
- Accessibility ARIA labels throughout (aria-hidden, aria-label, role attributes)
- Cache RPC clients via getOrCreateClient singleton pattern
- **Chain-aware reads** — all balance/contract calls gated by isValidChainId()
- **Portfolio state reset on error** — prevents stale data display on chain switch
- **Disconnect handling** — graceful wallet disconnect with state cleanup

---

## Performance Optimizations (May 11-13, 2026)

### Lighthouse Scores (May 13, 2026)

| Metric | Score | Value |
|--------|-------|-------|
| Performance | 90% avg (100% peak) | — |
| First Contentful Paint | 97 | 1.4s |
| Largest Contentful Paint | 97 | 2.0s |
| Total Blocking Time | 73 | 350ms |
| Cumulative Layout Shift | 100 | 0.000 |
| Speed Index | 91 | 3.3s |
| Server Response Time | 100 | 240ms |
| Accessibility | 91% | — |
| Best Practices | 92% | — |
| SEO | 100% | — |

### Code Splitting & Bundling

| Optimization | Description |
|--------------|-------------|
| React.lazy + Suspense | 40+ routes/components lazy-loaded with loading spinner fallback |
| Manual chunks | wagmi/viem (web3), recharts (charts), radix-ui, tanstack separated |
| strip-modulepreload.mjs | Removes non-critical modulepreload hints (web3, radix, data-layer) |
| React vendor chunk | Separated for better long-term caching |
| Route memoization (P10) | withLayout wrapper prevents unnecessary remounts |
| LoadingFallback | Shared spinner component for Suspense boundaries |

### Compression (precompress.mjs)

| Optimization | Description |
|--------------|-------------|
| Brotli level 11 | Pre-compression for all JS/CSS assets (nginx brotli_static) |
| Gzip level 9 | Fallback pre-compression (nginx gzip_static) |
| Entry chunk | 182KB → 47KB brotli (74% reduction) |
| Web3 chunk | 307KB → 75KB brotli (76% reduction) |

### Image Optimization

| Optimization | Description |
|--------------|-------------|
| Hero banner responsive | srcset (26KB mobile / 99KB desktop WebP) |
| regenvalor_og.png | 911KB PNG → 36KB WebP (96% reduction) |
| regenvalor_hero_bg | 90KB → 30KB WebP (67% reduction, 10% opacity bg) |
| Favicon | 205KB CDN JPG → 9KB local WebP |
| Dead preload removed | 151KB CloudFront wasted per page load eliminated |
| CDN poster replaced | 1.2MB → local optimized WebP |
| CDN logo replaced | 632KB → local optimized WebP |
| CDN video replaced | 16MB → 141KB local 360p version |

### App Shell & Rendering

| Optimization | Description |
|--------------|-------------|
| Inline HTML skeleton | `<div id="root">` contains skeleton for instant FCP before JS loads |
| Critical inline CSS | Dark background prevents white flash |
| Hero banner preload | Responsive `imagesrcset` with fetchpriority="high" |
| `<main>` landmark | Accessibility landmark for screen readers |
| Self-hosted Inter font | Eliminates render-blocking Google Fonts request |

### Server & CDN

| Optimization | Description |
|--------------|-------------|
| Nginx static bypass | Serves /assets/ directly (bypasses Express) |
| Nginx port fix | Corrected from 3001 to 3000 |
| Cache headers | Assets: immutable 1yr; HTML: no-cache |
| Nginx brotli_static | Serves pre-compressed .br files |
| Nginx gzip_static | Serves pre-compressed .gz files |
| Cloudflare Edge Cache | HTML cached at edge for 5 min (Cache Rule API) |
| Cloudflare Page Rules | MP4 and /assets/* cached at edge for 30 days |
| HTTP/3 + Early Hints | Enabled on Cloudflare |
| Helmet noCache disabled | Allows proper static asset caching |

### Media Deferral

| Optimization | Description |
|--------------|-------------|
| Explainer video (11MB) | Only downloads when user clicks play |
| Background video | Loads after 8s delay |
| Lazy-load below-fold images | loading="lazy" attribute |
| Conditional video/poster | ExplainerModal only loads media when opened |

### Accessibility (May 13, 2026)

| Optimization | Description |
|--------------|-------------|
| Viewport zoom | Removed maximum-scale=1 (allows pinch-to-zoom) |
| Main landmark | Added `<main role="main">` to app shell |

---

## Deployment Pipeline (v2.0 — Atomic Deploy)

```
1. Edit source on VPS1: /root/hero-dapp/
2. Build: npm run build (vite build + esbuild server bundle)
3. Deploy: bash deploy-production.sh (atomic symlink rotation for zero-downtime)
   - Creates timestamped release in /var/www/hero-dapp/releases/
   - Atomic symlink swap for /var/www/hero-dapp/public/assets
   - Keeps last 5 releases for instant rollback
   - Health check with 5 retries (3s delay)
   - Lockfile prevents concurrent deploys
4. Post-build: node precompress.mjs (brotli + gzip static assets)
5. Post-build: node strip-modulepreload.mjs (remove non-critical preloads, inject critical CSS)
6. Verify: curl -s http://localhost:3000
7. Commit: git add -A && git commit -m "..." && git push
8. Purge CDN: Cloudflare API purge cache (with exponential backoff retries)
9. Auto-add dao.vicfoundation.com to nginx server_name during deploy
```

**Deploy Script Features**:
- Atomic symlink rotation (zero-downtime)
- Lockfile prevents concurrent deploys
- Health check with retries before going live
- Automatic rollback on failure
- Keeps last 5 releases for instant rollback
- Cloudflare zone: 1f894ca8151cd3419688c8a87ce9f5e3

---

## Design System
- **Theme**: MARPAT Woodland Digital Camo (USMC)
- **Background**: CDN-hosted camo image with navy overlay (72% opacity)
- **Primary Color**: Coyote Brown / HERO Orange (#F97316)
- **Secondary Color**: HERO Green (#22C55E)
- **Dark**: Navy dark backgrounds
- **Accents**: Cream, Orange highlights
- **Font**: Self-hosted Inter (latin subset, woff2)
- **Branding**: "HERO DApp" (not DEX), enlarged HERO text in sidebar
- **Header**: HERO banner image (responsive WebP, local)
- **KYC Badge**: SpyWolf verified (displayed on homepage + sidebar)
- **Audit Badge**: SpyWolf audit badge displayed
- **Codex Audit Badge**: GPT-4.1 Codex audit score (88.85) in sidebar
- **NFT Aesthetic**: Steampunk-military theme
- **Service Branches**: Army, Navy, Marines, Air Force, Coast Guard, Space Force, Firefighters, Police, EMTs

---

## CDN Assets

| Asset | URL |
|-------|-----|
| Hero Logo | d2xsxph8kpxj0f.cloudfront.net/.../hero-logo-official_808c9ab8.png |
| KYC Badge | d2xsxph8kpxj0f.cloudfront.net/.../KYC-certificate-badge_4bce12b5.png |
| Audit Badge | d2xsxph8kpxj0f.cloudfront.net/.../audited-by-spywolf_8a337ccc.png |
| Hero Banner | Local: /hero-banner-sm.webp (mobile), /hero-banner-un.webp (desktop) |
| Hero Emblem | d2xsxph8kpxj0f.cloudfront.net/.../hero-emblem-aHVuQc59ySp2SrqEGw29rZ.webp |
| Tokenomics Video | Local: /tokenomics_video.mp4 |
| Explainer Video | Local: /hero-explainer-edited.mp4 |
| Favicon | Local: /hero-logo-200.webp |

---

## Recent Changes (May 21-26, 2026) — Since Blueprint v6

| Commit | Date | Description |
|--------|------|-------------|
| d18182e | May 26 | security: GPT-4.1 audit fixes — fail-closed rate limiter, anchor failure alerting |
| 4819cb2 | May 26 | fix: auto-add dao.vicfoundation.com to nginx server_name during deploy |
| 1a6c9e7 | May 26 | feat: add exponential backoff retries to Cloudflare cache purge |
| 227d36c | May 25 | feat: wire spin/raffle/DCA/DAO/giveaway endpoints, fix deploy script, remove all mock data |
| 6f17c16 | May 25 | fix(deploy): sync build assets to nginx-served public/assets directory |
| 98bdcb7 | May 25 | fix: Add missing useAccount import to SpinWheel.tsx (browser test bug fix) |
| 4f83553 | May 25 | AUDIT A+ PUSH: Fix final 2 MEDIUM findings |
| e2b1fe1 | May 25 | FULL ECOSYSTEM AUDIT: Fix all HIGH/MEDIUM/LOW findings |
| b4864b8 | May 24 | security: GPT-4.1 Codex audit fixes — path traversal, SSRF, JWT hardening, rate limiting, input validation |
| 1f9cd00 | May 21 | fix: remove Dashboard tab, fix ticker width, add ScrollToTop, update logo |

---

## Route Health Check (May 27, 2026)

| Route | Status |
|-------|--------|
| / | HTTP 200 |
| /wallet | HTTP 200 |
| /swap | HTTP 200 |
| /portfolio | HTTP 200 |
| /stake | HTTP 200 |
| /community-hub | HTTP 200 |

---

## Security Audit History

| Date | Auditor | Report |
|------|---------|--------|
| May 24, 2026 | GPT-4.1 Codex | Path traversal, SSRF, JWT hardening, rate limiting, input validation |
| May 25, 2026 | Full Ecosystem | All HIGH/MEDIUM/LOW findings fixed |
| May 25, 2026 | Final A+ Push | Final 2 MEDIUM findings resolved |
| May 26, 2026 | GPT-4.1 Codex | Fail-closed rate limiter, anchor failure alerting |

---

## Daily Auto-Update Checklist
1. Check for new git commits on VPS1 / GitHub
2. Verify all routes respond 200
3. Check PM2 process health
4. Regenerate blueprint if changes detected
5. Verify treasury balances haven't changed unexpectedly
6. Check Cloudflare for any security alerts
7. Verify ABLE bots have sufficient gas
8. Check Telegram bot responsiveness
