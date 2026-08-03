#!/usr/bin/env node
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';
import ts from 'typescript';

const root = process.cwd();
const nginxPath = path.join(root, 'nginx/herobase-cache-headers.conf');
const securityPath = path.join(root, 'server/_core/security.ts');
const htmlPath = path.join(root, 'client/index.html');
const shellRecoveryPath = path.join(
  root,
  'client/public/security-recovery-20260731.css',
);
const compiledRecoveryPath = path.join(root, 'client/src/security-recovery.css');
const viteConfigPath = path.join(root, 'vite.config.ts');
const recoveryPaths = [
  path.join(root, 'client/src/components/ErrorBoundary.tsx'),
  path.join(root, 'client/src/components/DappLoadBoundary.tsx'),
];

const approvedStyleAttributeFiles = new Set([
  'client/src/components/AIChatBox.tsx',
  'client/src/components/AppLayout.tsx',
  'client/src/components/BetaDisclaimer.tsx',
  'client/src/components/ChainStatsWidget.tsx',
  'client/src/components/DashboardLayout.tsx',
  'client/src/components/ExplainerVideoModal.tsx',
  'client/src/components/IntroOverlay.tsx',
  'client/src/components/LiveTicker.tsx',
  'client/src/components/NFTCarousel.tsx',
  'client/src/components/NetworkSwitcher.tsx',
  'client/src/components/PriceImpactWarning.tsx',
  'client/src/components/PriceTicker.tsx',
  'client/src/components/QuickVote.tsx',
  'client/src/components/SquirrelSwapWidget.tsx',
  'client/src/components/ui/chart.tsx',
  'client/src/components/ui/progress.tsx',
  'client/src/components/ui/sidebar.tsx',
  'client/src/components/ui/sonner.tsx',
  'client/src/lib/csp-safe-remove-scroll-bar.tsx',
  'client/src/pages/AiAssistant.tsx',
  'client/src/pages/BaseFarm.tsx',
  'client/src/pages/BaseStake.tsx',
  'client/src/pages/Blog.tsx',
  'client/src/pages/BuyAndBurn.tsx',
  'client/src/pages/DAOProposals.tsx',
  'client/src/pages/DcaOrders.tsx',
  'client/src/pages/Farm.tsx',
  'client/src/pages/Giveaways.tsx',
  'client/src/pages/HeroStake.tsx',
  'client/src/pages/Home.tsx',
  'client/src/pages/LimitOrders.tsx',
  'client/src/pages/MediaHub.tsx',
  'client/src/pages/NFTMint.tsx',
  'client/src/pages/NftCollection.tsx',
  'client/src/pages/Onboarding.tsx',
  'client/src/pages/Portfolio.tsx',
  'client/src/pages/Stake.tsx',
  'client/src/pages/Subdomains.tsx',
  'client/src/pages/Swap.tsx',
  'client/src/pages/Tokenomics.tsx',
  'client/src/pages/dao/DaoDashboard.tsx',
  'client/src/pages/dao/ProposalDetail.tsx',
  'client/src/pages/dao/Proposals.tsx',
  'client/src/pages/dao/Treasury.tsx',
]);

function fail(message) {
  throw new Error(message);
}

function parseHeaderPolicy(policy) {
  return new Map(
    policy
      .split(';')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => {
        const [name, ...values] = item.split(/\s+/);
        return [name, values];
      }),
  );
}

