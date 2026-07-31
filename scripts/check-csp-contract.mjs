#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const nginxPath = path.join(root, 'nginx/herobase-cache-headers.conf');
const securityPath = path.join(root, 'server/_core/security.ts');
const recoveryPaths = [
  path.join(root, 'client/src/components/ErrorBoundary.tsx'),
  path.join(root, 'client/src/components/DappLoadBoundary.tsx'),
];

function fail(message) {
  throw new Error(message);
}

const nginx = readFileSync(nginxPath, 'utf8');
const policy = nginx.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1];
if (!policy) fail('Nginx CSP header was not found');
const directives = new Map(
  policy.split(';').map(item => item.trim()).filter(Boolean).map(item => {
    const [name, ...values] = item.split(/\s+/);
    return [name, values];
  }),
);
const script = directives.get('script-src') ?? [];
if (script.includes("'unsafe-inline'") || script.includes("'unsafe-eval'")) {
  fail('Production script-src permits unsafe inline/eval execution');
}
if ((directives.get('style-src-elem') ?? []).join(' ') !== "'self'") {
  fail("style-src-elem must be exactly 'self'");
}
if ((directives.get('style-src-attr') ?? []).join(' ') !== "'unsafe-inline'") {
  fail('Transitional style-src-attr boundary is missing or broadened');
}

const security = readFileSync(securityPath, 'utf8');
for (const required of [
  'scriptSrc,',
  'styleSrc: ["\'self\'"],',
  'styleSrcElem: ["\'self\'"],',
  'styleSrcAttr: ["\'unsafe-inline\'"],',
]) {
  if (!security.includes(required)) fail(`Helmet CSP contract missing: ${required}`);
}
for (const forbidden of [
  'styleSrc: ["\'self\'", "\'unsafe-inline\'"]',
  'Production uses \'unsafe-inline\'',
]) {
  if (security.includes(forbidden)) fail(`Stale or unsafe Helmet contract remains: ${forbidden}`);
}

for (const file of recoveryPaths) {
  const text = readFileSync(file, 'utf8');
  if (/\.style\.|onFocus=|onBlur=/.test(text)) {
    fail(`Application-owned inline focus styling remains in ${path.relative(root, file)}`);
  }
}

const styleFiles = [];
const clientRoot = path.join(root, 'client/src');
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const full = path.join(directory, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.(?:ts|tsx|js|jsx)$/.test(name)) {
      const text = readFileSync(full, 'utf8');
      if (/style\s*=\s*\{\{|\.style\./.test(text)) styleFiles.push(path.relative(root, full));
    }
  }
}
walk(clientRoot);
styleFiles.sort();
if (styleFiles.length === 0) {
  fail("style-src-attr 'unsafe-inline' is no longer justified; remove it instead");
}

const report = {
  timestamp: new Date().toISOString(),
  result: 'PASS',
  policy,
  scriptSrc: script,
  styleSrcElem: directives.get('style-src-elem'),
  styleSrcAttr: directives.get('style-src-attr'),
  transitionalStyleAttributeFiles: styleFiles,
  removalCondition: 'Remove style-src-attr unsafe-inline after this inventory reaches zero and browser gates remain green.',
};
writeFileSync('csp-contract-report.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Production CSP contract: PASS; transitional style-attribute files=${styleFiles.length}`);
