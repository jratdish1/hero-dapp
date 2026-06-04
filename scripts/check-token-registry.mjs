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

const srcDir = join(process.cwd(), "client/src");

function scanFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const relPath = relative(process.cwd(), filePath);
  const violations = [];

  // Skip allowed files
  if (ALLOWED_FILES.some(f => filePath.endsWith(f))) {
    return violations;
  }

  // Check for hardcoded HERO/staking addresses
  for (const [name, addr] of Object.entries(KNOWN_ADDRESSES)) {
    // Match address with word boundaries (not in comments ideally, but simple check)
    const regex = new RegExp(`[^a-zA-Z0-9]${addr}[^a-zA-Z0-9]`);
    if (regex.test(content)) {
      violations.push({ file: relPath, address: name, value: addr });
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
      // Skip certain directories
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
  process.exit(0);
} else {
  console.log("❌ Found duplicated addresses:\n");
  for (const v of violations) {
    console.log(`  ${v.file}: contains ${v.address} (${v.value})`);
  }
  console.log("\nMove all address definitions to:", CONFIG_FILE);
  process.exit(1);
}
