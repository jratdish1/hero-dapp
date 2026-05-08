# HERO Ecosystem Architecture Blueprint v3
## Last Updated: May 8, 2026

---

## Overview
**HeroBase.io** is a multi-chain DeFi DApp serving PulseChain (369) and BASE (8453) networks. Built for Veterans, by Veterans. Supports $HERO and $VETS tokens with DEX aggregation, staking, DAO governance, community features, AI assistant, and NFT ecosystem.

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
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + MARPAT Woodland Camo theme |
| State | React Context (Network, Language, Theme, Wagmi) + Hooks |
| Backend | Express + tRPC |
| Database | MySQL (Drizzle ORM) — 15 tables |
| Auth | Wallet-based (wagmi + WalletConnect) + JWT sessions |
| Web3 | wagmi + viem + WalletConnect |
| Process Mgr | PM2 (id: 11, name: hero-dapp) |
| Testing | Vitest |
| Formatting | Prettier |

---

## Routes (App.tsx) — Complete

| Route | Page Component | Description |
|-------|---------------|-------------|
| / | Home | Landing page |
| /login | LoginPage | Wallet login |
| /start | Onboarding | Onboarding guide |
| /wallet | HeroWallet | Multi-tab wallet (Send, Receive, History, Discover DApps) |
| /swap | Swap | DEX aggregator with route comparison + price impact |
| /dashboard | Dashboard | Market overview + Treasury display |
| /portfolio | Portfolio | Token balances, P&L, transaction history |
| /dca | DcaOrders | Dollar-cost averaging order management |
| /limits | LimitOrders | Limit order management |
| /approvals | Approvals | Token approval management |
| /bootcamp | Farm | PulseChain farm pools (aliased from /dapp-farm) |
| /stake | Stake | Farm pools (PulseChain) |
| /stake/base | BaseStake | Farm pools (BASE) |
| /stake/dai | HeroStake | Single-sided HERO staking → DAI rewards |
| /bots | AbleBots | ABLE bot status display (aliased from /able-bots) |
| /spin | SpinWheel | Daily spin (requires HERO NFT) |
| /nft | NftCollection | HERO NFT gallery |
| /nft-mint | NFTMint | NFT minting interface |
| /burn | BuyAndBurn | Buy-and-burn mechanism display (aliased from /buy-and-burn) |
| /giveaways | Giveaways | Community giveaways |
| /holder-rewards | HolderRewards | Holder reward distribution |
| /dao | DaoDashboard | DAO governance dashboard |
| /dao/proposals | Proposals | Governance proposals list |
| /dao/proposals/create | CreateProposal | Create new proposal |
| /dao/proposals/:id | ProposalDetail | Individual proposal detail + voting |
| /dao/treasury | Treasury | DAO treasury overview |
| /dao/delegates | Delegates | Delegate voting power |
| /dao-proposals | DAOProposals | Legacy DAO proposals page |
| /community | Blog | Blog posts + Twitter mentions |
| /community-hub | CommunityHub | Weekly Blog + Monster Threads + Video + Quick Vote |
| /media | MediaHub | Video content + explainer |
| /ai | AiAssistant | AI chat assistant (aliased from /ai-assistant) |
| /tokenomics | Tokenomics | Token economics display |
| /ecosystem | EcosystemDirectory | Ecosystem directory |
| /directory | EcosystemDirectory | Alternate ecosystem directory route |
| /dex-analytics | DexAnalytics | DEX analytics + pool data (aliased from /pools) |
| /explainer | Explainer | Platform explainer |
| /beta-disclaimer | BetaDisclaimer | Beta disclaimer page |
| /whitepaper | (external redirect) | Redirects to docs.vicfoundation.com |
| /404 | NotFound | 404 page |

**Redirects**: /dapp-farm → /bootcamp, /ai-assistant → /ai, /able-bots → /bots, /liberty-swap → /swap, /buy-and-burn → /burn, /pools → /dex-analytics

---

## Key Components (Non-UI)

| Component | Purpose |
|-----------|---------|
| AIChatBox.tsx | AI chat interface |
| AppLayout.tsx | Collapsible sidebar + main layout |
| BetaDisclaimer.tsx | Beta warning modal |
| ChainStatsWidget.tsx | On-chain statistics widget |
| CommunityFeed.tsx | Unified activity stream |
| CommunityStats.tsx | Holder/voter/treasury stats |
| ConnectWalletPrompt.tsx | Wallet connection CTA |
| DiscoverTab.tsx | 42+ DApp directory with search, favorites, categories |
| ErrorBoundary.tsx | React error boundary |
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
| SlippageSettings.tsx | Slippage/gas/MEV settings |
| SquirrelSwapWidget.tsx | Squirrel swap integration |
| SwapHistory.tsx | Recent swaps with CSV export |
| TradingViewChart.tsx | TradingView chart integration |
| TransactionCostCalc.tsx | Gas cost calculator |
| TransactionHistory.tsx | TX history with explorer links |
| TreasuryDisplay.tsx | Real-time treasury balances (PLS + BASE) |
| WalletButton.tsx | Wallet connect/disconnect button |

