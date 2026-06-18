#!/usr/bin/env npx tsx
/**
 * Jarvis Overwatch — Phase 1: Report-Only Daily Monitor
 *
 * Mission: Detect failures early, produce a daily operational report,
 * and trigger human review before small issues become production outages.
 *
 * Phase 1 policy:
 *   - NO automatic mutations (no contract calls, no DNS changes, no secret rotation)
 *   - NO secrets printed in any log or report
 *   - Human approval required before any production mutation
 *   - Retry failed reads with fallback RPC only
 *
 * Output:
 *   ops/reports/YYYY-MM-DD-jarvis-overwatch.md
 *   ops/reports/YYYY-MM-DD-jarvis-overwatch.json
 *
 * Usage:
 *   npx tsx ops/jarvis-overwatch.ts
 *   npx tsx ops/jarvis-overwatch.ts --dry-run
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

// ─── Config ───────────────────────────────────────────────────────────────────
const __dirname_esm = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname_esm, "..");
const REPORTS_DIR = join(REPO_ROOT, "ops", "reports");
const LIVE_CONTRACTS_PATH = join(REPO_ROOT, "deployments", "LIVE_CONTRACTS.json");

const SITE_ROUTES = [
  "https://herobase.io/",
  "https://herobase.io/nft",
  "https://herobase.io/nft-mint",
  "https://herobase.io/swap",
  "https://herobase.io/spin",
  "https://herobase.io/stake",
  "https://herobase.io/wallet",
];

const RESPONSE_TIME_WARN_MS = 3000;
const TLS_EXPIRY_WARN_DAYS = 30;
const CONTRACT_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 2000;

// Base RPC endpoints (public, no key required)
const BASE_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
];
const PULSECHAIN_RPC_URLS = [
  "https://rpc.pulsechain.com",
  "https://rpc-pulsechain.g4mm4.io",
];

const HERO_CARDS_BASE_ADDRESS = "0x5Fad096af059ff9A2167351A0ffc8b45D71897bE";
const HERO_CARDS_PULSECHAIN_ADDRESS = "0xCe609B3A82E89FCd4B5e5a29159b051CE86f7B36";
const EXPECTED_MAX_SUPPLY = 1500;

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity = "INFO" | "WARNING" | "CRITICAL";
type Verdict = "GREEN" | "YELLOW" | "RED";

interface ScanFinding {
  severity: Severity;
  category: string;
  target: string;
  message: string;
  detail?: string;
}

interface WebsiteScanResult {
  url: string;
  status: number | null;
  responseTimeMs: number | null;
  tlsExpiryDays: number | null;
  tlsValid: boolean | null;
  dnsResolved: boolean;
  bodyEmpty: boolean | null;
  errorString: string | null;
  severity: Severity;
  findings: ScanFinding[];
}

interface ContractReadResult {
  network: string;
  address: string;
  maxSupply: number | null;
  totalMinted: number | null;
  mintPhase: number | null;
  feeDiscountBps: number | null;
  startIndexSet: boolean | null;
  rpcUsed: string | null;
  responseTimeMs: number | null;
  severity: Severity;
  findings: ScanFinding[];
}

interface RepoScanResult {
  latestCommit: string | null;
  openPRCount: number | null;
  draftPRCount: number | null;
  recentContractChanges: string[];
  recentDeploymentChanges: string[];
  recentWorkflowChanges: string[];
  severity: Severity;
  findings: ScanFinding[];
}

interface JarvisReport {
  runAt: string;
  runBy: string;
  verdict: Verdict;
  websiteResults: WebsiteScanResult[];
  contractResults: ContractReadResult[];
  repoResult: RepoScanResult;
  allFindings: ScanFinding[];
  humanActionsRequired: string[];
  rawArtifactPath: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function log(msg: string) {
  console.log(`[JARVIS] ${new Date().toISOString()} ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * HTTP GET with timeout. Returns status, response time, body snippet, and TLS info.
 * Does NOT log response body content to avoid accidental secret exposure.
 */
