# Receipts: queue row 216, HERO front-end containment (2026-10-22)

Base: `main` @ `4a8775f009750532dd502d5aa5af34042c535945`. Branch: `grokbot/hero-fe-containment-20261022`.

| Receipt | File |
|---|---|
| `pnpm check` (tsc --noEmit) | `check.txt` (EXIT 0) |
| `pnpm test` (vitest) | `test.txt` (27 files, 473 tests passed after red-team fixes) |
| `pnpm build` (vite + esbuild) | `build.txt` (EXIT 0) |
| Bundle red-team grep of `dist/public` | `redteam-bundle-grep.txt` |
| Headless Chrome screenshots of `vite preview` (disconnected, no wallet) | `screenshots/*.jpg` (captured as PNG, converted to JPEG q78 for repo size) |
| DOM assertions captured with each screenshot | `screenshots/dom-assertions.json` |
| Screenshot script | `shoot216.py` |
| gitleaks 8.21.2 on branch commits | `gitleaks.txt` (no leaks found) |
| sha256 of changed source files | `sha256-changed-src.txt` |

No wallet was connected, no contract was called, and no `.env` or secret was read.
| Local run of CI browser gates (csp-routes, swap-intent, scroll-lock) | `ci-browser-gates-local.txt` (all 8 non-hardhat CI gates exit 0) |
| Red-team grep script | `redteam.sh` |
| Independent red-team (2026-10-23) + fixes | `REDTEAM-INDEPENDENT-20261023.md` |
| Address-denylist gate on PR diff | `denylist-check.txt` |
