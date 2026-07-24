#!/usr/bin/env bash
set -euo pipefail

echo "Direct production deployment is retired." >&2
echo "Use the protected GitHub Actions workflow 'Deploy to VPS1' with:" >&2
echo "- production environment approval" >&2
echo "- an exact 40-character commit SHA already merged to main" >&2
echo "- confirmation value DEPLOY" >&2
exit 2
