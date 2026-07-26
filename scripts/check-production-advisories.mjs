import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createGunzip, createBrotliDecompress } from "node:zlib";
import https from "node:https";
import process from "node:process";

const REGISTRY_HOST = "registry.npmjs.org";
const AUDIT_PATH = "/-/npm/v1/security/advisories/bulk";
const REPORT_PATH = "production-advisory-report.json";
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const KNOWN_SEVERITIES = new Set(["low", "moderate", "high", "critical"]);
const FAIL_SEVERITIES = new Set(["high", "critical"]);

class RetryableAuditError extends Error {}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function writeReport(report) {
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function collectInstalledProductionVersions() {
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const output = execFileSync(
    pnpm,
    ["list", "--prod", "--depth", "Infinity", "--json"],
    {
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    },
  );

  const roots = JSON.parse(output);
  if (!Array.isArray(roots) || roots.length === 0) {
    throw new Error("pnpm returned no production dependency roots");
  }

  const versions = new Map();
  const visited = new Set();

  function add(name, version) {
    if (typeof name !== "string" || typeof version !== "string") return;
    if (!name || !version) return;
    if (!versions.has(name)) versions.set(name, new Set());
    versions.get(name).add(version);
  }

  function visit(node) {
    if (!node || typeof node !== "object") return;

    const identity = `${node.path ?? ""}\u0000${node.name ?? ""}\u0000${node.version ?? ""}`;
    if (visited.has(identity)) return;
    visited.add(identity);

    add(node.name, node.version);

    for (const field of ["dependencies", "optionalDependencies"]) {
      const children = node[field];
      if (!children || typeof children !== "object") continue;
      for (const [fallbackName, child] of Object.entries(children)) {
        if (!child || typeof child !== "object") continue;
        add(child.name ?? fallbackName, child.version);
        visit(child);
      }
    }
  }

  for (const root of roots) visit(root);

  const payload = Object.fromEntries(
    [...versions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, packageVersions]) => [name, [...packageVersions].sort()]),
  );

  const pairCount = Object.values(payload).reduce(
    (total, packageVersions) => total + packageVersions.length,
    0,
  );

  if (pairCount === 0) {
    throw new Error("production dependency inventory was empty");
  }

  return { payload, pairCount };
}

function decompressResponse(buffer, contentEncoding) {
  const encoding = String(contentEncoding ?? "").toLowerCase();
  const isGzip =
    encoding.includes("gzip") ||
    (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);

  if (!isGzip && !encoding.includes("br")) return Promise.resolve(buffer);

  const decompressor = isGzip ? createGunzip() : createBrotliDecompress();
  const chunks = [];
  return new Promise((resolve, reject) => {
    decompressor.on("data", chunk => chunks.push(chunk));
    decompressor.on("error", reject);
    decompressor.on("end", () => resolve(Buffer.concat(chunks)));
    decompressor.end(buffer);
  });
}

