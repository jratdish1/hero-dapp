#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { closeSync, existsSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'dist/public');
const REPORT = path.join(ROOT, 'swap-intent-e2e-report.json');

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
    if (
      candidate.startsWith(`${OUTPUT}${path.sep}`)
      && existsSync(candidate)
      && statSync(candidate).isFile()
    ) {
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
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Static server address missing');

    const chromeBin = process.env.CHROME_BIN;
    if (!chromeBin || !existsSync(chromeBin)) throw new Error('CHROME_BIN is required');
    chrome = await launchChrome(chromeBin);
    client = new Cdp(chrome.url);
    await client.connect();
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Network.enable'),
    ]);
    await client.send('Page.navigate', { url: `http://127.0.0.1:${address.port}/swap` });

    await waitFor(
      client,
      'swap intent input',
      `document.querySelector('input[aria-label="HERO swap intent"]') !== null`,
    );

    const beforeReview = await evaluate(client, `(() => ({
      confirm: !!document.querySelector('[data-testid="swap-intent-confirm"]'),
      handoff: !!document.querySelector('[data-testid="swap-intent-handoff"]'),
      review: !!document.querySelector('[data-testid="swap-intent-review"]'),
    }))()`);
    if (beforeReview.confirm || beforeReview.handoff || beforeReview.review) {
      throw new Error(`Intent controls appeared before review: ${JSON.stringify(beforeReview)}`);
    }

    await evaluate(client, `(() => {
      const input = document.querySelector('input[aria-label="HERO swap intent"]');
      if (!(input instanceof HTMLInputElement)) throw new Error('Intent input missing');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('Input value setter missing');
      setter.call(input, 'swap 0.01 ETH to HERO on BASE');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const review = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Review intent');
      if (!(review instanceof HTMLButtonElement)) throw new Error('Review intent button missing');
      review.click();
      return true;
    })()`);

    await waitFor(
      client,
      'review card',
      `document.querySelector('[data-testid="swap-intent-review"]') !== null`,
    );
    const reviewed = await evaluate(client, `(() => ({
      confirm: !!document.querySelector('[data-testid="swap-intent-confirm"]'),
      handoff: !!document.querySelector('[data-testid="swap-intent-handoff"]'),
      body: document.querySelector('[data-testid="swap-intent-review"]')?.textContent || '',
    }))()`);
    if (!reviewed.confirm || reviewed.handoff || !reviewed.body.includes('0.01 ETH')) {
      throw new Error(`Review did not fail closed before confirmation: ${JSON.stringify(reviewed)}`);
    }

    await evaluate(client, `(() => {
      const confirm = document.querySelector('[data-testid="swap-intent-confirm"]');
      if (!(confirm instanceof HTMLButtonElement)) throw new Error('Confirm button missing');
      confirm.click();
      return true;
    })()`);

    const confirmed = await waitFor(
      client,
      'confirmed DEX handoff',
      `(() => {
        const link = document.querySelector('[data-testid="swap-intent-handoff"]');
        return link instanceof HTMLAnchorElement ? { href: link.href, text: link.textContent || '' } : null;
      })()`,
    );
    if (!/^https:\/\//.test(confirmed.href)) {
      throw new Error(`Confirmed handoff is not an HTTPS link: ${JSON.stringify(confirmed)}`);
    }

    await evaluate(client, `(() => {
      const pulse = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === 'PulseChain');
      if (!(pulse instanceof HTMLButtonElement)) throw new Error('PulseChain toggle missing');
      pulse.click();
      return true;
    })()`);

    const invalidated = await waitFor(
      client,
      'chain-change invalidation',
      `(() => {
        const handoff = document.querySelector('[data-testid="swap-intent-handoff"]');
        const alert = document.querySelector('[role="alert"]')?.textContent || '';
        return !handoff && /Chain changed after review/i.test(alert) ? { alert } : null;
      })()`,
    );

    const result = {
      timestamp: new Date().toISOString(),
      result: 'PASS',
      path: '/swap',
      beforeReview,
      reviewed: { confirm: reviewed.confirm, handoff: reviewed.handoff },
      confirmed,
      invalidated,
    };
    writeFileSync(REPORT, `${JSON.stringify(result, null, 2)}\n`);
    console.log('HERO swap intent confirm browser gate: PASS');
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
