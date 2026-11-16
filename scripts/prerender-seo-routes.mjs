#!/usr/bin/env node
/**
 * Build-time SEO prerender for herobase.io.
 *
 * Reads the built (or source) SPA shell HTML and writes:
 *   - per-route <route>/index.html with unique title, description, self canonical
 *     and crawlable footer/noscript nav (SPA still boots; #root is unchanged)
 *   - sitemap.xml with lastmod (indexable 200 routes only)
 *   - robots.txt with a single consistent Allow for GPTBot, ClaudeBot, Google-Extended
 *   - 404.html
 *   - nginx/herobase-spa-allowlist.conf (deploy snippet)
 *
 * Usage:
 *   node scripts/prerender-seo-routes.mjs --shell <index.html> --out <dir>
 *   --lastmod YYYY-MM-DD (default: today UTC date)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://herobase.io";

/** Real SPA routes from client/src/App.tsx (exact paths, not redirects). */
export const REAL_ROUTES = [
  { path: "/", title: "HERO Dapp - PulseChain DEX Aggregator", description: "Trade $HERO and $VETS on PulseChain and BASE. DEX aggregator with gasless swaps, DCA orders, limit orders, portfolio tracking, and LP staking.", changefreq: "weekly", priority: "1.0", index: true },
  { path: "/swap", title: "Swap | HERO Dapp", description: "Swap $HERO, $VETS and other tokens on PulseChain and BASE with the HERO DEX aggregator.", changefreq: "daily", priority: "0.9", index: false, robots: "noindex, nofollow" },
  { path: "/wallet", title: "Wallet | HERO Dapp", description: "Open the in-app HERO Wallet to view balances and manage assets in the HERO ecosystem.", changefreq: "weekly", priority: "0.6", index: true },
  { path: "/portfolio", title: "Portfolio | HERO Dapp", description: "Track your HERO and VETS portfolio, balances and performance in the HERO Dapp.", changefreq: "daily", priority: "0.7", index: true },
  { path: "/dashboard", title: "Dashboard | HERO Dapp", description: "Your HERO Dapp dashboard for trading, staking and ecosystem activity.", changefreq: "daily", priority: "0.8", index: true },
  { path: "/dca", title: "DCA Orders | HERO Dapp", description: "Set dollar-cost averaging orders for $HERO and $VETS on PulseChain and BASE.", changefreq: "weekly", priority: "0.7", index: true },
  { path: "/limits", title: "Limit Orders | HERO Dapp", description: "Place limit orders on the HERO DEX aggregator.", changefreq: "weekly", priority: "0.7", index: true },
  { path: "/approvals", title: "Token Approvals | HERO Dapp", description: "Review and manage token approvals for the HERO Dapp. Use a trusted revoke tool before connecting a wallet.", changefreq: "monthly", priority: "0.6", index: true },
  { path: "/bootcamp", title: "Boot Camp | HERO Dapp", description: "HERO Boot Camp: learn and participate in the HERO ecosystem programs.", changefreq: "weekly", priority: "0.7", index: true },
  { path: "/stake", title: "Stake HERO | HERO Dapp", description: "Stake HERO and view staking options in the HERO Dapp.", changefreq: "weekly", priority: "0.8", index: true },
  { path: "/stake/base", title: "Stake on Base | HERO Dapp", description: "Stake HERO on Base in the HERO Dapp.", changefreq: "weekly", priority: "0.7", index: true },
  { path: "/stake/dai", title: "Stake HERO to DAI | HERO Dapp", description: "Stake HERO and earn DAI in the HERO Dapp.", changefreq: "weekly", priority: "0.7", index: true },
  { path: "/media", title: "Media | HERO Dapp", description: "News, videos and media from the HERO ecosystem and VIC Foundation.", changefreq: "weekly", priority: "0.6", index: true },
  { path: "/ai", title: "AI Assistant | HERO Dapp", description: "Ask the HERO AI assistant about the Dapp, tokenomics and ecosystem.", changefreq: "monthly", priority: "0.6", index: true },
  { path: "/tokenomics", title: "Tokenomics | HERO Dapp", description: "HERO tokenomics: supply, utility and how the token supports the VIC Foundation mission.", changefreq: "monthly", priority: "0.8", index: true },
  { path: "/nft", title: "NFT Collection | HERO Dapp", description: "Explore the HERO military-rank NFT collection.", changefreq: "weekly", priority: "0.7", index: false, robots: "noindex, nofollow" },
  { path: "/ecosystem", title: "Ecosystem | HERO Dapp", description: "Discover projects and partners in the HERO and VIC Foundation ecosystem.", changefreq: "monthly", priority: "0.6", index: true },
  { path: "/community", title: "Community | HERO Dapp", description: "Community updates, posts and resources from HERO and the VIC Foundation.", changefreq: "weekly", priority: "0.7", index: true },
  { path: "/community-hub", title: "Community Hub | HERO Dapp", description: "The HERO Community Hub for galleries, events and member highlights.", changefreq: "weekly", priority: "0.6", index: true },
  { path: "/dao", title: "DAO | HERO Dapp", description: "HERO DAO overview: governance, proposals, delegates and treasury.", changefreq: "weekly", priority: "0.7", index: true },
  { path: "/dao/proposals", title: "DAO Proposals | HERO Dapp", description: "Browse and vote on HERO DAO proposals.", changefreq: "weekly", priority: "0.6", index: true },
  { path: "/dao/proposals/create", title: "Create a Proposal | HERO Dapp", description: "Create a new HERO DAO proposal.", changefreq: "monthly", priority: "0.4", index: false },
  { path: "/dao/treasury", title: "DAO Treasury | HERO Dapp", description: "View the HERO DAO treasury.", changefreq: "monthly", priority: "0.6", index: true },
  { path: "/dao/delegates", title: "DAO Delegates | HERO Dapp", description: "View and choose HERO DAO delegates.", changefreq: "monthly", priority: "0.6", index: true },
  { path: "/bots", title: "ABLE Bots | HERO Dapp", description: "Learn about ABLE bots in the HERO ecosystem.", changefreq: "monthly", priority: "0.6", index: true },
  { path: "/start", title: "Start Here | HERO Dapp", description: "Get started with the HERO Dapp: a short onboarding for veterans and new users.", changefreq: "monthly", priority: "0.5", index: true },
  { path: "/explainer", title: "Explainer | HERO Dapp", description: "Watch the HERO Dapp explainer and learn how the ecosystem works.", changefreq: "monthly", priority: "0.5", index: true },
  { path: "/directory", title: "Ecosystem Directory | HERO Dapp", description: "Directory of HERO and VIC Foundation ecosystem projects.", changefreq: "monthly", priority: "0.6", index: true },
  { path: "/dex-analytics", title: "DEX Analytics | HERO Dapp", description: "DEX analytics and pool insights for the HERO aggregator.", changefreq: "weekly", priority: "0.6", index: true },
  { path: "/burn", title: "Buy and Burn | HERO Dapp", description: "Follow HERO buy-and-burn activity.", changefreq: "weekly", priority: "0.6", index: true },
  { path: "/nft-mint", title: "NFT Mint | HERO Dapp", description: "Mint HERO military-rank NFTs.", changefreq: "monthly", priority: "0.5", index: true },
  { path: "/dao-proposals", title: "Vote | HERO Dapp", description: "Vote on HERO DAO proposals.", changefreq: "weekly", priority: "0.5", index: true },
  { path: "/giveaways", title: "Giveaways | HERO Dapp", description: "Current HERO community giveaways.", changefreq: "weekly", priority: "0.5", index: true },
  { path: "/holder-rewards", title: "Holder Rewards | HERO Dapp", description: "HERO holder rewards and benefits.", changefreq: "weekly", priority: "0.5", index: true },
  { path: "/spin", title: "Spin Wheel | HERO Dapp", description: "The HERO spin wheel.", changefreq: "weekly", priority: "0.4", index: true },
  { path: "/beta-disclaimer", title: "Beta Disclaimer | HERO Dapp", description: "Beta software disclaimer for the HERO Dapp.", changefreq: "yearly", priority: "0.3", index: true },
  { path: "/disclaimer", title: "Disclaimer | HERO Dapp", description: "Software disclaimer for the HERO Dapp.", changefreq: "yearly", priority: "0.3", index: true },
  { path: "/login", title: "Login | HERO Dapp", description: "Sign in to the HERO Dapp.", changefreq: "yearly", priority: "0.1", index: false, robots: "noindex, follow" },
];