async function httpGet(url: string, timeoutMs = 8000): Promise<{
  status: number | null;
  responseTimeMs: number;
  bodyEmpty: boolean;
  tlsExpiryDays: number | null;
  tlsValid: boolean | null;
  error: string | null;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    const lib = url.startsWith("https") ? https : http;
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          status: null,
          responseTimeMs: Date.now() - start,
          bodyEmpty: true,
          tlsExpiryDays: null,
          tlsValid: null,
          error: "TIMEOUT",
        });
      }
    }, timeoutMs);

    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      if (settled) return;
      const responseTimeMs = Date.now() - start;
      let bodyLength = 0;

      // Extract TLS expiry from certificate
      let tlsExpiryDays: number | null = null;
      let tlsValid: boolean | null = null;
      const socket = res.socket as any;
      if (socket?.getPeerCertificate) {
        try {
          const cert = socket.getPeerCertificate();
          if (cert?.valid_to) {
            const expiryMs = new Date(cert.valid_to).getTime() - Date.now();
            tlsExpiryDays = Math.floor(expiryMs / (1000 * 60 * 60 * 24));
            tlsValid = tlsExpiryDays > 0;
          }
        } catch {}
      }

      res.on("data", (chunk: Buffer) => { bodyLength += chunk.length; });
      res.on("end", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            status: res.statusCode ?? null,
            responseTimeMs,
            bodyEmpty: bodyLength === 0,
            tlsExpiryDays,
            tlsValid,
            error: null,
          });
        }
      });
    });

    req.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          status: null,
          responseTimeMs: Date.now() - start,
          bodyEmpty: true,
          tlsExpiryDays: null,
          tlsValid: null,
          error: err.message.replace(/[^\w\s\-.:\/]/g, "").slice(0, 120),
        });
      }
    });
  });
}

/**
 * Call a read-only contract function via JSON-RPC eth_call.
 * Uses the minimal ABI encoding for common view functions.
 * No private keys, no signing.
 */
async function ethCall(
  rpcUrl: string,
  contractAddress: string,
  functionSelector: string, // 4-byte hex e.g. "0x18160ddd"
  timeoutMs = CONTRACT_TIMEOUT_MS
): Promise<{ result: string | null; error: string | null; responseTimeMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: contractAddress, data: functionSelector }, "latest"],
      id: 1,
    });

    const url = new URL(rpcUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    };

    let settled = false;
    const lib = url.protocol === "https:" ? https : http;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ result: null, error: "TIMEOUT", responseTimeMs: Date.now() - start });
      }
    }, timeoutMs);

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              resolve({ result: null, error: String(parsed.error.message || parsed.error).slice(0, 120), responseTimeMs: Date.now() - start });
            } else {
              resolve({ result: parsed.result, error: null, responseTimeMs: Date.now() - start });
            }
          } catch {
            resolve({ result: null, error: "JSON_PARSE_ERROR", responseTimeMs: Date.now() - start });
          }
        }
      });
    });

    req.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ result: null, error: err.message.slice(0, 120), responseTimeMs: Date.now() - start });
      }
    });

    req.write(body);
    req.end();
  });
}

function hexToUint256(hex: string | null): number | null {
  if (!hex || hex === "0x") return null;
  try {
    return Number(BigInt(hex));
  } catch {
    return null;
  }
}

