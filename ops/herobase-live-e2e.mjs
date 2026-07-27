#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.HEROBASE_URL || 'https://herobase.io';
const expectedSha = process.env.HEROBASE_EXPECTED_SHA;
const evidenceDir = process.env.HEROBASE_EVIDENCE_DIR || 'herobase-live-e2e';
if (!/^[0-9a-f]{40}$/.test(expectedSha || '')) {
  throw new Error('HEROBASE_EXPECTED_SHA must be an exact lowercase 40-character SHA');
}

const routes = [
  '/',
  '/swap',
  '/portfolio',
  '/dashboard',
  '/dca',
  '/limits',
  '/approvals',
  '/bootcamp',
  '/stake',
  '/community',
  '/dao',
];
const deferred = new Map([
  ['/stake', 'single-sided staking activation deferred by VETS GO'],
  ['/dao', 'binding DAO governance and snapshot voting deferred by VETS GO'],
]);

const chromeCandidates = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromePath) throw new Error('No supported Chrome/Chromium executable found');

await mkdir(evidenceDir, { recursive: true });
const userDataDir = path.join('/tmp', `vets-herobase-cdp-${process.pid}`);
const port = 9227;
const chrome = spawn(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-sync',
  '--metrics-recording-only',
  '--no-first-run',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let chromeStderr = '';
chrome.stderr.setEncoding('utf8');
chrome.stderr.on('data', (chunk) => { chromeStderr += chunk; });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${url}: HTTP ${response.status}`);
  return response.json();
}

for (let attempt = 1; attempt <= 60; attempt += 1) {
  try {
    await jsonFetch(`http://127.0.0.1:${port}/json/version`);
    break;
  } catch (error) {
    if (attempt === 60) throw new Error(`Chrome DevTools did not start: ${error.message}\n${chromeStderr}`);
    await sleep(250);
  }
}