/** Client-side Redirect routes in App.tsx — served as nginx 301s. */
export const REDIRECTS = [
  { from: "/farm", to: "/bootcamp" },
  { from: "/dapp-farm", to: "/bootcamp" },
  { from: "/stake-base", to: "/stake/base" },
  { from: "/stake-dai", to: "/stake/dai" },
  { from: "/nfts", to: "/nft" },
  { from: "/ai-assistant", to: "/ai" },
  { from: "/able-bots", to: "/bots" },
  { from: "/liberty-swap", to: "/swap" },
  { from: "/buy-and-burn", to: "/burn" },
  { from: "/pools", to: "/dex-analytics" },
  { from: "/stake/hero", to: "/stake/dai" },
  { from: "/whitepaper", to: "https://docs.vicfoundation.com" },
];

export const NAV_LINKS = [
  ["/", "Home"],
  ["/start", "Start Here"],
  ["/swap", "Swap"],
  ["/dashboard", "Dashboard"],
  ["/portfolio", "Portfolio"],
  ["/dca", "DCA"],
  ["/limits", "Limit Orders"],
  ["/approvals", "Approvals"],
  ["/bootcamp", "Boot Camp"],
  ["/stake", "Stake"],
  ["/tokenomics", "Tokenomics"],
  ["/nft", "NFTs"],
  ["/media", "Media"],
  ["/ai", "AI Assistant"],
  ["/ecosystem", "Ecosystem"],
  ["/directory", "Directory"],
  ["/community", "Community"],
  ["/dao", "DAO"],
  ["/bots", "ABLE Bots"],
  ["/explainer", "Explainer"],
  ["/burn", "Buy & Burn"],
];

