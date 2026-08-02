#!/usr/bin/env bash
set -euo pipefail

# VETS HeroBase Codex cloud environment bootstrap.
# Scope: dependency setup and local validation prerequisites only.
# No deployment, service start, secret output, wallet, contract, DNS,
# Cloudflare, trading, or production mutation is performed here.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f package.json || ! -f pnpm-lock.yaml ]]; then
  echo "FAIL-CLOSED: expected HeroBase repository root" >&2
  exit 1
fi

if [[ -e package-lock.json ]]; then
  echo "FAIL-CLOSED: package-lock.json must not exist; pnpm is canonical" >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || {
  echo "FAIL-CLOSED: Node.js is unavailable" >&2
  exit 1
}
command -v corepack >/dev/null 2>&1 || {
  echo "FAIL-CLOSED: Corepack is unavailable" >&2
  exit 1
}

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" -lt 22 ]]; then
  echo "FAIL-CLOSED: Node.js 22 or newer is required; found $(node --version)" >&2
  exit 1
fi

corepack enable
corepack prepare pnpm@10.34.4 --activate
if [[ "$(pnpm --version)" != "10.34.4" ]]; then
  echo "FAIL-CLOSED: pnpm version mismatch" >&2
  exit 1
fi

pnpm install --frozen-lockfile

pnpm exec tsc --version
node --version
pnpm --version

echo "CODEX_ENVIRONMENT_READY"
