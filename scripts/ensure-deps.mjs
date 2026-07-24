#!/usr/bin/env node
/**
 * Pre-build dependency validator.
 *
 * This script is intentionally read-only. It verifies that the installed tree
 * matches the security-sensitive package policy and fails closed when it does
 * not. Dependency installation is performed only by an explicit
 * `pnpm install --frozen-lockfile` step before the build.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const NODE_MODULES = join(ROOT, 'node_modules');

function readInstalledVersion(packageName) {
  const packageJsonPath = join(NODE_MODULES, ...packageName.split('/'), 'package.json');
  if (!existsSync(packageJsonPath)) return null;

  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version ?? null;
  } catch (error) {
    throw new Error(`Cannot parse ${packageName} package metadata: ${error.message}`);
  }
}

function pnpmStoreContains(fragment) {
  const storePath = join(NODE_MODULES, '.pnpm');
  if (!existsSync(storePath)) return false;

  return readdirSync(storePath).some(entry => entry.includes(fragment));
}

const issues = [];
const expected = [
  ['@walletconnect/ethereum-provider', '2.17.0'],
  ['@walletconnect/modal', '2.7.0'],
];

for (const [packageName, expectedVersion] of expected) {
  const installedVersion = readInstalledVersion(packageName);
  if (!installedVersion) {
    issues.push(`${packageName} is not installed`);
  } else if (installedVersion !== expectedVersion) {
    issues.push(`${packageName} is ${installedVersion}; expected ${expectedVersion}`);
  }
}

const directReownPath = join(NODE_MODULES, '@reown', 'appkit');
if (existsSync(directReownPath) || pnpmStoreContains('@reown+appkit@')) {
  issues.push('@reown/appkit is present; the repository policy replaces it with empty-npm-package');
}

if (issues.length > 0) {
  console.error('Dependency policy validation failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  console.error('Run: corepack pnpm install --frozen-lockfile');
  process.exit(1);
}

console.log('Dependency policy validation passed.');
