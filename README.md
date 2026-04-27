# HeroBase.io

Full-stack web application for the $HERO token ecosystem on Base chain.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + tRPC
- **Database:** MySQL (Drizzle ORM)
- **Deployment:** PM2 on VPS1

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
- Blog system with auto-generation
- DeFi pool monitoring (Aerodrome)
- Cross-chain bridge tracking

## Security

- All database queries use parameterized Drizzle ORM
- Environment variables managed via `.env` (not committed)
- CORS configured for production domains only

## License

Open Source — MIT