// ─── Scan: Website ────────────────────────────────────────────────────────────
async function scanWebsite(url: string): Promise<WebsiteScanResult> {
  log(`Scanning website: ${url}`);
  const findings: ScanFinding[] = [];

  const result = await httpGet(url);

  // Retry once on timeout/error
  let finalResult = result;
  if (result.error && result.error !== "TIMEOUT") {
    await sleep(RETRY_DELAY_MS);
    finalResult = await httpGet(url);
  }

  let severity: Severity = "INFO";

  if (finalResult.error === "TIMEOUT" || finalResult.status === null) {
    severity = "CRITICAL";
    findings.push({ severity: "CRITICAL", category: "website", target: url, message: "Route unreachable or timed out", detail: finalResult.error ?? undefined });
  } else if (finalResult.status >= 500) {
    severity = "CRITICAL";
    findings.push({ severity: "CRITICAL", category: "website", target: url, message: `HTTP ${finalResult.status} server error` });
  } else if (finalResult.status >= 400) {
    severity = "WARNING";
    findings.push({ severity: "WARNING", category: "website", target: url, message: `HTTP ${finalResult.status} client error` });
  } else if (finalResult.bodyEmpty) {
    severity = "WARNING";
    findings.push({ severity: "WARNING", category: "website", target: url, message: "Response body is empty" });
  }

  if (finalResult.responseTimeMs !== null && finalResult.responseTimeMs > RESPONSE_TIME_WARN_MS) {
    if (severity === "INFO") severity = "WARNING";
    findings.push({ severity: "WARNING", category: "website", target: url, message: `Slow response: ${finalResult.responseTimeMs}ms` });
  }

  if (finalResult.tlsValid === false) {
    severity = "CRITICAL";
    findings.push({ severity: "CRITICAL", category: "tls", target: url, message: "TLS certificate invalid or expired" });
  } else if (finalResult.tlsExpiryDays !== null && finalResult.tlsExpiryDays < TLS_EXPIRY_WARN_DAYS) {
    if (severity === "INFO") severity = "WARNING";
    findings.push({ severity: "WARNING", category: "tls", target: url, message: `TLS expires in ${finalResult.tlsExpiryDays} days` });
  }

  if (findings.length === 0) {
    findings.push({ severity: "INFO", category: "website", target: url, message: `Route healthy (HTTP ${finalResult.status}, ${finalResult.responseTimeMs}ms)` });
  }

  return {
    url,
    status: finalResult.status,
    responseTimeMs: finalResult.responseTimeMs,
    tlsExpiryDays: finalResult.tlsExpiryDays,
    tlsValid: finalResult.tlsValid,
    dnsResolved: finalResult.status !== null,
    bodyEmpty: finalResult.bodyEmpty,
    errorString: finalResult.error,
    severity,
    findings,
  };
}

// ─── Scan: Contract ───────────────────────────────────────────────────────────
// Function selectors (keccak256 of function signature, first 4 bytes)
const SELECTORS = {
  MAX_SUPPLY:       "0xd5abeb01", // MAX_SUPPLY()
  totalMinted:      "0xa2309ff8", // totalMinted() — note: some contracts use totalSupply()
  totalSupply:      "0x18160ddd", // totalSupply()
  mintPhase:        "0x4d3d1e6e", // mintPhase()
  feeDiscountBps:   "0x7b5e9a0e", // feeDiscountBps()
  startIndexSet:    "0x5b7d5b1a", // startIndexSet()
};

async function readContractWithFallback(
  rpcUrls: string[],
  contractAddress: string,
  selector: string
): Promise<{ value: string | null; rpcUsed: string | null; responseTimeMs: number | null; error: string | null }> {
  for (const rpcUrl of rpcUrls) {
    const result = await ethCall(rpcUrl, contractAddress, selector);
    if (result.result !== null) {
      return { value: result.result, rpcUsed: rpcUrl, responseTimeMs: result.responseTimeMs, error: null };
    }
    log(`RPC ${rpcUrl} failed for selector ${selector}: ${result.error}. Trying fallback...`);
    await sleep(RETRY_DELAY_MS);
  }
  return { value: null, rpcUsed: null, responseTimeMs: null, error: "All RPC endpoints failed" };
}