---

## Contexts

| Context | Purpose |
|---------|---------|
| NetworkContext | Chain switching (PLS/BASE), DEX sources, RPC URLs |
| LanguageContext | i18n with multi-language support |
| ThemeContext | Dark/light theme management |
| WagmiContext | Web3 wallet connection (wagmi + WalletConnect) |

---

## Hooks

| Hook | Purpose |
|------|---------|
| useComposition.ts | Component composition utilities |
| useMobile.tsx | Mobile responsive detection |
| usePageSEO.ts | Dynamic SEO meta tags |
| usePersistFn.ts | Persistent function reference |
| usePrices.ts | DexScreener price feeds for HERO, VETS, PLS |
| useStaking.ts | SSS staking contract interactions |
| useTokenBalance.ts | ERC-20 token balance queries |

---

## Smart Contracts

### PulseChain (369)

| Contract | Address | Purpose |
|----------|---------|---------|
| HERO Token | 0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27 | ERC-20 (3% transfer tax) |
| VETS Token | 0x4013abBf94A745EfA7cc848989Ee83424A770060 | ERC-20 |
| SSS Staking | 0xD5F173973eC653E6CD1A6B31d742501A1004297E | Single-sided staking → DAI |
| DAI Reward | 0xefD766cCb38EaF1dfd701853BFCe31359239F305 | DAI on PulseChain |
| Treasury | 0x94e52915b99ffdd298939f9e0b4a7af80e6789f7 | Community treasury |

### BASE (8453)

| Contract | Address | Purpose |
|----------|---------|---------|
| HERO Token | 0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8 | ERC-20 |
| SSS Staking | 0xAD7991a61e5d5C242839445EAAFE244500EEC722 | Single-sided staking → DAI |
| DAI Reward | 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb | DAI on BASE |
| Treasury | 0x94e52915b99ffdd298939f9e0b4a7af80e6789f7 | Community treasury |

---

## Server API (tRPC Routers)

| Router | Procedures | Description |
|--------|-----------|-------------|
| auth | me, logout | Wallet-based auth + JWT sessions |
| dca | list, create, updateStatus | Dollar-cost averaging orders |
| limitOrder | list, create, cancel | Limit order management |
| swap | history, record | Swap history tracking |
| watchlist | list, add, remove | Token watchlist |
| blog | published, bySlug, create | Blog/content management |
| mvs | (content procedures) | Monster Video Series content |
| media | (media procedures) | Media posts + NFT gallery |
| prices | (price procedures) | DexScreener price feeds |
| dao | (dao procedures) | DAO governance |
| proposals | (proposal procedures) | Governance proposals |
| votes | (voting procedures) | On-chain voting with token verification |
| delegates | (delegate procedures) | Delegation management |
| delegations | (delegation procedures) | Delegation tracking |
| treasury | (treasury procedures) | Treasury snapshots |
| ai | (AI procedures) | AI assistant backend |
| influencer | (influencer procedures) | Influencer mention tracking |

---

## Database Tables (MySQL via Drizzle)

| Table | Purpose |
|-------|---------|
| users | Wallet-based user accounts |
| dca_orders | DCA order configurations |
| limit_orders | Limit order configurations |
| swap_history | Swap transaction records |
| watchlist | User token watchlists |
| blog_posts | Blog/content posts |
| mvs_content | Monster Video Series content |
| media_posts | Media posts (images, videos, NFTs) |
| proposals | DAO governance proposals |
| votes | DAO votes (on-chain verified) |
| delegates | DAO delegates |
| delegations | Voting power delegations |
| treasury_snapshots | Treasury balance history |
| chain_data_cache | On-chain data cache |
| influencer_mentions | Twitter/social influencer mentions |

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
| server/storage.ts | File storage management |
| server/vrf-provider.ts | Verifiable random function provider |
| server/lib/artist-pipeline.ts | NFT art generation pipeline |
| server/lib/nft-trait-engine.ts | NFT trait randomization |
| server/lib/rng-engine.ts | Random number generation |
| server/lib/rewards-engine.ts | Reward calculation engine |
| server/_core/llm.ts | LLM integration (AI assistant) |
| server/_core/imageGeneration.ts | Image generation service |
| server/_core/voiceTranscription.ts | Voice transcription service |
| server/_core/notification.ts | Push notification service |

---

## PM2 Processes on VPS1

| ID | Name | Status | Purpose |
|----|------|--------|---------|
| 11 | hero-dapp | online | Main DApp server (port 3001) |
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
- On-chain token verification for DAO voting (verifyVotingPower)
- URL validation on all external links
- BigInt guards on RPC responses
- Mounted ref cleanup on async operations
- Input validation: ethAddressSchema, txHashSchema, safeStringSchema, tokenSymbolSchema
- HTML/script injection prevention
- CSV injection prevention on exports
- Division-by-zero guards
- localStorage try/catch wrappers
- Accessibility ARIA labels throughout

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
- **NFT Aesthetic**: Steampunk-military theme

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

## Route Health Check (May 8, 2026)

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
