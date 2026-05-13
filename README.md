# HeroBase.io

![Performance](https://img.shields.io/badge/Performance-86%25-brightgreen?style=flat-square&logo=lighthouse)
![Accessibility](https://img.shields.io/badge/Accessibility-91%25-brightgreen?style=flat-square&logo=lighthouse)
![Best%20Practices](https://img.shields.io/badge/Best%20Practices-92%25-brightgreen?style=flat-square&logo=lighthouse)
![SEO](https://img.shields.io/badge/SEO-100%25-brightgreen?style=flat-square&logo=lighthouse)

Full-stack web application for the $HERO token ecosystem on PulseChain and BASE.

## Lighthouse Scores (May 2026)

| Metric | Score | Value |
|--------|-------|-------|
| Performance | 86% (peak 92%) | — |
| First Contentful Paint | 95 | 1.6s |
| Largest Contentful Paint | 90 | 2.5s |
| Total Blocking Time | 91 | 180ms |
| Cumulative Layout Shift | 100 | 0.000 |
| Speed Index | 65 | 4.9s |
| Time to Interactive | 87 | 4.0s |
| Server Response Time | 100 | 510ms |
| Accessibility | 91% | — |
| Best Practices | 92% | — |
| SEO | 100% | — |

### Performance Optimizations Applied

**Code Splitting & Bundling:**
- React.lazy() for all 40+ pages; only Home page loads initially
- Manual chunks: wagmi/viem (web3), recharts (charts), radix-ui, tanstack separated
- Stripped non-critical modulepreload hints (web3, radix, data-layer)
- React vendor chunk separated for better caching

**Image Optimization:**
- Hero banner: responsive srcset (26KB mobile / 99KB desktop WebP)
- Converted regenvalor_og.png from 911KB PNG to 36KB WebP (96% reduction)
- Compressed regenvalor_hero_bg.webp from 90KB to 30KB (67% reduction, 10% opacity bg)
- Favicon: 205KB CDN JPG replaced with 9KB local WebP
- Removed dead CloudFront preload (151KB wasted per page load)

**App Shell & Rendering:**
- Inline HTML skeleton in `<div id="root">` for instant FCP before JS loads
- Critical inline CSS for dark background (prevents white flash)
- Hero banner image preloaded with responsive `imagesrcset`

**Server & CDN:**
- Nginx: fixed port routing (was 3001, corrected to 3000)
- Nginx: proper cache headers (assets get immutable 1yr, HTML no-cache)
- Nginx: full gzip + brotli compression for all content types
- Cloudflare Edge Cache: HTML cached at edge for 5 min (Cache Rule API)
- Cloudflare Page Rules: MP4 and /assets/* cached at edge for 30 days
- Self-hosted Inter font (eliminates render-blocking Google Fonts)

**Media Deferral:**
- Explainer video (11MB) only downloads when user clicks play
- Background video loads after 8s delay
- Intro modal opens after 5s to avoid blocking LCP

**PM2 Systemd Fix:**
- Fixed pm2-root.service: node not in systemd PATH (nvm install)
- Created /usr/local/bin symlinks for node/npm/npx
- Killed orphan PM2 daemon, restarted via systemd with proper PID tracking

### Performance Journey

| Version | Score | Key Change |
|---------|-------|------------|
| Baseline | 46% | Broken nginx (wrong port, no caching) |
| v2 | 56% | Code splitting (40+ lazy pages) |
| v3 | 62% | Video deferral, favicon, CF edge cache |
| v4 | 73% | Self-hosted font, chunk splitting, modulepreload strip |
| v5 | 86% | App shell, responsive images, PNG→WebP, bg compression |

## Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + tRPC
- **Database:** MySQL (Drizzle ORM)
- **Deployment:** PM2 on VPS1, Cloudflare CDN + Edge Cache
- **Web3:** wagmi + viem (PulseChain + BASE)

## Setup

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | MySQL connection string |
| NODE_ENV | Environment (development/production) |

## Features

- $HERO token dashboard and analytics
- DEX aggregator with multi-route swaps
- Blog system with auto-generation
- DeFi pool monitoring (Aerodrome)
- Cross-chain bridge tracking
- NFT military rank collection
- DAO governance
- LP staking across partner platforms

## Security

- All database queries use parameterized Drizzle ORM
- Environment variables managed via `.env` (not committed)
- CORS configured for production domains only
- Helmet.js security headers
- HSTS with preload

## License

Open Source — MIT