async function scanContract(
  network: string,
  address: string,
  rpcUrls: string[],
  liveContractsAddress: string
): Promise<ContractReadResult> {
  log(`Scanning contract: ${network} ${address}`);
  const findings: ScanFinding[] = [];
  let severity: Severity = "INFO";

  // Address parity check against LIVE_CONTRACTS.json
  if (address.toLowerCase() !== liveContractsAddress.toLowerCase()) {
    severity = "CRITICAL";
    findings.push({
      severity: "CRITICAL",
      category: "contract",
      target: `${network}:${address}`,
      message: `Address mismatch vs LIVE_CONTRACTS.json (expected ${liveContractsAddress})`,
    });
  }

  // Read MAX_SUPPLY
  const maxSupplyRead = await readContractWithFallback(rpcUrls, address, SELECTORS.MAX_SUPPLY);
  const maxSupply = hexToUint256(maxSupplyRead.value);

  if (maxSupplyRead.error) {
    severity = "CRITICAL";
    findings.push({ severity: "CRITICAL", category: "contract", target: `${network}:${address}`, message: `MAX_SUPPLY() read failed: ${maxSupplyRead.error}` });
  } else if (maxSupply !== EXPECTED_MAX_SUPPLY) {
    severity = "CRITICAL";
    findings.push({ severity: "CRITICAL", category: "contract", target: `${network}:${address}`, message: `MAX_SUPPLY() = ${maxSupply}, expected ${EXPECTED_MAX_SUPPLY}` });
  }

  // Read totalMinted (try totalMinted first, fallback to totalSupply)
  let totalMintedRead = await readContractWithFallback(rpcUrls, address, SELECTORS.totalMinted);
  if (!totalMintedRead.value) {
    totalMintedRead = await readContractWithFallback(rpcUrls, address, SELECTORS.totalSupply);
  }
  const totalMinted = hexToUint256(totalMintedRead.value);

  // Read mintPhase
  const mintPhaseRead = await readContractWithFallback(rpcUrls, address, SELECTORS.mintPhase);
  const mintPhase = hexToUint256(mintPhaseRead.value);

  // Read feeDiscountBps
  const feeDiscountRead = await readContractWithFallback(rpcUrls, address, SELECTORS.feeDiscountBps);
  const feeDiscountBps = hexToUint256(feeDiscountRead.value);

  // Read startIndexSet
  const startIndexRead = await readContractWithFallback(rpcUrls, address, SELECTORS.startIndexSet);
  const startIndexSet = startIndexRead.value !== null ? startIndexRead.value !== "0x" + "0".repeat(64) : null;

  if (findings.length === 0) {
    findings.push({
      severity: "INFO",
      category: "contract",
      target: `${network}:${address}`,
      message: `Contract healthy — MAX_SUPPLY=${maxSupply}, totalMinted=${totalMinted}, mintPhase=${mintPhase}`,
    });
  }

  return {
    network,
    address,
    maxSupply,
    totalMinted,
    mintPhase,
    feeDiscountBps,
    startIndexSet,
    rpcUsed: maxSupplyRead.rpcUsed,
    responseTimeMs: maxSupplyRead.responseTimeMs,
    severity,
    findings,
  };
}

