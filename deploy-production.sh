#!/usr/bin/env bash
set -euo pipefail

echo "Direct production deployment is retired." >&2
echo "Use the protected GitHub Actions workflow 'Deploy to VPS1'." >&2
echo "That workflow requires production environment approval, an exact merged commit SHA, strict SSH host verification, frozen pnpm installation, and explicit DEPLOY confirmation." >&2
exit 2