export function canonicalFor(path) {
  if (path === "/") return `${ORIGIN}/`;
  return `${ORIGIN}${path}`;
}

export function navHtml() {
  const links = NAV_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join(" · ");
  return (
    `<footer id="hero-seo-nav" style="background:#0a0a0a;color:#fafafa;padding:16px 20px;font-family:Inter,system-ui,sans-serif;font-size:13px;line-height:1.7;border-top:1px solid rgba(255,140,0,0.25)">` +
    `<nav aria-label="Site"><p style="margin:0 0 8px 0;color:#ff8c00;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">HERO Dapp</p>${links}</nav>` +
    `<p style="margin:12px 0 0 0"><a href="https://vicfoundation.com/">VIC Foundation</a></p>` +
    `</footer>\n` +
    `<noscript><nav aria-label="Site">${NAV_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join(" · ")}</nav></noscript>\n`
  );
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyHead(shell, { path, title, description, robots }) {
  const canon = canonicalFor(path);
  let html = shell;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${description}" />`
  );
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${canon}" />`
  );
  if (robots) {
    html = html.replace(
      /<meta name="robots" content="[^"]*"\s*\/?>/i,
      `<meta name="robots" content="${robots}" />`
    );
  }
  html = html.replace(
    /<meta property="og:url" content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${canon}" />`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${title}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${description}" />`
  );
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${title}" />`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${description}" />`
  );
  const footer = navHtml();
  if (!html.includes('id="hero-seo-nav"')) {
    html = html.replace(/<\/body>/i, `    ${footer}  </body>`);
  }
  return html;
}