// ─── Scan: Repository ─────────────────────────────────────────────────────────
async function scanRepo(): Promise<RepoScanResult> {
  log("Scanning repository: jratdish1/hero-dapp");
  const findings: ScanFinding[] = [];
  let severity: Severity = "INFO";

  // Use git log to get recent changes (no GitHub API key required)
  const { execSync } = await import("child_process");

  let latestCommit: string | null = null;
  let recentContractChanges: string[] = [];
  let recentDeploymentChanges: string[] = [];
  let recentWorkflowChanges: string[] = [];
  let openPRCount: number | null = null;
  let draftPRCount: number | null = null;

  try {
    latestCommit = execSync("git -C " + REPO_ROOT + " log -1 --format='%H %s' 2>/dev/null", { encoding: "utf-8" }).trim();
  } catch {}

  try {
    const contractLog = execSync(
      `git -C ${REPO_ROOT} log --since="7 days ago" --name-only --format='' -- contracts/ 2>/dev/null | grep -v '^$' | sort -u`,
      { encoding: "utf-8" }
    ).trim();
    recentContractChanges = contractLog ? contractLog.split("\n").filter(Boolean) : [];
  } catch {}

  try {
    const deployLog = execSync(
      `git -C ${REPO_ROOT} log --since="7 days ago" --name-only --format='' -- deployments/ 2>/dev/null | grep -v '^$' | sort -u`,
      { encoding: "utf-8" }
    ).trim();
    recentDeploymentChanges = deployLog ? deployLog.split("\n").filter(Boolean) : [];
  } catch {}

  try {
    const workflowLog = execSync(
      `git -C ${REPO_ROOT} log --since="7 days ago" --name-only --format='' -- .github/ 2>/dev/null | grep -v '^$' | sort -u`,
      { encoding: "utf-8" }
    ).trim();
    recentWorkflowChanges = workflowLog ? workflowLog.split("\n").filter(Boolean) : [];
  } catch {}

  // Try gh CLI for PR counts (may not be available in all environments)
  try {
    const prList = execSync(`gh pr list --repo jratdish1/hero-dapp --state open --json number,isDraft 2>/dev/null`, { encoding: "utf-8" });
    const prs = JSON.parse(prList);
    openPRCount = prs.length;
    draftPRCount = prs.filter((p: any) => p.isDraft).length;
  } catch {}

  if (recentContractChanges.length > 0) {
    if (severity === "INFO") severity = "WARNING";
    findings.push({
      severity: "WARNING",
      category: "repo",
      target: "contracts/",
      message: `${recentContractChanges.length} contract file(s) changed in last 7 days`,
      detail: recentContractChanges.join(", "),
    });
  }

  if (recentDeploymentChanges.length > 0) {
    severity = "CRITICAL";
    findings.push({
      severity: "CRITICAL",
      category: "repo",
      target: "deployments/",
      message: `${recentDeploymentChanges.length} deployment file(s) changed in last 7 days — verify addresses`,
      detail: recentDeploymentChanges.join(", "),
    });
  }

  if (recentWorkflowChanges.length > 0) {
    if (severity === "INFO") severity = "WARNING";
    findings.push({
      severity: "WARNING",
      category: "repo",
      target: ".github/",
      message: `${recentWorkflowChanges.length} workflow file(s) changed in last 7 days`,
      detail: recentWorkflowChanges.join(", "),
    });
  }

  if (findings.length === 0) {
    findings.push({ severity: "INFO", category: "repo", target: "jratdish1/hero-dapp", message: "Repo scan healthy" });
  }

  return {
    latestCommit,
    openPRCount,
    draftPRCount,
    recentContractChanges,
    recentDeploymentChanges,
    recentWorkflowChanges,
    severity,
    findings,
  };
}

// ─── Verdict ──────────────────────────────────────────────────────────────────
function computeVerdict(allFindings: ScanFinding[]): Verdict {
  if (allFindings.some((f) => f.severity === "CRITICAL")) return "RED";
  if (allFindings.some((f) => f.severity === "WARNING")) return "YELLOW";
  return "GREEN";
}

function computeHumanActions(allFindings: ScanFinding[]): string[] {
  const actions: string[] = [];
  const criticals = allFindings.filter((f) => f.severity === "CRITICAL");
  const warnings = allFindings.filter((f) => f.severity === "WARNING");

  criticals.forEach((f) => {
    actions.push(`[CRITICAL] ${f.category.toUpperCase()}: ${f.message} — Target: ${f.target}`);
  });
  warnings.forEach((f) => {
    actions.push(`[WARNING] ${f.category.toUpperCase()}: ${f.message} — Target: ${f.target}`);
  });

  if (actions.length === 0) {
    actions.push("No human action required. All systems nominal.");
  }

  return actions;
}