class CdpSession {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket connect timeout')), 10000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', (event) => { clearTimeout(timer); reject(new Error(`CDP WebSocket error: ${event.message || 'unknown'}`)); }, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result || {});
        return;
      }
      const callbacks = this.listeners.get(message.method) || [];
      for (const callback of callbacks) callback(message.params || {});
    });
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) || [];
    callbacks.push(callback);
    this.listeners.set(method, callbacks);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        const waiter = this.pending.get(id);
        if (!waiter) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timeout: ${method}`));
      }, 20000);
    });
  }

  async close() {
    try { this.socket.close(); } catch {}
  }
}

async function waitForLoad(session, timeoutMs = 30000) {
  await new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, timeoutMs);
    session.on('Page.loadEventFired', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    });
  });
}

const results = [];
let fatal = false;

try {
  for (const route of routes) {
    const targetUrl = new URL(route, baseUrl).toString();
    const target = await jsonFetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' });
    const session = new CdpSession(target.webSocketDebuggerUrl);
    await session.connect();

    const exceptions = [];
    const consoleErrors = [];
    const sameOriginFailures = [];
    const externalFailures = [];
    const serverErrors = [];

    session.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      exceptions.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'unknown exception');
    });
    session.on('Log.entryAdded', ({ entry }) => {
      if (entry?.level === 'error') consoleErrors.push(entry.text || 'unknown console error');
    });
    session.on('Network.loadingFailed', (event) => {
      const record = `${event.errorText || 'loading failed'}:${event.type || 'unknown'}`;
      if ((event.canceled || '').toString() === 'true' || /ERR_ABORTED/i.test(record)) return;
      externalFailures.push(record);
    });
    session.on('Network.responseReceived', ({ response }) => {
      if (!response || response.status < 500) return;
      const url = new URL(response.url);
      const record = `${response.status} ${response.url}`;
      if (url.origin === new URL(baseUrl).origin) sameOriginFailures.push(record);
      else serverErrors.push(record);
    });

    await Promise.all([
      session.send('Page.enable'),
      session.send('Runtime.enable'),
      session.send('Log.enable'),
      session.send('Network.enable'),
    ]);

    const loadPromise = waitForLoad(session);
    await session.send('Page.navigate', { url: targetUrl });
    await loadPromise;
    await sleep(3000);

    const stateResult = await session.send('Runtime.evaluate', {
      expression: `(() => {
        const root = document.querySelector('#root');
        const bodyText = (document.body?.innerText || '').trim();
        const all = [...document.querySelectorAll('button,a[href]')];
        const controls = all.map((element) => ({
          tag: element.tagName.toLowerCase(),
          text: (element.innerText || element.getAttribute('aria-label') || '').trim().slice(0, 120),
          href: element instanceof HTMLAnchorElement ? element.href : null,
          disabled: Boolean(element.disabled),
        })).filter((item) => item.text || item.href).slice(0, 100);
        return {
          title: document.title,
          readyState: document.readyState,
          bodyLength: bodyText.length,
          bodySample: bodyText.slice(0, 500),
          rootChildren: root?.childElementCount ?? 0,
          controls,
          errorAlertText: [...document.querySelectorAll('[role="alert"]')]
            .map((node) => (node.innerText || '').trim())
            .filter(Boolean)
            .slice(0, 10),
        };
      })()`,
      returnByValue: true,
    });
    const pageState = stateResult.result?.value || {};

    const safeClickResult = await session.send('Runtime.evaluate', {
      expression: `(() => {
        const deny = /connect|wallet|swap|stake|approve|send|buy|sell|vote|delegate|execute|submit|delete|remove|claim|transfer|bridge|deposit|withdraw/i;
        const allow = /menu|close|faq|learn|details|next|previous|back|home|about|open navigation/i;
        const candidate = [...document.querySelectorAll('button')].find((button) => {
          const text = (button.innerText || button.getAttribute('aria-label') || '').trim();
          return text && allow.test(text) && !deny.test(text) && !button.disabled;
        });
        if (!candidate) return {clicked:false};
        const text = (candidate.innerText || candidate.getAttribute('aria-label') || '').trim().slice(0,120);
        candidate.click();
        return {clicked:true,text};
      })()`,
      returnByValue: true,
    });
    const safeClick = safeClickResult.result?.value || { clicked: false };
    if (safeClick.clicked) await sleep(500);

    const screenshot = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const screenshotName = route === '/' ? 'home.png' : `${route.slice(1).replaceAll('/', '-')}.png`;
    await writeFile(path.join(evidenceDir, screenshotName), Buffer.from(screenshot.data, 'base64'));

    const deferredReason = deferred.get(route) || null;
    const routePass = pageState.readyState === 'complete'
      && pageState.rootChildren > 0
      && pageState.bodyLength >= 20
      && exceptions.length === 0
      && sameOriginFailures.length === 0;
    if (!routePass) fatal = true;

    results.push({
      route,
      url: targetUrl,
      pass: routePass,
      deferred: deferredReason,
      pageState,
      safeClick,
      exceptions,
      consoleErrors,
      sameOriginFailures,
      externalFailures,
      serverErrors,
      screenshot: screenshotName,
    });

    await session.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  }

  const healthUrl = `${baseUrl}/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D`;
  const healthResponse = await fetch(healthUrl, { redirect: 'manual' });
  const healthText = await healthResponse.text();
  const healthPass = healthResponse.ok && healthText.includes('"ok":true') && healthText.includes(`"releaseSha":"${expectedSha}"`);
  if (!healthPass) fatal = true;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    expectedSha,
    health: {
      url: healthUrl,
      status: healthResponse.status,
      pass: healthPass,
      bodySample: healthText.slice(0, 1000),
    },
    approvedDeferredExceptions: {
      singleSidedStaking: 'deferred',
      bindingDaoGovernanceAndSnapshotVoting: 'deferred',
    },
    routes: results,
    pass: !fatal,
  };
  await writeFile(path.join(evidenceDir, 'browser-e2e.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ pass: report.pass, routeCount: results.length, healthPass }, null, 2));
  if (fatal) process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  await sleep(500);
  if (!chrome.killed) chrome.kill('SIGKILL');
}
