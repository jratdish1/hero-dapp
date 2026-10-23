# Receipts: queue row 216, HERO front-end containment (2026-10-22)

Base: `main` @ `4a8775f009750532dd502d5aa5af34042c535945`. Branch: `grokbot/hero-fe-containment-20261022`.

| Receipt | File |
|---|---|
| `pnpm check` (tsc --noEmit) | `check.log` (EXIT 0) |
| `pnpm test` (vitest) | `test.log` (27 files, 470 tests passed: 456 existing + 14 new) |
| `pnpm build` (vite + esbuild) | `build.log` (EXIT 0) |
| Bundle red-team grep of `dist/public` | `redteam-bundle-grep.txt` |
| Headless Chrome screenshots of `vite preview` (disconnected, no wallet) | `screenshots/*.jpg` (captured as PNG, converted to JPEG q78 for repo size) |
| DOM assertions captured with each screenshot | `screenshots/dom-assertions.json` |
| Screenshot script | `shoot216.py` |
| gitleaks 8.21.2 on branch commits | `gitleaks.txt` (no leaks found) |
| sha256 of changed source files | `sha256-changed-src.txt` |

No wallet was connected, no contract was called, and no `.env` or secret was read.
| Local run of CI browser gates (csp-routes, swap-intent, scroll-lock) | `ci-browser-gates-local.log` (all PASS) |
| Red-team grep script | `redteam.sh` |