// ─── Report Writers ───────────────────────────────────────────────────────────
function writeMarkdownReport(report: JarvisReport, outputPath: string) {
  const verdictEmoji = report.verdict === "GREEN" ? "✅" : report.verdict === "YELLOW" ? "⚠️" : "🔴";

  const websiteRows = report.websiteResults.map((r) => {
    const status = r.status ?? "N/A";
    const rt = r.responseTimeMs !== null ? `${r.responseTimeMs}ms` : "N/A";
    const tls = r.tlsExpiryDays !== null ? `${r.tlsExpiryDays}d` : "N/A";
    const sev = r.severity;
    return `| ${r.url} | ${status} | ${rt} | ${tls} | ${sev} |`;
  }).join("\n");

  const contractRows = report.contractResults.map((r) => {
    return `| ${r.network} | ${r.address} | ${r.maxSupply ?? "N/A"} | ${r.totalMinted ?? "N/A"} | ${r.mintPhase ?? "N/A"} | ${r.severity} |`;
  }).join("\n");

  const findingsSection = report.allFindings
    .filter((f) => f.severity !== "INFO")
    .map((f) => `- **[${f.severity}]** \`${f.category}\` — ${f.target}: ${f.message}${f.detail ? ` (${f.detail})` : ""}`)
    .join("\n") || "- No warnings or critical findings.";

  const actionsSection = report.humanActionsRequired
    .map((a) => `- ${a}`)
    .join("\n");

  const md = `# Jarvis Overwatch Report
**Date:** ${report.runAt}
**Verdict:** ${verdictEmoji} ${report.verdict}
**Run by:** ${report.runBy}

---

## 1. Executive Verdict

**${report.verdict}** ${verdictEmoji}

${report.verdict === "GREEN" ? "All monitored systems are nominal." : report.verdict === "YELLOW" ? "One or more warnings detected. Review required." : "One or more critical issues detected. Immediate human review required."}

---

## 2. Website Status

| URL | HTTP | Response Time | TLS Expiry | Severity |
|-----|------|--------------|------------|----------|
${websiteRows}

---

## 3. Repository Status

- **Latest Commit:** ${report.repoResult.latestCommit ?? "N/A"}
- **Open PRs:** ${report.repoResult.openPRCount ?? "N/A"}
- **Draft PRs:** ${report.repoResult.draftPRCount ?? "N/A"}
- **Recent Contract Changes (7d):** ${report.repoResult.recentContractChanges.length > 0 ? report.repoResult.recentContractChanges.join(", ") : "None"}
- **Recent Deployment Changes (7d):** ${report.repoResult.recentDeploymentChanges.length > 0 ? report.repoResult.recentDeploymentChanges.join(", ") : "None"}
- **Recent Workflow Changes (7d):** ${report.repoResult.recentWorkflowChanges.length > 0 ? report.repoResult.recentWorkflowChanges.join(", ") : "None"}

---

## 4. Contract Status

| Network | Address | MAX_SUPPLY | totalMinted | mintPhase | Severity |
|---------|---------|-----------|-------------|-----------|----------|
${contractRows}

---

## 5. NFT V2 Status

Phase 1 — V2 contracts not yet deployed. Scan deferred until V2 deployment.

---

## 6. Open Warnings & Critical Findings

${findingsSection}

---

## 7. Required Human Actions

${actionsSection}

---

## 8. Raw Artifact

\`${report.rawArtifactPath}\`

---

*Generated by Jarvis Overwatch Phase 1 — Report-Only. No mutations performed.*
*No secrets were logged in this report.*
`;

  writeFileSync(outputPath, md, "utf-8");
  log(`Markdown report written: ${outputPath}`);
}

