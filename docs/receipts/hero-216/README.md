# Receipts: queue row 216, HERO front-end containment (2026-10-22)

Base: `main` @ `4a8775f009750532dd502d5aa5af34042c535945`. Branch: `grokbot/hero-fe-containment-20261022`.

| Receipt | File |
|---|---|
| `pnpm check` (tsc --noEmit) | `check.txt` (exit 0) |
| `pnpm test` (vitest) | `test.txt` (27 files, 473 tests passed after the red-team fixes) |
| Independent red-team (2026-10-23) and its fixes | `REDTEAM-INDEPENDENT-20261023.md` |

No wallet was connected, no contract was called, and no `.env` or secret was read.

The bulkier evidence has been removed from the app repo so it doesn't ship with the source. That covers the full `build.txt`, 10 JPEG screenshots with `dom-assertions.json`, the screenshot and red-team scripts, the local CI browser-gate log, the bundle grep, gitleaks output, the denylist check and source sha256 list. It is still available in this branch's history at commit `011c7a2456a2db79ef8fce4abc115ad214594a6f`, under `docs/receipts/hero-216/`. The authoritative exact-head evidence is the PR's own `CI` run artifacts (`landing-evidence-<sha>`, `production-advisory-evidence-<sha>`).
