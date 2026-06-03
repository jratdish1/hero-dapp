#!/usr/bin/env node
/**
 * check-token-registry.mjs
 * Scans for duplicate token maps outside shared config.
 * Fails if hardcoded token arrays are found in non-allowed files.
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const ALLOWED_FILES = [
  'shared/tokens.ts',
  'client/src/lib/contract-config.ts',
  'client/src/lib/sss-config.ts',
  'tests/',
  '.github/workflows/',
];

const PATTERNS = [
  /HERO_BASE/,
  /HERO_PULSE/,
  /VETS/,
  /BASE_TOKENS/,
  /PULSECHAIN_TOKENS/,
  /0x[a-fA-F0-9]{40}/,
];

const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'build', '.next'];

async function scanDir(dir, depth = 0) {
  if (depth > 4) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (EXCLUDED_DIRS.includes(entry.name)) continue;
    if (entry.isDirectory()) {
      results = results.concat(await scanDir(fullPath, depth + 1));
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      const content = await readFile(fullPath, 'utf-8').catch(() => '');
      const relPath = fullPath.replace(process.cwd() + '/', '');
      const isAllowed = ALLOWED_FILES.some(f => relPath.startsWith(f));
      for (const pattern of PATTERNS) {
        if (pattern.test(content) && !isAllowed) {
          const lines = content.split('\n');
          const foundLines = lines.filter(l => pattern.test(l));
          results.push({ file: relPath, matches: foundLines.length, pattern: pattern.toString() });
        }
      }
    }
  }
  return results;
}

console.log('🔍 Scanning for duplicate token maps...');
const issues = await scanDir('.');
if (issues.length > 0) {
  console.error('❌ Token registry violations found:');
  issues.forEach(i => console.error(`  ${i.file}: ${i.matches} matches for ${i.pattern}`));
  process.exit(1);
} else {
  console.log('✅ No duplicate token maps found.');
}