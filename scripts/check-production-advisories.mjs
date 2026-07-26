import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createGunzip, createBrotliDecompress } from "node:zlib";
import https from "node:https";
import process from "node:process";

const REGISTRY_HOST = "registry.npmjs.org";
const AUDIT_PATH = "/-/npm/v1/security/advisories/bulk";
const REPORT_PATH = "production-advisory-report.json";
const MAX_ATTEMPTS = 3;
const REQUEST_DEADLINE_MS = 45_000;
const SOCKET_IDLE_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const KNOWN_SEVERITIES = new Set(["info", "low", "moderate", "high", "critical"]);
const FAIL_SEVERITIES = new Set(["high", "critical"]);
const INVENTORY_COMMAND = [
  "list",
  "--prod",
  "--exclude-peers",
  "--depth",
  "Infinity",
  "--json",
];

class RetryableAuditError extends Error {}
class NonRetryableAuditError extends Error {}

let inventoryEvidence;

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
  const output = execFileSync(pnpm, INVENTORY_COMMAND, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });

  const roots = JSON.parse(output);
  if (!Array.isArray(roots) || roots.length === 0) {
    throw new Error("pnpm returned no production dependency roots");
  }

  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const productionRootNames = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  if (productionRootNames.size === 0) {
    throw new Error("package.json declared no production dependency roots");
  }

  const versions = new Map();
  const visited = new Set();

  function add(name, version) {
    if (typeof name !== "string" || typeof version !== "string") return;
    if (!name || !version) return;
    if (!versions.has(name)) versions.set(name, new Set());
    versions.get(name).add(version);
  }

  function advisoryPackageName(child, fallbackName) {
    const candidate = child?.from ?? child?.name ?? fallbackName;
    if (typeof candidate !== "string" || !candidate.trim()) {
      throw new Error(`production dependency ${fallbackName} had no stable registry package name`);
    }
    return candidate.trim();
  }

  function visitChildren(node) {
    for (const field of ["dependencies", "optionalDependencies"]) {
      const children = node?.[field];
      if (!children || typeof children !== "object") continue;
      for (const [fallbackName, child] of Object.entries(children)) {
        if (!child || typeof child !== "object") continue;
        const resolvedName = advisoryPackageName(child, fallbackName);
        add(resolvedName, child.version);
        visit(child);
      }
    }
  }

  function visit(node) {
    if (!node || typeof node !== "object") return;

    const identity = `${node.path ?? ""}\u0000${node.name ?? ""}\u0000${node.version ?? ""}`;
    if (visited.has(identity)) return;
    visited.add(identity);

    add(node.name, node.version);
    visitChildren(node);
  }

  function visitProductionRootChildren(root) {
    for (const field of ["dependencies", "optionalDependencies"]) {
      const children = root?.[field];
      if (!children || typeof children !== "object") continue;
      for (const [fallbackName, child] of Object.entries(children)) {
        if (!child || typeof child !== "object") continue;
        const declaredName =
          typeof child.name === "string" && child.name.trim()
            ? child.name.trim()
            : fallbackName;
        if (
          !productionRootNames.has(fallbackName) &&
          !productionRootNames.has(declaredName)
        ) {
          continue;
        }
        const advisoryName = advisoryPackageName(child, fallbackName);
        add(advisoryName, child.version);
        visit(child);
      }
    }
  }

  // The workspace/project root is not an installed dependency. pnpm can also
  // retain peer-only root dev packages as non-leaf containers even with
  // --exclude-peers, so begin strictly from names declared in dependencies or
  // optionalDependencies and then traverse their production closure.
  for (const root of roots) visitProductionRootChildren(root);

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

  const inventorySha256 = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  return {
    payload,
    pairCount,
    inventorySha256,
    productionRootCount: productionRootNames.size,
  };
}

