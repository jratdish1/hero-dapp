#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { closeSync, existsSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'dist/public');
const REPORT = path.join(ROOT, 'incident-maintenance-e2e-report.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function contentType(file) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  })[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP connection timeout')), 15_000);
      this.socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener('error', event => {
        clearTimeout(timer);
        reject(new Error(event.message ?? 'CDP error'));
      }, { once: true });
    });
    this.socket.addEventListener('message', event => void this.handle(event.data));
  }

  async handle(data) {
    const message = JSON.parse(typeof data === 'string' ? data : await data.text());
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result ?? {});
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30_000);
      this.pending.set(id, {
        resolve(value) {
          clearTimeout(timer);
          resolve(value);
        },
        reject(error) {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return true;
  return Promise.race([
    new Promise(resolve => child.once('exit', () => resolve(true))),
    sleep(timeoutMs).then(() => false),
  ]);
}

async function closeChrome(child, profile) {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    if (!(await waitForExit(child, 5_000))) {
      child.kill('SIGKILL');
      await waitForExit(child, 5_000);
    }
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
}

async function launchChrome(bin) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'vets-swap-intent-'));
  const log = path.join(profile, 'chrome.log');
  const fd = openSync(log, 'a');
  const child = spawn(bin, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1',
    '--window-size=1280,1200',
    'about:blank',
  ], { stdio: ['ignore', fd, fd] });
  closeSync(fd);

  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 200 && !existsSync(portFile); i += 1) {
      if (child.exitCode !== null) throw new Error(`Chrome exited ${child.exitCode}`);
      await sleep(100);
    }
    if (!existsSync(portFile)) throw new Error('Chrome debugging port did not appear');
    const [port] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
    const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
    if (!response.ok) throw new Error(`Unable to create Chrome target: ${response.status}`);
    const target = await response.json();
    if (!target.webSocketDebuggerUrl) throw new Error('Chrome target lacks a WebSocket URL');
    return { url: target.webSocketDebuggerUrl, close: () => closeChrome(child, profile) };
  } catch (error) {
    await closeChrome(child, profile).catch(() => {});
    throw error;
  }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'Browser evaluation failed');
  }
  return result.result?.value;
}

async function waitFor(client, label, expression, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await evaluate(client, expression).catch(() => undefined);
    if (lastValue) return lastValue;
    await sleep(200);
  }
  throw new Error(`${label} timed out; lastValue=${JSON.stringify(lastValue)}`);
}

// HERO incident 2026-10-07: with HERO_INCIDENT_MAINTENANCE on (the default),
// every wallet-write route (including /swap) must render the maintenance page,
// the banner must be present (as role="status", never role="alert"), and no
// enabled write control may be exposed. / keeps rendering with the banner.
// /approvals is the single live write surface: revoke must stay enabled and no
// enabled non-revoke approval control (new / non-zero approve) may exist. The
// approve(spender, 0)-only rule itself is unit-tested in incident-flags.test.ts.
const PAUSED_ROUTES = [
  '/swap',
  '/stake', '/stake/base', '/stake/dai',
  '/spin',
  '/dao', '/dao/proposals', '/dao/proposals/create', '/dao/proposals/1', '/dao/treasury', '/dao/delegates', '/dao-proposals',
  '/nft-mint',
  '/wallet', '/dca', '/limits', '/bootcamp', '/bots', '/burn', '/giveaways', '/holder-rewards',
];
const BANNER_ONLY_ROUTES = ['/'];
const REVOKE_ONLY_ROUTE = '/approvals';
const WRITE_CONTROL = /\b(stake|unstake|claim|mint|spin|vote|approve|revoke|send|bridge|withdraw|deposit|create proposal|submit|enter raffle|buy|burn|swap)\b/i;
const REVOKE_CONTROL = /^\s*revoke\s*$/i;

// IR P2 (LHWU / LInQ): Page.navigate can return before the new document replaces
// the previous one (or return errorText without rejecting), and the maintenance
// markers are identical on every paused route. Mark the outgoing document, reject
// navigation errors, and only inspect once a NEW document is on the requested
// pathname and (for paused routes) the maintenance element carries data-route
// equal to that route.
const STALE_DOC_FLAG = '__heroIncidentGatePreviousDocument';

