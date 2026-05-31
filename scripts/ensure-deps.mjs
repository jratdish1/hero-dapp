#!/usr/bin/env node
/**
 * ensure-deps.mjs — Pre-build dependency validator
 * 
 * Ensures critical packages are at the correct versions before building.
 * This runs as part of `npm run build` to fix stale node_modules on deploy servers
 * where `npm install` is not called by the CI/CD workflow.
 * 
 * Specifically targets:
 * - @walletconnect/ethereum-provider must be 2.17.0 (not 2.23.x which bundles @reown/appkit)
 * - @reown/appkit must NOT exist (causes empty wallet list without cloud.reown.com registration)
 */

import { readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');

function getInstalledVersion(pkg) {
  const pkgJsonPath = join(ROOT, 'node_modules', pkg, 'package.json');
  if (!existsSync(pkgJsonPath)) return null;
  try {
    const data = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    return data.version;
  } catch {
    return null;
  }
}

function checkReownExists() {
  const reownPath = join(ROOT, 'node_modules', '@reown', 'appkit');
  return existsSync(reownPath);
}

// Also check nested node_modules (e.g. inside @walletconnect/ethereum-provider)
function checkNestedReown() {
  const nestedPath = join(ROOT, 'node_modules', '@walletconnect', 'ethereum-provider', 'node_modules', '@reown');
  return existsSync(nestedPath);
}

let needsInstall = false;
const issues = [];

// Check @walletconnect/ethereum-provider version
const wcVersion = getInstalledVersion('@walletconnect/ethereum-provider');
if (!wcVersion) {
  issues.push('@walletconnect/ethereum-provider is not installed');
  needsInstall = true;
} else if (!wcVersion.startsWith('2.17.')) {
  issues.push(`@walletconnect/ethereum-provider is ${wcVersion} (need 2.17.x)`);
  needsInstall = true;
}

// Check @reown/appkit doesn't exist
if (checkReownExists()) {
  issues.push('@reown/appkit exists at top level — must be removed');
  needsInstall = true;
}

if (checkNestedReown()) {
  issues.push('@reown/appkit exists nested inside @walletconnect — must be removed');
  needsInstall = true;
}

// Check @walletconnect/modal version
const modalVersion = getInstalledVersion('@walletconnect/modal');
if (modalVersion && !modalVersion.startsWith('2.7.')) {
  issues.push(`@walletconnect/modal is ${modalVersion} (need 2.7.x)`);
  needsInstall = true;
}

if (issues.length === 0) {
  console.log('✅ Dependencies verified — all correct versions');
  process.exit(0);
}

console.log('⚠️  Dependency issues detected:');
issues.forEach(i => console.log(`   - ${i}`));
console.log('');
console.log('🔧 Fixing dependencies...');

try {
  // Remove problematic packages first
  const reownDir = join(ROOT, 'node_modules', '@reown');
  if (existsSync(reownDir)) {
    console.log('   Removing @reown/...');
    rmSync(reownDir, { recursive: true, force: true });
  }

  // Remove nested @reown inside @walletconnect
  const nestedReown = join(ROOT, 'node_modules', '@walletconnect', 'ethereum-provider', 'node_modules', '@reown');
  if (existsSync(nestedReown)) {
    console.log('   Removing nested @reown/...');
    rmSync(nestedReown, { recursive: true, force: true });
  }

  // Remove old @walletconnect/ethereum-provider if wrong version
  if (wcVersion && !wcVersion.startsWith('2.17.')) {
    const wcDir = join(ROOT, 'node_modules', '@walletconnect', 'ethereum-provider');
    console.log(`   Removing @walletconnect/ethereum-provider@${wcVersion}...`);
    rmSync(wcDir, { recursive: true, force: true });
  }

  // Install correct versions
  console.log('   Installing correct dependency versions...');
  execSync(
    'npm install @walletconnect/ethereum-provider@2.17.0 @walletconnect/modal@2.7.0 --legacy-peer-deps --save-exact 2>&1',
    { cwd: ROOT, stdio: 'inherit', timeout: 120000 }
  );

  // Verify after install
  const newWcVersion = getInstalledVersion('@walletconnect/ethereum-provider');
  const newModalVersion = getInstalledVersion('@walletconnect/modal');
  const reownStillExists = checkReownExists() || checkNestedReown();

  if (newWcVersion?.startsWith('2.17.') && !reownStillExists) {
    console.log('');
    console.log(`✅ Fixed! @walletconnect/ethereum-provider@${newWcVersion}, @walletconnect/modal@${newModalVersion}`);
    console.log('✅ @reown/appkit: removed');
  } else {
    console.warn('⚠️  Post-install check shows potential issues:');
    console.warn(`   WC Provider: ${newWcVersion}`);
    console.warn(`   WC Modal: ${newModalVersion}`);
    console.warn(`   @reown exists: ${reownStillExists}`);
    // Don't fail the build — the Vite alias will still block @reown at bundle time
  }
} catch (err) {
  console.error('❌ Failed to fix dependencies:', err.message);
  console.error('   Build will continue — Vite aliases should still block @reown at bundle time');
  // Don't fail — let the build proceed with Vite aliases as fallback
}

process.exit(0);
// Deploy trigger 1780256845
