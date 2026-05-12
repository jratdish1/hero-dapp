# HERO Ecosystem Architecture Blueprint v5
## Last Updated: May 12, 2026

---

## Overview
**HeroBase.io** is a multi-chain DeFi DApp serving PulseChain (369) and BASE (8453) networks. Built for Veterans, by Veterans. Supports $HERO and $VETS tokens with DEX aggregation, V2 Synthetix-style staking, DAO governance, community features, AI assistant, and NFT ecosystem.

---

## Infrastructure

| Component | Location | Details |
|-----------|----------|---------|
| Frontend + Server | VPS1 (62.146.175.67) | Express + Vite SSR, PM2 managed |
| Domain | herobase.io | Cloudflare DNS + CDN + WAF |
| Database | MySQL on VPS1 | Drizzle ORM, 8 migrations (0000–0007) |
| CDN Assets | d2xsxph8kpxj0f.cloudfront.net | Images, videos, static assets |
| Git Repo | GitHub (jratdish1/hero-dapp) | Public, auto-sync cron on VPS1 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS + MARPAT Woodland Camo theme |
| State | React Context (Network, Language, Theme, Wagmi) + Hooks |
| Backend | Express + tRPC 11 |
| Database | MySQL (Drizzle ORM) — 15 tables |
| Auth | Wallet-based (wagmi 3.6 + WalletConnect) + JWT sessions (jose) |
| Web3 | wagmi 3.6 + viem 2.47 + WalletConnect (env-gated) |
| Process Mgr | PM2 (id: 19, name: hero-dapp) |
| Testing | Vitest (9 test files) |
| Formatting | Prettier |
| Charts | Recharts + TradingView (lightweight-charts) |
| Routing | wouter 3.3 |
| Forms | react-hook-form + zod 4 |
| Code Splitting | React.lazy + Suspense (20+ lazy-loaded routes) |

---

## Routes (App.tsx) — Complete

| Route | Page Component | Lazy | Description |
|-------|---------------|------|-------------|
| / | Home | No | Landing page |
| /wallet | HeroWallet | Yes | Multi-tab wallet (Overview, Send, Privacy, Bridge, Approvals, Discover) |
| /swap | Swap | No | DEX aggregator with route comparison + price impact |
| /dashboard | Dashboard | Yes | Market overview + Treasury + Wallet balance integration |
| /portfolio | Portfolio | Yes | Token balances, P&L, transaction history (chain-aware) |
| /dca | DcaOrders | Yes | Dollar-cost averaging order management |
| /limits | LimitOrders | Yes | Limit order management |
| /approvals | ApprovalsEnhanced | Yes | Token approval manager with real wallet data |
| /bootcamp | Farm | Yes | PulseChain farm pools (aliased from /dapp-farm) |
| /stake | Stake | Yes | Farm pools (PulseChain) |
| /stake/base | BaseStake | No | Farm pools (BASE) |
| /stake/dai | HeroStake | No | V2 SSS single-sided HERO staking → DAI rewards |
| /bots | AbleBots | Yes | ABLE bot status display |
| /spin | SpinWheel | Yes | Daily spin (requires HERO NFT) |
| /nft | NftCollection | Yes | HERO NFT gallery |
| /nft-mint | NFTMint | No | NFT minting interface |
| /burn | BuyAndBurn | Yes | Buy-and-burn mechanism display |
| /giveaways | Giveaways | Yes | Community giveaways |
| /holder-rewards | HolderRewards | Yes | Holder reward distribution |
| /dao | DaoDashboard | No | DAO governance dashboard |
| /dao/proposals | Proposals | No | Governance proposals list |
| /dao/proposals/create | CreateProposal | No | Create new proposal |
| /dao/proposals/:id | ProposalDetail | No | Individual proposal detail + voting |
| /dao/treasury | Treasury | No | DAO treasury overview |
| /dao/delegates | Delegates | No | Delegate voting power |
| /dao-proposals | DAOProposals | No | Legacy DAO proposals page |
| /community | Blog | Yes | Blog posts + Twitter mentions |
| /community-hub | CommunityHub | Yes | Weekly Blog + Monster Threads + Video + Quick Vote |
| /media | MediaHub | Yes | Video content + explainer |
| /ai | AiAssistant | Yes | AI chat assistant |
| /tokenomics | Tokenomics | Yes | Token economics display |
| /ecosystem | Subdomains | No | Ecosystem subdomain directory |
| /directory | EcosystemDirectory | No | Ecosystem directory (DApp catalog) |
| /dex-analytics | DexAnalytics | Yes | DEX analytics + pool data |
| /explainer | Explainer | No | Platform explainer |
| /beta-disclaimer | BetaDisclaimer | No | Beta disclaimer page |
| /disclaimer | BetaDisclaimer | No | Alias for beta-disclaimer |
| /whitepaper | (external redirect) | — | Redirects to docs.vicfoundation.com |
| /start | Onboarding | No | Onboarding guide |
| /404 | NotFound | No | 404 page |