async function navigateFresh(client, origin, route) {
  await evaluate(client, `window.${STALE_DOC_FLAG} = true`).catch(() => {});
  const nav = await client.send('Page.navigate', { url: `${origin}${route}` });
  if (nav.errorText) throw new Error(`${route}: navigation failed: ${nav.errorText}`);
  await waitFor(
    client,
    `${route} fresh document`,
    `window.${STALE_DOC_FLAG} !== true && location.pathname === ${JSON.stringify(route)} && document.readyState !== 'loading'`,
  );
}

function freshRoutePredicate(route, expectPaused) {
  const here = `window.${STALE_DOC_FLAG} !== true && location.pathname === ${JSON.stringify(route)}`;
  const banner = `document.querySelector('[data-testid="hero-incident-banner"]') !== null`;
  return expectPaused
    ? `${here} && document.querySelector('[data-testid="hero-incident-route-paused"][data-route=${JSON.stringify(JSON.stringify(route)).slice(1, -1)}]') !== null && ${banner}`
    : `${here} && ${banner}`;
}

async function main() {
  const indexPath = path.join(OUTPUT, 'index.html');
  if (!existsSync(indexPath)) throw new Error('Production build is missing');
  const index = readFileSync(indexPath);

  const server = createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Malformed request path');
      return;
    }
    response.setHeader('cache-control', 'no-store');
    if (pathname.startsWith('/api/')) {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end('{"result":{"data":{"json":null}}}');
      return;
    }
    const candidate = path.resolve(OUTPUT, `.${pathname}`);
    if (candidate.startsWith(`${OUTPUT}${path.sep}`) && existsSync(candidate) && statSync(candidate).isFile()) {
      response.writeHead(200, { 'content-type': contentType(candidate) });
      response.end(readFileSync(candidate));
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(index);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  let chrome;
  let client;
  const results = [];
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Static server address missing');
    const chromeBin = process.env.CHROME_BIN;
    if (!chromeBin || !existsSync(chromeBin)) throw new Error('CHROME_BIN is required');
    chrome = await launchChrome(chromeBin);
    client = new Cdp(chrome.url);
    await client.connect();
    await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);

    const inspect = `(() => {
      const banner = document.querySelector('[data-testid="hero-incident-banner"]');
      const paused = document.querySelector('[data-testid="hero-incident-route-paused"]');
      const writeControls = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
        .filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true')
        .map(el => (el.textContent || el.value || '').trim())
        .filter(text => ${WRITE_CONTROL}.test(text));
      return {
        pathname: location.pathname,
        pausedRoute: paused?.getAttribute('data-route') ?? null,
        banner: !!banner,
        bannerRole: banner?.getAttribute('role') ?? null,
        paused: !!paused,
        alertBanners: Array.from(document.querySelectorAll('[role="alert"][data-testid="hero-incident-banner"]')).length,
        writeControls,
      };
    })()`;

    for (const route of [...PAUSED_ROUTES, ...BANNER_ONLY_ROUTES]) {
      const expectPaused = PAUSED_ROUTES.includes(route);
      await navigateFresh(client, `http://127.0.0.1:${address.port}`, route);
      await waitFor(client, `${route} maintenance render`, freshRoutePredicate(route, expectPaused));
      const state = await evaluate(client, inspect);
      results.push({ route, ...state });
      if (state.pathname !== route || (expectPaused && state.pausedRoute !== route)) {
        throw new Error(`${route}: inspected a different route's render: ${JSON.stringify(state)}`);
      }
      if (!state.banner || state.bannerRole !== 'status' || state.alertBanners !== 0) {
        throw new Error(`${route}: banner missing or wrong role: ${JSON.stringify(state)}`);
      }
      if (expectPaused && !state.paused) throw new Error(`${route}: maintenance page not rendered: ${JSON.stringify(state)}`);
      if (expectPaused && state.writeControls.length > 0) {
        throw new Error(`${route}: enabled write control exposed: ${JSON.stringify(state.writeControls)}`);
      }
    }

    // Revoke-only surface.
    const approvalsState = `(() => {
      const controls = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
        .filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true')
        .map(el => (el.textContent || el.value || '').trim());
      const note = document.querySelector('[data-testid="hero-incident-revoke-note"]');
      const banner = document.querySelector('[data-testid="hero-incident-banner"]');
      return {
        banner: !!banner,
        bannerRole: banner?.getAttribute('role') ?? null,
        paused: !!document.querySelector('[data-testid="hero-incident-route-paused"]'),
        note: !!note,
        revokeLink: !!note?.querySelector('a[href="https://revoke.cash"]'),
        revokeControls: controls.filter(text => ${REVOKE_CONTROL}.test(text)).length,
        nonRevokeWriteControls: controls.filter(text => ${WRITE_CONTROL}.test(text) && !${REVOKE_CONTROL}.test(text)),
        approveControls: controls.filter(text => /\\bapprove\\b/i.test(text)),
      };
    })()`;
    await navigateFresh(client, `http://127.0.0.1:${address.port}`, REVOKE_ONLY_ROUTE);
    await waitFor(client, `${REVOKE_ONLY_ROUTE} revoke note`, `window.${STALE_DOC_FLAG} !== true && location.pathname === ${JSON.stringify(REVOKE_ONLY_ROUTE)} && document.querySelector('[data-testid="hero-incident-revoke-note"]') !== null && document.querySelector('[data-testid="hero-incident-banner"]') !== null`);
    const approvalsBefore = await evaluate(client, approvalsState);
    if (approvalsBefore.paused) throw new Error(`${REVOKE_ONLY_ROUTE}: must not render the maintenance page (revoke stays enabled)`);
    if (!approvalsBefore.revokeLink || approvalsBefore.bannerRole !== 'status') {
      throw new Error(`${REVOKE_ONLY_ROUTE}: revoke note/link or banner role wrong: ${JSON.stringify(approvalsBefore)}`);
    }
    await waitFor(client, `${REVOKE_ONLY_ROUTE} revoke controls`, `Array.from(document.querySelectorAll('button')).some(el => /^\\s*revoke\\s*$/i.test(el.textContent || '') && !el.disabled)`);
    const approvalsAfter = await evaluate(client, approvalsState);
    if (approvalsAfter.revokeControls < 1) throw new Error(`${REVOKE_ONLY_ROUTE}: revoke path not enabled: ${JSON.stringify(approvalsAfter)}`);
    if (approvalsAfter.approveControls.length > 0 || approvalsAfter.nonRevokeWriteControls.length > 0) {
      throw new Error(`${REVOKE_ONLY_ROUTE}: non-revoke approval/write control exposed: ${JSON.stringify(approvalsAfter)}`);
    }
    const revokeClick = await evaluate(client, `(() => {
      const revoke = Array.from(document.querySelectorAll('button')).find(el => /^\\s*revoke\\s*$/i.test(el.textContent || ''));
      try { revoke.click(); return { ok: true }; } catch (error) { return { ok: false, error: String(error) }; }
    })()`);
    if (!revokeClick.ok) throw new Error(`${REVOKE_ONLY_ROUTE}: revoke click threw: ${revokeClick.error}`);
    if (!approvalsAfter.note || !approvalsAfter.revokeLink) throw new Error(`${REVOKE_ONLY_ROUTE}: revoke note missing after scan`);
    results.push({ route: REVOKE_ONLY_ROUTE, before: approvalsBefore, after: approvalsAfter, revokeClick });

    writeFileSync(REPORT, `${JSON.stringify({ timestamp: new Date().toISOString(), result: 'PASS', results }, null, 2)}\n`);
    console.log(`HERO incident maintenance browser gate: PASS (${results.length} routes)`);
  } finally {
    if (client) client.close();
    if (chrome) await chrome.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  writeFileSync(REPORT, `${JSON.stringify({
    timestamp: new Date().toISOString(),
    result: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