export function sitemapXml(routes, lastmod) {
  const items = routes
    .filter((r) => r.index && r.path !== "/login")
    .map((r) => {
      const loc = canonicalFor(r.path);
      return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

export function robotsTxt() {
  return `# herobase.io robots.txt
# HERO Dapp — Built for Veterans, by Veterans
# Single consistent rule set. GPTBot, ClaudeBot and Google-Extended are allowed
# (answer-engine visibility). Training crawlers remain disallowed.

User-agent: *
Allow: /
Disallow: /api/
Disallow: /login

User-agent: GPTBot
Allow: /
Disallow: /api/
Disallow: /login

User-agent: ClaudeBot
Allow: /
Disallow: /api/
Disallow: /login

User-agent: Google-Extended
Allow: /
Disallow: /api/
Disallow: /login

User-agent: PerplexityBot
Allow: /
Disallow: /api/
Disallow: /login

User-agent: OAI-SearchBot
Allow: /
Disallow: /api/
Disallow: /login

User-agent: ChatGPT-User
Allow: /
Disallow: /api/
Disallow: /login

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

Sitemap: https://herobase.io/sitemap.xml
`;
}

export function nginxSnippet() {
  const redirLines = REDIRECTS.flatMap(({ from, to }) => {
    const dest = to.startsWith("http") ? to : to;
    return [`    ${from} ${dest};`, `    ${from}/ ${dest};`];
  }).join("\n");

  const trimPaths = REAL_ROUTES.filter((r) => r.path !== "/")
    .map((r) => r.path.replace(/^\//, ""))
    .map(escapeRe)
    .join("|");

  return `# herobase.io SPA allowlist + redirects + real 404s.
# Include from both the :80 and :443 herobase.io server blocks.
# Map file (http context): conf.d/herobase-seo-map.conf is generated next to this
# snippet, or the map below can be copied into conf.d.
#
# Do not fall back to /index.html for unknown paths.

error_page 404 /404.html;

if ($hero_seo_redirect != "") {
    return 301 $hero_seo_redirect$is_args$args;
}

rewrite ^/(${trimPaths})/$ /$1 permanent;

location = /404.html {
    default_type text/html;
}

location = /404 {
    return 404;
}

location = /404/ {
    return 404;
}

# Dynamic DAO proposal pages share a generic prerendered shell.
location ~ ^/dao/proposals/[A-Za-z0-9_-]+/?$ {
    try_files $uri $uri/index.html /dao/proposals/detail/index.html =404;
}

# Known route prerenders live at <route>/index.html. Unknown paths 404.
# Static assets are served first when the file exists.
location / {
    try_files $uri $uri/index.html =404;
}
`;
}

export function nginxMap() {
  const lines = REDIRECTS.flatMap(({ from, to }) => [
    `    ${from} ${to};`,
    `    ${from}/ ${to};`,
  ]).join("\n");
  return `# http-context map for herobase.io SEO redirects.
# Install as /etc/nginx/conf.d/herobase-seo-map.conf
map $uri $hero_seo_redirect {
    default "";
${lines}
}
`;
}

export function notFoundHtml(shell) {
  return applyHead(shell, {
    path: "/404",
    title: "Page not found | HERO Dapp",
    description: "This page does not exist on herobase.io.",
    robots: "noindex, follow",
  }).replace(
    /<link rel="canonical" href="https:\/\/herobase\.io\/404"\s*\/?>/i,
    ""
  );
}

function parseArgs(argv) {
  const out = { shell: "", outDir: "", lastmod: new Date().toISOString().slice(0, 10) };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--shell") out.shell = argv[++i];
    else if (argv[i] === "--out") out.outDir = argv[++i];
    else if (argv[i] === "--lastmod") out.lastmod = argv[++i];
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.shell || !args.outDir) {
    console.error("usage: node prerender-seo-routes.mjs --shell <index.html> --out <dir> [--lastmod YYYY-MM-DD]");
    process.exit(2);
  }
  const shellPath = resolve(args.shell);
  const outDir = resolve(args.outDir);
  const shell = readFileSync(shellPath, "utf8");
  mkdirSync(outDir, { recursive: true });

  // Homepage shell (also used as /index.html)
  const home = REAL_ROUTES.find((r) => r.path === "/");
  writeFileSync(join(outDir, "index.html"), applyHead(shell, home));

  for (const route of REAL_ROUTES) {
    if (route.path === "/") continue;
    const dir = join(outDir, route.path.replace(/^\//, ""));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), applyHead(shell, route));
  }

  // Generic proposal detail shell (not in sitemap)
  const detailDir = join(outDir, "dao/proposals/detail");
  mkdirSync(detailDir, { recursive: true });
  writeFileSync(
    join(detailDir, "index.html"),
    applyHead(shell, {
      path: "/dao/proposals",
      title: "DAO Proposal | HERO Dapp",
      description: "A HERO DAO proposal.",
      robots: "noindex, follow",
    })
  );

  writeFileSync(join(outDir, "404.html"), notFoundHtml(shell));
  writeFileSync(join(outDir, "sitemap.xml"), sitemapXml(REAL_ROUTES, args.lastmod));
  writeFileSync(join(outDir, "robots.txt"), robotsTxt());

  const nginxDir = join(outDir, "nginx");
  mkdirSync(nginxDir, { recursive: true });
  writeFileSync(join(nginxDir, "herobase-spa-allowlist.conf"), nginxSnippet());
  writeFileSync(join(nginxDir, "herobase-seo-map.conf"), nginxMap());

  const indexable = REAL_ROUTES.filter((r) => r.index).length;
  console.log(`prerendered ${REAL_ROUTES.length} routes, ${indexable} sitemap entries, lastmod=${args.lastmod}, out=${outDir}`);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main();
