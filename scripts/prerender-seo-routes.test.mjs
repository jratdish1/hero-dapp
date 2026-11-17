import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  REAL_ROUTES,
  REDIRECTS,
  applyHead,
  canonicalFor,
  nginxSnippet,
  robotsTxt,
  sitemapXml,
} from "./prerender-seo-routes.mjs";

const script = fileURLToPath(new URL("./prerender-seo-routes.mjs", import.meta.url));

describe("prerender-seo-routes", () => {
  it("gives each route a unique self canonical", () => {
    const seen = new Set();
    const shell =
      '<title>X</title><meta name="description" content="d" /><link rel="canonical" href="https://herobase.io/" /><body></body>';
    for (const route of REAL_ROUTES) {
      const canon = canonicalFor(route.path);
      assert.equal(canon.startsWith("https://herobase.io"), true);
      assert.equal(seen.has(canon), false);
      seen.add(canon);
      const html = applyHead(shell, route);
      assert.match(html, new RegExp(`<title>${route.title.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}</title>`));
      assert.match(html, new RegExp(`rel="canonical" href="${canon}"`));
      assert.match(html, /id="hero-seo-nav"/);
      assert.match(html, /href="\/bootcamp"/);
    }
  });

  it("sitemap has lastmod, includes /bootcamp, and omits aliases and /login", () => {
    const xml = sitemapXml(REAL_ROUTES, "2026-11-16");
    assert.match(xml, /<lastmod>2026-11-16<\/lastmod>/);
    assert.match(xml, /<loc>https:\/\/herobase.io\/bootcamp<\/loc>/);
    assert.equal(xml.includes("<loc>https://herobase.io/farm</loc>"), false);
    assert.equal(xml.includes("<loc>https://herobase.io/swap</loc>"), false);
    assert.equal(xml.includes("<loc>https://herobase.io/nft</loc>"), false);
    assert.equal(xml.includes("<loc>https://herobase.io/login</loc>"), false);
    assert.equal((xml.match(/<url>/g) || []).length, REAL_ROUTES.filter((r) => r.index).length);
  });

  it("robots.txt allows GPTBot, ClaudeBot and Google-Extended without a conflicting Disallow: /", () => {
    const txt = robotsTxt();
    for (const bot of ["GPTBot", "ClaudeBot", "Google-Extended"]) {
      assert.match(txt, new RegExp(`User-agent: ${bot}\\nAllow: /`));
      const block = txt.split("User-agent: " + bot)[1].split("User-agent:")[0];
      assert.equal(block.includes("Disallow: /\n"), false);
    }
  });

  it("nginx snippet 404s unknown paths and 301s /farm", () => {
    const conf = nginxSnippet();
    assert.match(conf, /try_files \$uri \$uri\/index.html =404;/);
    assert.equal(conf.includes("try_files $uri $uri/ /index.html"), false);
    assert.match(conf, /error_page 404 \/404.html;/);
    const farm = REDIRECTS.find((r) => r.from === "/farm");
    assert.equal(farm.to, "/bootcamp");
  });

  it("CLI writes per-route HTML, sitemap, robots, 404 and nginx snippets", () => {
    const dir = mkdtempSync(join(tmpdir(), "hero-seo-"));
    const shell = join(dir, "shell.html");
    const out = join(dir, "out");
    writeFileSync(
      shell,
      '<!doctype html><html><head><title>HERO Dapp - PulseChain DEX Aggregator</title><meta name="description" content="d" /><link rel="canonical" href="https://herobase.io/" /><meta name="robots" content="index, follow" /></head><body><div id="root"></div></body></html>'
    );
    const r = spawnSync(process.execPath, [script, "--shell", shell, "--out", out, "--lastmod", "2026-11-16"], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    const dash = readFileSync(join(out, "dashboard/index.html"), "utf8");
    assert.match(dash, /<title>Dashboard \| HERO Dapp<\/title>/);
    assert.match(dash, /rel="canonical" href="https:\/\/herobase.io\/dashboard"/);
    assert.match(readFileSync(join(out, "sitemap.xml"), "utf8"), /<lastmod>2026-11-16<\/lastmod>/);
    assert.match(readFileSync(join(out, "robots.txt"), "utf8"), /User-agent: GPTBot\nAllow: \//);
    assert.match(readFileSync(join(out, "404.html"), "utf8"), /Page not found/);
    assert.match(readFileSync(join(dir, "nginx/herobase-spa-allowlist.conf"), "utf8"), /=404;/);
    assert.equal(existsSync(join(out, "nginx")), false, "nginx config must not land in the public docroot");
    assert.match(readFileSync(join(out, "dao/proposals/create/index.html"), "utf8"), /<meta name="robots" content="noindex, follow" \/>/);
    const bad = spawnSync(process.execPath, [script, "--shell", shell, "--out", out, "--nginx-out", join(out, "nginx")], { encoding: "utf8" });
    assert.equal(bad.status, 2);
  });

  it("every non-indexed route gets a noindex robots meta", () => {
    const shell = '<meta name="robots" content="index, follow" /><body></body>';
    for (const route of REAL_ROUTES.filter((r) => !r.index)) {
      assert.match(applyHead(shell, route), /content="noindex,/, route.path);
    }
  });
});