function decompressResponse(buffer, contentEncoding) {
  const encoding = String(contentEncoding ?? "").toLowerCase();
  const isGzip =
    encoding.includes("gzip") ||
    (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);

  if (!isGzip && !encoding.includes("br")) return Promise.resolve(buffer);

  const decompressor = isGzip ? createGunzip() : createBrotliDecompress();
  const chunks = [];
  let decodedBytes = 0;

  return new Promise((resolve, reject) => {
    decompressor.on("data", chunk => {
      decodedBytes += chunk.length;
      if (decodedBytes > MAX_RESPONSE_BYTES) {
        decompressor.destroy(
          new NonRetryableAuditError(
            `npm advisory response exceeded ${MAX_RESPONSE_BYTES} decoded bytes`,
          ),
        );
        return;
      }
      chunks.push(chunk);
    });
    decompressor.on("error", reject);
    decompressor.on("end", () => resolve(Buffer.concat(chunks)));
    decompressor.end(buffer);
  });
}

async function requestAdvisories(payload) {
  const requestBody = Buffer.from(JSON.stringify(payload), "utf8");
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    let settled = false;
    let deadline;

    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      callback(value);
    };

    const request = https.request(
      {
        hostname: REGISTRY_HOST,
        port: 443,
        path: AUDIT_PATH,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "Content-Type": "application/json",
          "Content-Length": String(requestBody.length),
          "User-Agent": "hero-dapp-production-advisory-check/1.2",
        },
      },
      response => {
        const chunks = [];
        let receivedBytes = 0;

        response.on("data", chunk => {
          receivedBytes += chunk.length;
          if (receivedBytes > MAX_RESPONSE_BYTES) {
            response.destroy(
              new NonRetryableAuditError(
                `npm advisory response exceeded ${MAX_RESPONSE_BYTES} encoded bytes`,
              ),
            );
            return;
          }
          chunks.push(chunk);
        });

        response.on("aborted", () => {
          settle(
            reject,
            new RetryableAuditError("npm advisory response was aborted"),
          );
        });

        response.on("error", error => {
          if (error instanceof NonRetryableAuditError) {
            settle(reject, error);
            return;
          }
          settle(
            reject,
            new RetryableAuditError(`npm advisory response failed: ${error.message}`),
          );
        });

        response.on("end", async () => {
          if (settled) return;

          const status = response.statusCode ?? 0;
          const rawBody = Buffer.concat(chunks);

          if (RETRYABLE_STATUS.has(status)) {
            settle(
              reject,
              new RetryableAuditError(`npm advisory endpoint returned HTTP ${status}`),
            );
            return;
          }
          if (status !== 200) {
            settle(
              reject,
              new NonRetryableAuditError(
                `npm advisory endpoint returned non-retryable HTTP ${status}`,
              ),
            );
            return;
          }

          let parsed;
          try {
            const decoded = await decompressResponse(
              rawBody,
              response.headers["content-encoding"],
            );
            if (settled) return;
            parsed = JSON.parse(decoded.toString("utf8"));
          } catch (error) {
            if (settled) return;
            if (error instanceof NonRetryableAuditError) {
              settle(reject, error);
              return;
            }
            settle(
              reject,
              new RetryableAuditError(
                `npm advisory response was unreadable: ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
            return;
          }

          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            settle(
              reject,
              new NonRetryableAuditError(
                "npm advisory response was not an object",
              ),
            );
            return;
          }

          const elapsedMs = Date.now() - startedAt;
          if (elapsedMs >= REQUEST_DEADLINE_MS) {
            settle(
              reject,
              new RetryableAuditError(
                `npm advisory request completed after ${elapsedMs}ms, exceeding the ${REQUEST_DEADLINE_MS}ms wall-clock deadline`,
              ),
            );
            request.destroy();
            return;
          }

          settle(resolve, parsed);
        });
      },
    );

    deadline = setTimeout(() => {
      const error = new RetryableAuditError(
        `npm advisory request exceeded ${REQUEST_DEADLINE_MS}ms wall-clock deadline`,
      );
      settle(reject, error);
      request.destroy();
    }, REQUEST_DEADLINE_MS);
    deadline.unref?.();

    request.setTimeout(SOCKET_IDLE_TIMEOUT_MS, () => {
      const error = new RetryableAuditError(
        `npm advisory request exceeded ${SOCKET_IDLE_TIMEOUT_MS}ms socket-idle timeout`,
      );
      settle(reject, error);
      request.destroy();
    });

    request.on("error", error => {
      if (
        error instanceof RetryableAuditError ||
        error instanceof NonRetryableAuditError
      ) {
        settle(reject, error);
        return;
      }
      settle(
        reject,
        new RetryableAuditError(`npm advisory request failed: ${error.message}`),
      );
    });

    request.end(requestBody);
  });
}

function normalizeAdvisoryId(value, packageName) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`npm advisory for ${packageName} had invalid numeric ID`);
    }
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  throw new Error(`npm advisory for ${packageName} had no stable scalar ID`);
}

function requireAdvisoryString(value, field, packageName, advisoryId) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(
      `npm advisory ${advisoryId} for ${packageName} had invalid ${field}`,
    );
  }
  return value.trim();
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

      const id = normalizeAdvisoryId(advisory.id, packageName);
      const severity = String(advisory.severity ?? "").toLowerCase();
      if (!KNOWN_SEVERITIES.has(severity)) {
        throw new Error(
          `npm advisory ${id} for ${packageName} had invalid severity ${JSON.stringify(severity)}`,
        );
      }
      const title = requireAdvisoryString(
        advisory.title,
        "title",
        packageName,
        id,
      );
      const vulnerableVersions = requireAdvisoryString(
        advisory.vulnerable_versions,
        "vulnerable_versions",
        packageName,
        id,
      );
      const url = requireAdvisoryString(
        advisory.url,
        "url",
        packageName,
        id,
      );

      advisories.push({
        packageName,
        id,
        severity,
        title,
        vulnerableVersions,
        url,
      });
    }
  }

  const unique = new Map();
  for (const advisory of advisories) {
    const key = `${advisory.packageName}\u0000${advisory.id}`;
    const existing = unique.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(advisory)) {
      throw new Error(
        `npm advisory ${advisory.id} for ${advisory.packageName} had conflicting duplicate entries`,
      );
    }
    if (!existing) unique.set(key, advisory);
  }
  return [...unique.values()];
}

async function main() {
  const {
    payload,
    pairCount,
    inventorySha256,
    productionRootCount,
  } = collectInstalledProductionVersions();
  inventoryEvidence = {
    productionRootCount,
    inventorySha256,
    packageVersionPairs: pairCount,
  };
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
    inventoryCommand: `pnpm ${INVENTORY_COMMAND.join(" ")}`,
    checkedAt: new Date().toISOString(),
    productionRootCount,
    inventorySha256,
    packageVersionPairs: pairCount,
    matchingAdvisories: advisories.length,
    blockingAdvisories: blocking.length,
    informationalCounts,
    blocking,
    result: blocking.length === 0 ? "PASS" : "FAIL",
  };
  writeReport(report);

  console.log(
    `Production advisory inventory: ${productionRootCount} declared roots, ${pairCount} package/version pairs; ${advisories.length} matching advisories; ${blocking.length} high/critical; inventory sha256 ${inventorySha256}.`,
  );

  for (const advisory of blocking) {
    console.error(JSON.stringify(advisory));
  }

  if (informational.length > 0) {
    console.log(`Non-blocking advisory counts: ${JSON.stringify(informationalCounts)}`);
  }

  if (blocking.length > 0) {
    console.error(
      `Production advisory gate failed with ${blocking.length} high/critical advisories`,
    );
    process.exitCode = 1;
    return;
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
      inventoryCommand: `pnpm ${INVENTORY_COMMAND.join(" ")}`,
      checkedAt: new Date().toISOString(),
      ...(inventoryEvidence ?? {}),
      result: "ERROR",
      error: message,
    });
  } catch {
    // The primary failure remains authoritative if evidence persistence also fails.
  }
  console.error(message);
  process.exitCode = 1;
});
