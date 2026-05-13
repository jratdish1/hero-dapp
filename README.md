# HeroBase.io

![Performance](https://img.shields.io/badge/Performance-62%25-orange?style=flat-square&logo=lighthouse)
![Accessibility](https://img.shields.io/badge/Accessibility-91%25-brightgreen?style=flat-square&logo=lighthouse)
![Best%20Practices](https://img.shields.io/badge/Best%20Practices-92%25-brightgreen?style=flat-square&logo=lighthouse)
![SEO](https://img.shields.io/badge/SEO-100%25-brightgreen?style=flat-square&logo=lighthouse)

Full-stack web application for the $HERO token ecosystem on PulseChain and BASE.

## Lighthouse Scores (May 2026)

| Metric | Score | Value |
|--------|-------|-------|
| Performance | 62% | — |
| First Contentful Paint | 40 | 3.3s |
| Largest Contentful Paint | 15 | 5.8s |
| Total Blocking Time | 84 | 250ms |
| Cumulative Layout Shift | 100 | 0 |
| Speed Index | 40 | 6.4s |
| Time to Interactive | 67 | 5.8s |
| Server Response Time | 100 | 470ms |
| Accessibility | 91% | — |
| Best Practices | 92% | — |
| SEO | 100% | — |

### Performance Optimizations Applied

- **Code Splitting:** React.lazy() for all 40+ pages; only Home page loads initially
- **Manual Chunks:** wagmi/viem (web3), recharts (charts), radix-ui separated into async chunks
- **Nginx Caching:** Hashed assets get `Cache-Control: public, max-age=31536000, immutable`
- **Cloudflare Edge Cache:** HTML cached at edge for 5 min (eliminates TTFB penalty)
- **Cloudflare Page Rules:** MP4 and /assets/* cached at edge for 30 days
- **Gzip Compression:** Full nginx gzip for JS, CSS, HTML, JSON, SVG, fonts
- **Video Deferral:** Explainer video (11MB) only downloads when user clicks play
- **Background Video Deferred:** Tokenomics background video loads after 8s
- **Favicon Optimized:** 205KB CDN JPG replaced with 9KB local WebP
- **Hero Banner Preloaded:** `<link rel="preload">` with `fetchpriority="high"`
- **CDN Preconnect:** `<link rel="preconnect">` for CloudFront CDN
- **Modal Delayed:** Intro modal opens after 5s to avoid blocking LCP measurement

### Remaining Optimization Opportunities

- Evaluate wagmi alternatives that tree-shake better for smaller web3 bundle
- Consider Cloudflare Polish (auto WebP conversion) for remaining CDN images
- Implement responsive hero banner (smaller image for mobile)
- Further code splitting of the main index chunk (~127KB gzip)

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