**Redirects**: /dapp-farm → /bootcamp, /ai-assistant → /ai, /able-bots → /bots, /liberty-swap → /swap, /buy-and-burn → /burn, /pools → /dex-analytics, /stake-base → /stake/base, /stake-dai → /stake/dai, /nfts → /nft, /farm → /bootcamp, /governance → /dao, /start-here → /start

---

## Key Components

| Component | Purpose |
|-----------|---------|
| AIChatBox.tsx | AI chat interface |
| AppLayout.tsx | Collapsible sidebar + main layout + ScrollToTop + CodexAuditBadge |
| BetaDisclaimer.tsx | Beta warning modal |
| ChainStatsWidget.tsx | On-chain statistics widget |
| CodexAuditBadge.tsx | GPT-4.1 Codex audit score badge (88.85 score) |
| CommaInput.tsx | Number input with comma formatting for readability |
| CommunityFeed.tsx | Unified activity stream |
| CommunityStats.tsx | Holder/voter/treasury stats |
| ConnectWalletPrompt.tsx | Wallet connection CTA |
| DashboardLayout.tsx | Dashboard-specific layout with sidebar + user menu |
| DashboardLayoutSkeleton.tsx | Loading skeleton for dashboard layout |
| DiscoverTab.tsx | 42+ DApp directory with search, favorites, categories |
| ErrorBoundary.tsx | React class-based error boundary with crash recovery UI |
| ExplainerVideoModal.tsx | Video explainer overlay |
| FloatingSocial.tsx | Floating social media links |
| IntroOverlay.tsx | First-visit intro video overlay |
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
| ScrollToTop.tsx | Scroll-to-top button (appears after 400px scroll) |
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
| rng/ | Random number generation utilities |
| sss-config.ts | SSS staking configuration (addresses, ABIs per chain) |
| staking-abi.ts | Staking contract ABI definitions |
| trpc.ts | tRPC client configuration |
| utils.ts | General utility functions |
| validation.ts | Input validation (isValidChainId, isValidAmount, sanitizeString, validateDecimalInput) |
| wagmi.ts | Wagmi configuration (chains, transports, connectors) |

---

## Smart Contracts

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
| dao | (dao procedures) | DAO governance |
| proposals | create, list, byId, update, updateVotes | Governance proposals |
| votes | cast, byProposal, userVote | On-chain voting with token verification |
| delegates | register, list, byAddress, update | Delegation management |
| delegations | create, byDelegator, byDelegate, revoke | Delegation tracking |
| treasury | save, latest | Treasury snapshots |
| ai | (AI procedures) | AI assistant backend |
| influencer | upsert, list, byTweetId, togglePin, toggleHighlight, toggleHidden, updateCategory, stats | Influencer mention tracking |
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
| proposals | DAO governance proposals (7 statuses, 4 categories) |
| votes | DAO votes (on-chain verified, 3 choices) |
| delegates | DAO delegates (with activity tracking) |
| delegations | Voting power delegations |
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
| server/spin-engine.ts | Daily spin wheel logic |
| server/rewards-engine.ts | Reward distribution engine |
| server/raffle-engine.ts | Raffle/giveaway engine |
| server/dao-rng-fallback.ts | DAO random number fallback |
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
| 19 | hero-dapp | online | Main DApp server (port 3001) |
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
- **ErrorBoundary** component for graceful crash recovery
- **retryWithBackoff** helper (1s/2s/4s exponential backoff) on all network calls
- **handleRpcError** with error differentiation (network/RPC/user rejection/unknown)
- **navigator.onLine** check before RPC calls
- **AbortController** cleanup on unmount for async operations
- 3x RPC fallback transports per chain with timeouts
- WalletConnect project ID moved to env var (VITE_WALLETCONNECT_PROJECT_ID)
- Tightened iframe sandbox (removed allow-popups)
- Address validation via isAddress() before transactions
- Token symbol sanitization and allowlist validation
- Input validation: ethAddressSchema, txHashSchema, safeStringSchema, tokenSymbolSchema
- HTML/script injection prevention (sanitizeString)
- CSV injection prevention on exports
- Division-by-zero guards
- localStorage try/catch wrappers
- Accessibility ARIA labels throughout (aria-hidden, aria-label, role attributes)
- Cache RPC clients via getOrCreateClient singleton pattern
- **Chain-aware reads** — all balance/contract calls gated by isValidChainId()
- **Portfolio state reset on error** — prevents stale data display on chain switch
- **Disconnect handling** — graceful wallet disconnect with state cleanup

