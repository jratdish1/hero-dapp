# Deploy Safeguards — Fleet-Wide Standards

## Problem Statement
On May 31, 2026, a deploy failure on VPS1 went undetected for multiple days because:
1. `git pull` silently failed due to divergent branches (local edits on VPS1)
2. The deploy workflow had no `set -e` — so failures didn't stop the pipeline
3. `npm run build` ran with stale code and stale `node_modules`
4. No health check verified the deploy actually worked

## Safeguards Implemented

### 1. Deploy Workflow Hardening (hero-dapp)
- **`set -e`** — Any command failure stops the entire deploy
- **`git fetch + git reset --hard origin/main`** — Force-syncs server to GitHub (no more divergent branch issues)
- **`prebuild` script** — Validates dependencies before every build
- **Cloudflare purge** — Automatic cache purge after every deploy

### 2. Fleet Health Check Workflow
- **Manual trigger** via GitHub Actions (`workflow_dispatch`)
- **Actions available:**
  - `status` — Full health check of VPS1, VPS2, VDS
  - `restart-all` — Restart all PM2 processes
  - `fix-regen-valor` — Restart regen-valor specifically
  - `diagnose-regen-valor` — Deep diagnostic (dist folder, logs, nginx, ports)
- **Checks:** PM2 status, disk usage, memory, nginx, git repos, ports, Docker

### 3. Rules for All Future Deploy Workflows

```yaml
# MANDATORY in all deploy scripts:
set -e                              # Fail fast
git fetch origin main               # Get latest
git reset --hard origin/main        # Force sync (NEVER use git pull on servers)
npm ci || npm install               # Always refresh dependencies
npm run build                       # Build with verified deps
pm2 reload <app-name>              # Graceful reload
```

### 4. Never Do These on Production Servers
- ❌ `git pull` — Can fail silently with divergent branches
- ❌ Manual edits on the server — Creates divergent branches
- ❌ Deploy without `set -e` — Hides failures
- ❌ Skip `npm install` — Stale deps cause build issues
- ❌ Deploy without health check — No verification

### 5. Known Issues (Separate from Deploy)
- **regenvalor.com** — Nginx only listens on port 80, but Cloudflare SSL mode requires port 443. Needs SSL cert or Cloudflare "Flexible" mode.
- **VPS2** — Not accessible from VDS via SSH. Needs key setup.

## Trigger Health Check
```bash
# Via GitHub CLI
gh workflow run fleet-health.yml -f action=status -R jratdish1/hero-dapp

# Via API (with PAT)
curl -X POST \
  -H "Authorization: token <PAT>" \
  "https://api.github.com/repos/jratdish1/hero-dapp/actions/workflows/fleet-health.yml/dispatches" \
  -d '{"ref":"main","inputs":{"action":"status"}}'
```
