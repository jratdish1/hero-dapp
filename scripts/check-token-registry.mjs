/**
 * Token Registry Scanner
 * Validates that HERO/VETS/staking addresses are only defined in client/src/lib/config.ts
 * and not duplicated elsewhere.
 */
import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

const CONFIG_FILE = "client/src/lib/config.ts";
const ALLOWED_FILES = [CONFIG_FILE, "client/src/lib/external-links.ts"];

// Known addresses from verified sources
const KNOWN_ADDRESSES = {
  HERO_BASE: "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8",
  HERO_PULSE: "0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27",
  STAKING_BASE: "0xAD7991a61e5d5C242839445EAAFE244500EEC722",
  STAKING_PULSE: "0xD5F173973eC653E6CD1A6B31d742501A1004297E",
  VETS: "0x4013abBf94A745EfA7cc848989Ee83424A770060",
};

/**
 * Narrow false-positive allowlist.
 *
 * Each entry describes ONE specific pattern that is safe to skip.
 * Rules:
 *   - file:    relative path from project root (must match exactly)
 *   - pattern: regex that matches the FULL LINE containing the address
 *   - reason:  human-readable explanation of why this is safe
 *
 * Do NOT add broad file-level ignores here.
 * Do NOT add patterns that would suppress real hardcoded constants.
 * Each entry must be as narrow as possible.
 */
const FALSE_POSITIVE_ALLOWLIST = [
  {
    // AppLayout.tsx — HERO_PULSE address appears only inside an external spywolf.co
    // audit PDF filename. The URL points to a third-party document; the address
    // is part of the remote filename, not a local token constant.
    file: "client/src/components/AppLayout.tsx",
    pattern: /spywolf\.co\/audits\/.*0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27/,
    reason: "External audit PDF URL — address is part of the remote document filename, not a local constant",
  },
  {
    // AppLayout.tsx — HERO_BASE address appears only inside an external spywolf.co
    // KYC PDF filename. Same reasoning as above.
    file: "client/src/components/AppLayout.tsx",
    pattern: /spywolf\.co\/kyc-verification\/.*0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8/,
    reason: "External KYC PDF URL — address is part of the remote document filename, not a local constant",
  },
  {
    // Home.tsx — HERO_PULSE address appears only inside a scan.pulsechain.com
    // block explorer href. The URL is an external link to the blockchain explorer;
    // the address is part of the explorer path, not a local token constant.
    file: "client/src/pages/Home.tsx",
    pattern: /scan\.pulsechain\.com\/token\/0x35a51Dfc82032682E4Bda8AAcA87B9Bc386C3D27/,
    reason: "External PulseChain block explorer href — address is part of the explorer URL path, not a local constant",
  },
  {
    // Home.tsx — VETS address appears only inside a scan.pulsechain.com
    // block explorer href. Same reasoning as above.
    file: "client/src/pages/Home.tsx",
    pattern: /scan\.pulsechain\.com\/token\/0x4013abBf94A745EfA7cc848989Ee83424A770060/,
    reason: "External PulseChain block explorer href — address is part of the explorer URL path, not a local constant",
  },
];

const srcDir = join(process.cwd(), "client/src");

function isAllowedFalsePositive(relPath, line) {
  for (const entry of FALSE_POSITIVE_ALLOWLIST) {
    if (relPath === entry.file && entry.pattern.test(line)) {
      return true;
    }
  }
  return false;
}

function scanFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const relPath = relative(process.cwd(), filePath);
  const violations = [];

  // Skip allowed files
  if (ALLOWED_FILES.some(f => filePath.endsWith(f))) {
    return violations;
  }

  const lines = content.split("\n");

  // Check for hardcoded HERO/staking addresses
  for (const [name, addr] of Object.entries(KNOWN_ADDRESSES)) {
    const regex = new RegExp(`[^a-zA-Z0-9]${addr}[^a-zA-Z0-9]`);
    if (!regex.test(content)) continue;

    // Address found in file — check if every occurrence is an allowed false positive
    for (const line of lines) {
      if (!line.includes(addr)) continue;
      if (isAllowedFalsePositive(relPath, line)) {
        // This specific line matches a known-safe external URL pattern — skip it
        continue;
      }
      // Real violation: address appears in a non-allowlisted context
      violations.push({ file: relPath, address: name, value: addr });
      break; // one violation per address per file is enough
    }
  }

  return violations;
}

function scanDirectory(dir) {
  const violations = [];
  const files = readdirSync(dir, { withFileTypes: true });
  for (const entry of files) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "rng", "dist"].includes(entry.name)) continue;
      violations.push(...scanDirectory(fullPath));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      violations.push(...scanFile(fullPath));
    }
  }
  return violations;
}

console.log("🔍 Scanning for duplicated token/staking addresses...\n");
const violations = scanDirectory(srcDir);

if (violations.length === 0) {
  console.log("✅ No duplicated addresses found. All HERO/VETS/staking addresses are in shared config.");
  console.log("   (4 known-safe external URL patterns are allowlisted — see FALSE_POSITIVE_ALLOWLIST in this script)");
  process.exit(0);
} else {
  console.log("❌ Found duplicated addresses:\n");
  for (const v of violations) {
    console.log(`  ${v.file}: contains ${v.address} (${v.value})`);
  }
  console.log("\nMove all address definitions to:", CONFIG_FILE);
  process.exit(1);
}