---

## Performance Optimizations (May 11-12, 2026)

| Optimization | Description |
|--------------|-------------|
| React.lazy + Suspense | 20+ routes lazy-loaded with loading spinner fallback |
| Route memoization (P10) | withLayout wrapper prevents unnecessary remounts |
| LoadingFallback | Shared spinner component for Suspense boundaries |
| Chain-gated queries | useReadContracts only fires when wallet connected + correct chain |
| Token balance batching | Dashboard reads HERO + VETS balances in single multicall |

---

## Design System
- **Theme**: MARPAT Woodland Digital Camo (USMC)
- **Background**: CDN-hosted camo image with navy overlay (72% opacity)
- **Primary Color**: Coyote Brown / HERO Orange (#F97316)
- **Secondary Color**: HERO Green (#22C55E)
- **Dark**: Navy dark backgrounds
- **Accents**: Cream, Orange highlights
- **Font**: System + custom heading fonts
- **Branding**: "HERO DApp" (not DEX), enlarged HERO text in sidebar
- **Header**: HERO banner image from CDN
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
| Hero Banner | d2xsxph8kpxj0f.cloudfront.net/.../hero-banner-QpyKdvivL5TcgqnXxrRZh5.webp |
| Hero Emblem | d2xsxph8kpxj0f.cloudfront.net/.../hero-emblem-aHVuQc59ySp2SrqEGw29rZ.webp |
| Tokenomics Video | files.manuscdn.com/.../unfIxrIvyPBCHqez.mp4 |

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

## Recent Changes (May 11-12, 2026)

| Commit | Description |
|--------|-------------|
| 732c0fd | P6: Wire SlippageSelector into Bridge tab + pass slippage to API |
| 296d924 | P4 balance checks, P5 Portfolio sanitize, P6 SlippageSelector, P10 memoize routes |
| 7e07bca | Final wallet audit: remove isSupportedChain shadow, Portfolio state reset on error |
| 49a4f61 | Wallet audit fixes: chain-aware reads, disconnect handling, race conditions |
| c50680f | Dashboard: wallet balance integration + correct deploy path |
| 6f2633f | V2 SSS migration — Synthetix-style staking ABI, hook rewrite, WalletButton connect fix |
| 15d6075 | Revert to single-file HeroWallet — fix ReferenceError crash |
| f12e74f | Fix HeroWallet crash — ESM-compliant imports, retryWithBackoff, CSP |
| c44d8b1 | Refactor HeroWallet into subcomponents, retryWithBackoff across all network calls |
| 2ac2322 | GPT-4.1 Codex audit: ErrorBoundary, retryWithBackoff, handleRpcError, navigator.onLine, iframe sandbox, address validation, token sanitization, RPC fallbacks, AbortController, ARIA labels, env var WC project ID — audit score 75 → 88.85 |

---

## Route Health Check (May 12, 2026)

| Route | Status |
|-------|--------|
| / | HTTP 200 |
| /wallet | HTTP 200 |
| /swap | HTTP 200 |
| /portfolio | HTTP 200 |
| /stake | HTTP 200 |
| /community-hub | HTTP 200 |

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