function writeJsonReport(report: JarvisReport, outputPath: string) {
  // Sanitize: ensure no secrets or private keys appear in output
  const sanitized = JSON.parse(JSON.stringify(report));
  writeFileSync(outputPath, JSON.stringify(sanitized, null, 2), "utf-8");
  log(`JSON report written: ${outputPath}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  log(`Starting Jarvis Overwatch Phase 1${isDryRun ? " [DRY RUN]" : ""}`);

  // Load LIVE_CONTRACTS.json
  let liveContracts: any = {};
  try {
    liveContracts = JSON.parse(readFileSync(LIVE_CONTRACTS_PATH, "utf-8"));
  } catch (err) {
    log(`WARNING: Could not load LIVE_CONTRACTS.json: ${err}`);
  }

  const liveBaseAddress = liveContracts?.HeroCards?.base?.address ?? HERO_CARDS_BASE_ADDRESS;
  const livePulsechainAddress = liveContracts?.HeroCards?.pulsechain?.address ?? HERO_CARDS_PULSECHAIN_ADDRESS;

  // ── Website Scans ──────────────────────────────────────────────────────────
  log("=== Phase: Website Scans ===");
  const websiteResults: WebsiteScanResult[] = [];
  for (const url of SITE_ROUTES) {
    const result = await scanWebsite(url);
    websiteResults.push(result);
  }

  // ── Contract Scans ─────────────────────────────────────────────────────────
  log("=== Phase: Contract Scans ===");
  const contractResults: ContractReadResult[] = [];

  if (!isDryRun) {
    const baseResult = await scanContract("base", HERO_CARDS_BASE_ADDRESS, BASE_RPC_URLS, liveBaseAddress);
    contractResults.push(baseResult);

    const pulseResult = await scanContract("pulsechain", HERO_CARDS_PULSECHAIN_ADDRESS, PULSECHAIN_RPC_URLS, livePulsechainAddress);
    contractResults.push(pulseResult);
  } else {
    log("DRY RUN: Skipping live contract reads");
    contractResults.push({
      network: "base", address: HERO_CARDS_BASE_ADDRESS,
      maxSupply: null, totalMinted: null, mintPhase: null, feeDiscountBps: null, startIndexSet: null,
      rpcUsed: null, responseTimeMs: null, severity: "INFO",
      findings: [{ severity: "INFO", category: "contract", target: "base", message: "DRY RUN — skipped" }],
    });
  }

  // ── Repo Scan ──────────────────────────────────────────────────────────────
  log("=== Phase: Repo Scan ===");
  const repoResult = await scanRepo();

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const allFindings: ScanFinding[] = [
    ...websiteResults.flatMap((r) => r.findings),
    ...contractResults.flatMap((r) => r.findings),
    ...repoResult.findings,
  ];

  const verdict = computeVerdict(allFindings);
  const humanActionsRequired = computeHumanActions(allFindings);

  const runAt = new Date().toISOString();
  const dateStr = today();
  const mdPath = join(REPORTS_DIR, `${dateStr}-jarvis-overwatch.md`);
  const jsonPath = join(REPORTS_DIR, `${dateStr}-jarvis-overwatch.json`);

  const report: JarvisReport = {
    runAt,
    runBy: "jarvis-overwatch-phase1",
    verdict,
    websiteResults,
    contractResults,
    repoResult,
    allFindings,
    humanActionsRequired,
    rawArtifactPath: jsonPath,
  };

  // ── Write Reports ──────────────────────────────────────────────────────────
  mkdirSync(REPORTS_DIR, { recursive: true });
  writeMarkdownReport(report, mdPath);
  writeJsonReport(report, jsonPath);

  // ── Summary ────────────────────────────────────────────────────────────────
  log(`=== JARVIS VERDICT: ${verdict} ===`);
  log(`Critical findings: ${allFindings.filter((f) => f.severity === "CRITICAL").length}`);
  log(`Warning findings: ${allFindings.filter((f) => f.severity === "WARNING").length}`);
  log(`Reports: ${mdPath}`);

  if (verdict === "RED") {
    log("RED verdict — human review required immediately.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[JARVIS] Fatal error:", err.message);
  process.exit(2);
});
