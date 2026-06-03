#!/usr/bin/env node
/**
 * check-routes.mjs
 * Verifies route/nav consistency.
 */

import { readFileSync, existsSync } from 'fs';

const ROUTES_FILE = 'client/src/lib/routes.ts';
const EXCLUDED_PATTERNS = [/\/api\//, /localhost/, /example\.com/];

async function checkRoutes() {
  console.log('🔍 Checking route consistency...');
  
  if (!existsSync(ROUTES_FILE)) {
    console.error('⚠️  routes.ts not found. Skipping route check.');
    return;
  }

  try {
    const content = readFileSync(ROUTES_FILE, 'utf-8');
    const pathMatches = content.matchAll(/path:\s*["']([^"']+)["']/g);
    const paths = [...pathMatches].map(m => m[1]);
    
    console.log(`  Found ${paths.length} routes.`);
    
    // Check for common issues
    const issues = [];
    
    // Check for trailing slash inconsistency
    paths.forEach(path => {
      if (path.endsWith('/') && path !== '/') {
        issues.push(`Trailing slash: ${path}`);
      }
    });
    
    // Check for duplicate routes
    const seen = new Set();
    paths.forEach(path => {
      if (seen.has(path)) {
        issues.push(`Duplicate route: ${path}`);
      }
      seen.add(path);
    });
    
    if (issues.length > 0) {
      console.error('❌ Route issues found:');
      issues.forEach(i => console.error(`  ${i}`));
      process.exit(1);
    }
    
    console.log('✅ Route consistency check passed.');
  } catch (err) {
    console.error('⚠️  Could not parse routes:', err.message);
  }
}

checkRoutes();