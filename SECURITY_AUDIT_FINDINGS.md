# Security Audit Findings — Dependency Vulnerabilities

## Patched via pnpm overrides (FIXED)
| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| fast-xml-parser | Critical | Entity encoding bypass via regex injection | Override to >=5.3.8 |
| tar | High | Multiple path traversal vulnerabilities | Override to >=7.5.10 |

## Remaining — Transitive / Dev-Only (Low Risk)
| Package | Severity | Issue | Status |
|---------|----------|-------|--------|
| @trpc/server | High | Prototype pollution in experimental_nextAppDirCaller | We don't use Next.js App Dir — not exploitable |
| pnpm | High (x5) | Various pnpm CLI vulns | Dev tool only, not deployed |
| rollup | High | Path traversal in build tool | Dev-only, not in production bundle |
| vite | High | Server-side vulnerabilities | Dev-only, not in production |
| esbuild | Moderate | Build tool vulnerability | Dev-only, not in production |
| axios | Moderate | SSRF via crafted URL | Server-side only, inputs validated |
| lodash/lodash-es | Moderate | Prototype pollution | Transitive dep, not directly used |
| qs | Moderate | Prototype pollution | Transitive via express, inputs validated |
| dompurify | Moderate | Bypass in specific configs | Transitive dep |
| picomatch | Moderate | ReDoS | Dev-only glob matching |
| path-to-regexp | Low | ReDoS | Transitive via express |
| mdast-util-to-hast | Moderate | XSS in markdown rendering | Streamdown dep, content sanitized server-side |
| @smithy/config-resolver | Moderate | AWS SDK internal | Transitive, not directly exploitable |
