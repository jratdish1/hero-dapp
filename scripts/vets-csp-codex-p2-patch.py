#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one replacement target, found {count}')
    target.write_text(text.replace(old, new), encoding='utf-8')


replace_once(
    'client/src/lib/csp-safe-markdown.ts',
    """    /^([ \\t]*)(`{3,}|~{3,})[ \\t]*mermaid(?:[ \\t]+[^\\r\\n]*)?[ \\t]*$/gim,
    (_match, indentation: string, fence: string) => `${indentation}${fence}text`,""",
    """    /^((?:(?:[ \\t]*>[ \\t]*)*)(?:[ \\t]*(?:[-+*]|\\d+[.)])[ \\t]+)?[ \\t]*)(`{3,}|~{3,})[ \\t]*mermaid(?:[ \\t]+[^\\r\\n]*)?[ \\t]*$/gim,
    (_match, containerPrefix: string, fence: string) => `${containerPrefix}${fence}text`,""",
)

replace_once(
    'server/csp-safe-markdown.test.ts',
    """  it(\"leaves non-Mermaid fences and prose unchanged\", () => {
    const value = \"```typescript\\nconst mermaid = true;\\n```\";
    expect(disableMermaidDiagrams(value)).toBe(value);
  });""",
    """  it(\"neutralizes Mermaid fences nested in block quotes and lists\", () => {
    expect(disableMermaidDiagrams(\"> ```mermaid\\n> graph TD; A-->B\\n> ```\"))
      .toBe(\"> ```text\\n> graph TD; A-->B\\n> ```\");
    expect(disableMermaidDiagrams(\"- ```mermaid\\n  graph TD; A-->B\\n  ```\"))
      .toBe(\"- ```text\\n  graph TD; A-->B\\n  ```\");
    expect(disableMermaidDiagrams(\"> 1. ~~~mermaid theme=dark\\n>    A-->B\\n>    ~~~\"))
      .toBe(\"> 1. ~~~text\\n>    A-->B\\n>    ~~~\");
  });

  it(\"leaves non-Mermaid fences and prose unchanged\", () => {
    const value = \"```typescript\\nconst mermaid = true;\\n```\";
    expect(disableMermaidDiagrams(value)).toBe(value);
  });""",
)

approved = [
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
]
approved_js = 'const approvedStyleAttributeFiles = new Set([\n' + ''.join(f"  '{item}',\n" for item in approved) + ']);\n'

replace_once(
    'scripts/check-csp-contract.mjs',
    """const recoveryPaths = [
  path.join(root, 'client/src/components/ErrorBoundary.tsx'),
  path.join(root, 'client/src/components/DappLoadBoundary.tsx'),
];
""",
    """const recoveryPaths = [
  path.join(root, 'client/src/components/ErrorBoundary.tsx'),
  path.join(root, 'client/src/components/DappLoadBoundary.tsx'),
];

""" + approved_js,
)

replace_once(
    'scripts/check-csp-contract.mjs',
    """const nginx = readFileSync(nginxPath, 'utf8');
const policy = nginx.match(
  /add_header Content-Security-Policy \"([^\"]+)\" always;/,
)?.[1];
if (!policy) fail('Nginx CSP header was not found');
const nginxDirectives = parseHeaderPolicy(policy);

const helmetDirectives = normalizeHelmetPolicy(
  await loadActualHelmetProductionPolicy(),
);
comparePolicies('Nginx', nginxDirectives, 'Helmet', helmetDirectives);
""",
    """const nginx = readFileSync(nginxPath, 'utf8');
const nginxPolicies = Array.from(
  nginx.matchAll(/add_header Content-Security-Policy \"([^\"]+)\" always;/g),
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
""",
)

replace_once(
    'scripts/check-csp-contract.mjs',
    """styleFiles.sort();
if (styleFiles.length === 0) {
  fail(\"style-src-attr 'unsafe-inline' is no longer justified; remove it instead\");
}
""",
    """styleFiles.sort();
if (styleFiles.length === 0) {
  fail(\"style-src-attr 'unsafe-inline' is no longer justified; remove it instead\");
}
const unexpectedStyleFiles = styleFiles.filter(
  file => !approvedStyleAttributeFiles.has(file),
);
if (unexpectedStyleFiles.length > 0) {
  fail(
    `Unreviewed style-attribute files were added: ${unexpectedStyleFiles.join(', ')}`,
  );
}
""",
)

replace_once(
    'scripts/check-csp-contract.mjs',
    """  completePolicyComparison: true,
  nginxPolicy: mapToObject(nginxDirectives),""",
    """  completePolicyComparison: true,
  nginxPolicyOccurrences: nginxPolicies.length,
  nginxPolicy: mapToObject(nginxDirectives),""",
)

old_csp = """function cspPolicy() {
  const config = readFileSync(path.join(ROOT, 'nginx/herobase-cache-headers.conf'), 'utf8');
  const policy = config.match(/add_header Content-Security-Policy \"([^\"]+)\" always;/)?.[1];
  if (!policy) throw new Error('Production CSP was not found');
  return policy;
}"""
new_csp = """function cspPolicy() {
  const config = readFileSync(path.join(ROOT, 'nginx/herobase-cache-headers.conf'), 'utf8');
  const policies = Array.from(
    config.matchAll(/add_header Content-Security-Policy \"([^\"]+)\" always;/g),
    match => match[1],
  );
  if (policies.length === 0) throw new Error('Production CSP was not found');
  if (new Set(policies).size !== 1) {
    throw new Error('Effective Nginx CSP policies are not identical');
  }
  return policies[0];
}"""
replace_once('scripts/check-csp-routes.mjs', old_csp, new_csp)

old_prod = """function productionCsp() {
  const source = readFileSync(
    path.join(ROOT, 'nginx/herobase-cache-headers.conf'),
    'utf8',
  );
  const policy = source.match(
    /add_header Content-Security-Policy \"([^\"]+)\" always;/,
  )?.[1];
  if (!policy) throw new Error('Production CSP was not found');
  return policy;
}"""
new_prod = """function productionCsp() {
  const source = readFileSync(
    path.join(ROOT, 'nginx/herobase-cache-headers.conf'),
    'utf8',
  );
  const policies = Array.from(
    source.matchAll(/add_header Content-Security-Policy \"([^\"]+)\" always;/g),
    match => match[1],
  );
  if (policies.length === 0) throw new Error('Production CSP was not found');
  if (new Set(policies).size !== 1) {
    throw new Error('Effective Nginx CSP policies are not identical');
  }
  return policies[0];
}"""
replace_once('scripts/check-scroll-lock-csp.mjs', old_prod, new_prod)

print('Codex P2 CSP corrections applied')