function camelToKebab(value) {
  return value.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`);
}

function normalizeHelmetPolicy(policy) {
  return new Map(
    Object.entries(policy).map(([name, values]) => [
      camelToKebab(name),
      Array.from(values ?? [], value => String(value)),
    ]),
  );
}

function mapToObject(map) {
  return Object.fromEntries(
    [...map.entries()].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function comparePolicies(leftName, left, rightName, right) {
  const leftKeys = [...left.keys()].sort();
  const rightKeys = [...right.keys()].sort();
  if (JSON.stringify(leftKeys) !== JSON.stringify(rightKeys)) {
    fail(
      `${leftName}/${rightName} CSP directive sets differ: ${JSON.stringify({ leftKeys, rightKeys })}`,
    );
  }

  for (const name of leftKeys) {
    const leftValues = left.get(name) ?? [];
    const rightValues = right.get(name) ?? [];
    if (JSON.stringify(leftValues) !== JSON.stringify(rightValues)) {
      fail(
        `${leftName}/${rightName} CSP values differ for ${name}: ${JSON.stringify({ leftValues, rightValues })}`,
      );
    }
  }
}

async function loadActualHelmetProductionPolicy() {
  const source = readFileSync(securityPath, 'utf8');
  const signature = 'function buildCspDirectives()';
  const occurrences = source.split(signature).length - 1;
  if (occurrences !== 1) {
    fail(`Expected one Helmet CSP builder, found ${occurrences}`);
  }

  const instrumented = source.replace(
    signature,
    'export function buildCspDirectives()',
  );
  const transpiled = await transform(instrumented, {
    loader: 'ts',
    format: 'esm',
    target: 'node22',
    sourcemap: false,
  });

  const workdir = await mkdtemp(
    path.join(path.dirname(securityPath), '.vets-csp-contract-'),
  );
  const modulePath = path.join(workdir, 'security-policy.mjs');
  const previousNodeEnv = process.env.NODE_ENV;

  try {
    await writeFile(modulePath, transpiled.code, 'utf8');
    process.env.NODE_ENV = 'production';
    const module = await import(
      `${pathToFileURL(modulePath).href}?v=${Date.now()}`
    );
    if (typeof module.buildCspDirectives !== 'function') {
      fail('Instrumented Helmet CSP builder was not exported');
    }
    const policy = module.buildCspDirectives();
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
      fail('Helmet CSP builder did not return a directive object');
    }
    return policy;
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    await rm(workdir, { recursive: true, force: true });
  }
}

function scriptKindFor(name) {
  if (name.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (name.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (name.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function hasStyleAttributeOrAccess(full, name, text) {
  const source = ts.createSourceFile(
    full,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(name),
  );
  const diagnostics = source.parseDiagnostics ?? [];
  if (diagnostics.length > 0) {
    fail(
      `Unable to parse ${path.relative(root, full)} for style inventory: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, ' ')}`,
    );
  }

  let found = false;
  const visit = node => {
    if (found) return;
    if (
      ts.isJsxAttribute(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'style'
    ) {
      found = true;
      return;
    }
    if (
      ts.isPropertyAccessExpression(node)
      && node.name.text === 'style'
    ) {
      found = true;
      return;
    }
    if (
      ts.isElementAccessExpression(node)
      && node.argumentExpression
      && ts.isStringLiteralLike(node.argumentExpression)
      && node.argumentExpression.text === 'style'
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const nginx = readFileSync(nginxPath, 'utf8');
const nginxPolicies = Array.from(
  nginx.matchAll(/add_header Content-Security-Policy "([^"]+)" always;/g),
  match => match[1],
);
if (nginxPolicies.length === 0) fail('Nginx CSP header was not found');
const nginxDirectiveSets = nginxPolicies.map(parseHeaderPolicy);
const nginxDirectives = nginxDirectiveSets[0];

const helmetDirectives = normalizeHelmetPolicy(
  await loadActualHelmetProductionPolicy(),
);
for (const [index, directives] of nginxDirectiveSets.entries()) {
  comparePolicies(`Nginx policy ${index + 1}`, directives, 'Helmet', helmetDirectives);
}

const script = nginxDirectives.get('script-src') ?? [];
if (script.includes("'unsafe-inline'") || script.includes("'unsafe-eval'")) {
  fail('Production script-src permits unsafe inline/eval execution');
}
if ((nginxDirectives.get('style-src-elem') ?? []).join(' ') !== "'self'") {
  fail("style-src-elem must be exactly 'self'");
}
if ((nginxDirectives.get('style-src-attr') ?? []).join(' ') !== "'unsafe-inline'") {
  fail('Transitional style-src-attr boundary is missing or broadened');
}

for (const file of recoveryPaths) {
  const text = readFileSync(file, 'utf8');
  if (/\.style\.|onFocus=|onBlur=/.test(text)) {
    fail(
      `Application-owned inline focus styling remains in ${path.relative(root, file)}`,
    );
  }
  if (!text.includes('vets-recovery-heading')) {
    fail(`Static recovery-focus class is missing in ${path.relative(root, file)}`);
  }
}

const html = readFileSync(htmlPath, 'utf8');
if (!html.includes('href="/security-recovery-20260731.css"')) {
  fail('HTML shell does not reference the versioned recovery stylesheet');
}
if (html.includes('href="/security-recovery.css"')) {
  fail('HTML shell still references the unversioned recovery stylesheet');
}
if (!existsSync(shellRecoveryPath)) {
  fail('Versioned shell recovery stylesheet is missing');
}
if (existsSync(path.join(root, 'client/public/security-recovery.css'))) {
  fail('Unversioned public recovery stylesheet still exists');
}

for (const file of [shellRecoveryPath, compiledRecoveryPath]) {
  const text = readFileSync(file, 'utf8');
  for (const marker of [
    '#application-error-title.vets-recovery-heading:focus',
    '#dapp-recovery-title.vets-recovery-heading:focus',
    'body[data-scroll-locked]',
    '--vets-scroll-lock-gap',
    '.right-scroll-bar-position',
    '.width-before-scroll-bar',
  ]) {
    if (!text.includes(marker)) {
      fail(
        `Static CSP-safe stylesheet marker missing in ${path.relative(root, file)}: ${marker}`,
      );
    }
  }
}

const viteConfig = readFileSync(viteConfigPath, 'utf8');
const exactScrollLockAlias =
  /find:\s*(?:["']react-remove-scroll-bar["']|\/\^react-remove-scroll-bar\$\/)/;
if (!exactScrollLockAlias.test(viteConfig)) {
  fail('Vite does not define an exact react-remove-scroll-bar alias');
}
if (!viteConfig.includes('csp-safe-remove-scroll-bar.tsx')) {
  fail('Vite scroll-lock alias does not target the CSP-safe shim');
}

for (const file of [
  'client/src/pages/AiAssistant.tsx',
  'client/src/pages/Blog.tsx',
  'client/src/components/AIChatBox.tsx',
]) {
  const text = readFileSync(path.join(root, file), 'utf8');
  if (!text.includes('disableMermaidDiagrams')) {
    fail(`Streamdown Mermaid runtime path is not neutralized in ${file}`);
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
      if (hasStyleAttributeOrAccess(full, name, text)) {
        styleFiles.push(path.relative(root, full));
      }
    }
  }
}
walk(clientRoot);
styleFiles.sort();
if (styleFiles.length === 0) {
  fail("style-src-attr 'unsafe-inline' is no longer justified; remove it instead");
}
const unexpectedStyleFiles = styleFiles.filter(
  file => !approvedStyleAttributeFiles.has(file),
);
if (unexpectedStyleFiles.length > 0) {
  fail(
    `Unreviewed style-attribute files were added: ${unexpectedStyleFiles.join(', ')}`,
  );
}

const report = {
  timestamp: new Date().toISOString(),
  result: 'PASS',
  completePolicyComparison: true,
  nginxPolicyOccurrences: nginxPolicies.length,
  nginxPolicy: mapToObject(nginxDirectives),
  helmetProductionPolicy: mapToObject(helmetDirectives),
  scriptSrc: script,
  styleSrcElem: nginxDirectives.get('style-src-elem'),
  styleSrcAttr: nginxDirectives.get('style-src-attr'),
  versionedRecoveryStylesheet: '/security-recovery-20260731.css',
  exactScrollLockAliasVerified: true,
  scrollLockRuntimeStyleInjectorReplaced: true,
  transitionalStyleAttributeFiles: styleFiles,
  removalCondition:
    'Remove style-src-attr unsafe-inline after this inventory reaches zero and browser gates remain green.',
};
writeFileSync('csp-contract-report.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Production CSP contract: PASS; complete Helmet/Nginx match; transitional style-attribute files=${styleFiles.length}`,
);
// The instrumented security module may retain unrelated top-level handles.
// All evidence is synchronously persisted above, so terminate deterministically.
process.exit(0);