async function requestAdvisories(payload) {
  const requestBody = Buffer.from(JSON.stringify(payload), "utf8");

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: REGISTRY_HOST,
        port: 443,
        path: AUDIT_PATH,
        method: "POST",
        timeout: 45_000,
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "Content-Type": "application/json",
          "Content-Length": String(requestBody.length),
          "User-Agent": "hero-dapp-production-advisory-check/1.0",
        },
      },
      response => {
        const chunks = [];
        response.on("data", chunk => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", async () => {
          const status = response.statusCode ?? 0;
          const rawBody = Buffer.concat(chunks);

          if (RETRYABLE_STATUS.has(status)) {
            reject(new RetryableAuditError(`npm advisory endpoint returned HTTP ${status}`));
            return;
          }
          if (status !== 200) {
            reject(new Error(`npm advisory endpoint returned HTTP ${status}`));
            return;
          }

          try {
            const decoded = await decompressResponse(
              rawBody,
              response.headers["content-encoding"],
            );
            const parsed = JSON.parse(decoded.toString("utf8"));
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              throw new Error("npm advisory response was not an object");
            }
            resolve(parsed);
          } catch (error) {
            reject(
              new RetryableAuditError(
                `npm advisory response was unreadable: ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new RetryableAuditError("npm advisory request timed out"));
    });
    request.on("error", error => {
      if (error instanceof RetryableAuditError) {
        reject(error);
        return;
      }
      reject(new RetryableAuditError(`npm advisory request failed: ${error.message}`));
    });
    request.end(requestBody);
  });
}

function normalizeAdvisories(response) {
  const advisories = [];
  for (const [packageName, packageAdvisories] of Object.entries(response)) {
    if (!Array.isArray(packageAdvisories)) {
      throw new Error(`npm advisory response for ${packageName} was not an array`);
    }
    for (const advisory of packageAdvisories) {
      if (!advisory || typeof advisory !== "object") {
        throw new Error(`npm advisory entry for ${packageName} was invalid`);
      }

      const severity = String(advisory.severity ?? "").toLowerCase();
      if (!KNOWN_SEVERITIES.has(severity)) {
        throw new Error(
          `npm advisory ${String(advisory.id ?? "unknown")} for ${packageName} had invalid severity ${JSON.stringify(severity)}`,
        );
      }

      advisories.push({
        packageName,
        id: String(advisory.id ?? "unknown"),
        severity,
        title: String(advisory.title ?? "Untitled advisory"),
        vulnerableVersions: String(advisory.vulnerable_versions ?? "unknown"),
        url: String(advisory.url ?? ""),
      });
    }
  }

  const unique = new Map();
  for (const advisory of advisories) {
    unique.set(`${advisory.packageName}\u0000${advisory.id}`, advisory);
  }
  return [...unique.values()];
}

async function main() {
  const { payload, pairCount } = collectInstalledProductionVersions();
  let response;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      response = await requestAdvisories(payload);
      break;
    } catch (error) {
      lastError = error;
      if (!(error instanceof RetryableAuditError) || attempt === MAX_ATTEMPTS) {
        throw error;
      }
      const delaySeconds = attempt * 5;
      console.error(
        `Transient npm advisory transport/encoding failure on attempt ${attempt}; retrying in ${delaySeconds}s: ${error.message}`,
      );
      await sleep(delaySeconds * 1000);
    }
  }

  if (!response) throw lastError ?? new Error("npm advisory check produced no response");

  const advisories = normalizeAdvisories(response);
  const blocking = advisories.filter(advisory =>
    FAIL_SEVERITIES.has(advisory.severity),
  );
  const informational = advisories.filter(
    advisory => !FAIL_SEVERITIES.has(advisory.severity),
  );
  const informationalCounts = informational.reduce((result, advisory) => {
    result[advisory.severity] = (result[advisory.severity] ?? 0) + 1;
    return result;
  }, {});

  const report = {
    schemaVersion: 1,
    registry: `https://${REGISTRY_HOST}`,
    endpoint: AUDIT_PATH,
    checkedAt: new Date().toISOString(),
    packageVersionPairs: pairCount,
    matchingAdvisories: advisories.length,
    blockingAdvisories: blocking.length,
    informationalCounts,
    blocking,
    result: blocking.length === 0 ? "PASS" : "FAIL",
  };
  writeReport(report);

  console.log(
    `Production advisory inventory: ${pairCount} package/version pairs; ${advisories.length} matching advisories; ${blocking.length} high/critical.`,
  );

  for (const advisory of blocking) {
    console.error(JSON.stringify(advisory));
  }

  if (informational.length > 0) {
    console.log(`Non-blocking advisory counts: ${JSON.stringify(informationalCounts)}`);
  }

  if (blocking.length > 0) {
    throw new Error(
      `Production advisory gate failed with ${blocking.length} high/critical advisories`,
    );
  }

  console.log("Production advisory gate: PASS");
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  try {
    writeReport({
      schemaVersion: 1,
      registry: `https://${REGISTRY_HOST}`,
      endpoint: AUDIT_PATH,
      checkedAt: new Date().toISOString(),
      result: "ERROR",
      error: message,
    });
  } catch {
    // The primary failure remains authoritative if evidence persistence also fails.
  }
  console.error(message);
  process.exitCode = 1;
});
