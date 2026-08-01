#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { build } from 'esbuild';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'dist/public');
const REPORT = path.join(ROOT, 'scroll-lock-csp-report.json');
const SHIM = path.join(
  ROOT,
  'client/src/lib/csp-safe-remove-scroll-bar.tsx',
);

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

function cspPolicy() {
  const config = readFileSync(
    path.join(ROOT, 'nginx/herobase-cache-headers.conf'),
    'utf8',
  );
  const policy = config.match(
    /add_header Content-Security-Policy "([^"]+)" always;/,
  )?.[1];
  if (!policy) throw new Error('Production CSP was not found');
  return policy;
}

function productionStylesheets() {
  const indexPath = path.join(OUTPUT, 'index.html');
  if (!existsSync(indexPath)) throw new Error('Production build is missing');
  const html = readFileSync(indexPath, 'utf8');
  const hrefs = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\brel=["'][^"']*stylesheet[^"']*["']/i.test(tag)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) hrefs.push(href);
  }
  if (!hrefs.includes('/security-recovery-20260731.css')) {
    throw new Error('Production HTML lacks the versioned recovery stylesheet');
  }
  return [...new Set(hrefs)];
}

function safeFile(root, pathname) {
  const candidate = path.resolve(root, `.${pathname}`);
  if (!candidate.startsWith(`${root}${path.sep}`)) return null;
  if (!existsSync(candidate)) return null;
  return candidate;
}

async function startServer(harnessRoot) {
  const policy = cspPolicy();
  const server = createServer((request, response) => {
    response.setHeader('content-security-policy', policy);
    response.setHeader('cache-control', 'no-store');

    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url ?? '/', 'http://127.0.0.1').pathname,
      );
    } catch {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Malformed request path');
      return;
    }

    const requested = pathname === '/' ? '/index.html' : pathname;
    const file = safeFile(harnessRoot, requested) ?? safeFile(OUTPUT, requested);
    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'content-type': contentType(file) });
    response.end(readFileSync(file));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Scroll-lock test server did not expose a TCP address');
  }

  return {
    url: `http://127.0.0.1:${address.port}/index.html`,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out connecting to Chrome DevTools')),
        15_000,
      );
      this.socket.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.socket.addEventListener('error', event => {
        clearTimeout(timeout);
        reject(new Error(event.message ?? 'Chrome DevTools error'));
      }, { once: true });
    });
    this.socket.addEventListener('message', event => void this.handle(event.data));
    this.socket.addEventListener('close', () => {
      for (const request of this.pending.values()) {
        request.reject(new Error('Chrome DevTools closed'));
      }
      this.pending.clear();
    });
  }

  async handle(data) {
    const message = JSON.parse(
      typeof data === 'string' ? data : await data.text(),
    );
    if (message.id) {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result ?? {});
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) {
      listener(message.params ?? {});
    }
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30_000);
      this.pending.set(id, {
        resolve(value) {
          clearTimeout(timeout);
          resolve(value);
        },
        reject(error) {
          clearTimeout(timeout);
          reject(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    this.socket?.close();
  }
}

async function waitForFile(file, child) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (existsSync(file)) return;
    if (child.exitCode !== null) {
      throw new Error(`Chrome exited with code ${child.exitCode}`);
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${file}`);
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
      if (!(await waitForExit(child, 5_000))) {
        throw new Error('Chrome did not exit after SIGKILL');
      }
    }
  }
  await rm(profile, { recursive: true, force: true });
  if (existsSync(profile)) {
    throw new Error(`Chrome profile cleanup failed: ${profile}`);
  }
}

async function launchChrome(bin) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'vets-scroll-lock-csp-'));
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
    '--window-size=1280,900',
    'about:blank',
  ], { stdio: ['ignore', fd, fd] });
  closeSync(fd);

  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    await waitForFile(portFile, child);
    const [port] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
    const response = await fetch(
      `http://127.0.0.1:${port}/json/new?about:blank`,
      { method: 'PUT' },
    );
    if (!response.ok) {
      throw new Error(`Unable to create Chrome target: ${response.status}`);
    }
    const target = await response.json();
    if (!target.webSocketDebuggerUrl) {
      throw new Error('Chrome target lacks a DevTools WebSocket URL');
    }
    return {
      url: target.webSocketDebuggerUrl,
      close: () => closeChrome(child, profile),
    };
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
    throw new Error(
      result.exceptionDetails.exception?.description
        ?? result.exceptionDetails.text
        ?? 'Browser evaluation failed',
    );
  }
  return result.result?.value;
}

async function state(client) {
  return evaluate(client, `(() => {
    const bodyStyle = getComputedStyle(document.body);
    return {
      ready: document.body?.dataset.ready || '',
      dialogOpen: Boolean(document.querySelector('[data-vets-dialog-content]')),
      lockCount: document.body?.getAttribute('data-scroll-locked') || '',
      gapMode: document.body?.getAttribute('data-vets-scroll-lock-gap-mode') || '',
      overflow: bodyStyle.overflow,
      removedGap: bodyStyle.getPropertyValue('--removed-body-scroll-bar-size').trim(),
      measuredGap: bodyStyle.getPropertyValue('--vets-scroll-lock-gap').trim(),
      violations: window.__vetsCspViolations || [],
      styleInsertions: window.__vetsStyleInsertions || [],
    };
  })()`);
}

async function waitFor(client, predicateName, predicate) {
  const deadline = Date.now() + 20_000;
  let last = null;
  while (Date.now() < deadline) {
    last = await state(client);
    if (predicate(last)) return last;
    await sleep(100);
  }
  throw new Error(`${predicateName} timed out: ${JSON.stringify(last)}`);
}

async function main() {
  const chromeBin = process.env.CHROME_BIN;
  if (!chromeBin || !existsSync(chromeBin)) {
    throw new Error('CHROME_BIN must point to an installed Chrome/Chromium executable');
  }
  if (!existsSync(SHIM)) throw new Error(`Scroll-lock shim is missing: ${SHIM}`);

  const workdir = await mkdtemp(path.join(os.tmpdir(), 'vets-scroll-lock-build-'));
  const entryPath = path.join(workdir, 'entry.tsx');
  const bundlePath = path.join(workdir, 'harness.js');
  const htmlPath = path.join(workdir, 'index.html');
  let server = null;
  let chrome = null;
  let client = null;

  try {
    await writeFile(entryPath, `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import * as Dialog from '@radix-ui/react-dialog';

      function Harness() {
        return (
          <Dialog.Root defaultOpen>
            <Dialog.Portal>
              <Dialog.Overlay data-vets-dialog-overlay />
              <Dialog.Content data-vets-dialog-content>
                <Dialog.Title>VETS CSP scroll lock</Dialog.Title>
                <Dialog.Description>Production-style Radix modal test.</Dialog.Description>
                <Dialog.Close data-vets-dialog-close>Close</Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }

      const root = document.getElementById('root');
      if (!root) throw new Error('Missing scroll-lock test root');
      createRoot(root).render(<Harness />);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.dataset.ready = 'true';
      }));
    `);

    await build({
      absWorkingDir: ROOT,
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      jsx: 'automatic',
      nodePaths: [path.join(ROOT, 'node_modules')],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      plugins: [{
        name: 'vets-csp-scroll-lock-alias',
        setup(buildApi) {
          buildApi.onResolve(
            { filter: /^react-remove-scroll-bar$/ },
            () => ({ path: SHIM }),
          );
        },
      }],
      tsconfig: path.join(ROOT, 'tsconfig.json'),
      logLevel: 'silent',
    });

    const bundle = await readFile(bundlePath, 'utf8');
    if (bundle.includes('react-style-singleton')) {
      throw new Error('Production harness still contains react-style-singleton');
    }
    if (!bundle.includes('data-vets-scroll-lock-gap-mode')) {
      throw new Error('Production harness did not bundle the CSP-safe scroll-lock shim');
    }

    const styleLinks = productionStylesheets()
      .map(href => `<link rel="stylesheet" href="${href}">`)
      .join('');
    await writeFile(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8"><title>VETS scroll-lock CSP test</title>${styleLinks}</head><body><div id="root"></div><script type="module" src="/harness.js"></script></body></html>`,
    );

    server = await startServer(workdir);
    chrome = await launchChrome(chromeBin);
    client = new CdpClient(chrome.url);
    await client.connect();

    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
    ]);
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      (() => {
        window.__vetsCspViolations = [];
        window.__vetsStyleInsertions = [];
        const originalAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(node) {
          if (node instanceof HTMLStyleElement) {
            window.__vetsStyleInsertions.push({
              method: 'appendChild',
              text: (node.textContent || '').slice(0, 2000),
            });
          }
          return originalAppendChild.call(this, node);
        };
        const originalInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function(node, reference) {
          if (node instanceof HTMLStyleElement) {
            window.__vetsStyleInsertions.push({
              method: 'insertBefore',
              text: (node.textContent || '').slice(0, 2000),
            });
          }
          return originalInsertBefore.call(this, node, reference);
        };
        document.addEventListener('securitypolicyviolation', event => {
          window.__vetsCspViolations.push({
            blockedURI: event.blockedURI,
            effectiveDirective: event.effectiveDirective,
            violatedDirective: event.violatedDirective,
          });
        });
      })();
    ` });

    await client.send('Page.navigate', { url: server.url });
    const opened = await waitFor(
      client,
      'Radix dialog open and body locked',
      value => value.ready === 'true'
        && value.dialogOpen
        && Number.parseInt(value.lockCount, 10) >= 1
        && value.overflow === 'hidden',
    );

    if (opened.violations.length > 0) {
      throw new Error(`CSP violations while dialog open: ${JSON.stringify(opened.violations)}`);
    }
    if (opened.styleInsertions.length > 0) {
      throw new Error(`Runtime style insertion while dialog open: ${JSON.stringify(opened.styleInsertions)}`);
    }
    if (opened.gapMode !== 'margin') {
      throw new Error(`Unexpected scroll-lock gap mode: ${opened.gapMode || 'missing'}`);
    }
    if (!/^\d+(?:\.\d+)?px$/.test(opened.measuredGap)) {
      throw new Error(`Measured scroll gap is missing: ${opened.measuredGap || 'none'}`);
    }

    await evaluate(client, `(() => {
      const close = document.querySelector('[data-vets-dialog-close]');
      if (!(close instanceof HTMLElement)) throw new Error('Dialog close control missing');
      close.click();
      return true;
    })()`);

    const closed = await waitFor(
      client,
      'Radix dialog close and body unlock',
      value => !value.dialogOpen && value.lockCount === '',
    );
    if (closed.violations.length > 0 || closed.styleInsertions.length > 0) {
      throw new Error(`CSP/style evidence changed after close: ${JSON.stringify(closed)}`);
    }

    const report = {
      timestamp: new Date().toISOString(),
      result: 'PASS',
      actualRadixDialog: true,
      cspSafeShimBundled: true,
      reactStyleSingletonBundled: false,
      openState: opened,
      closedState: closed,
      productionStylesheets: productionStylesheets(),
    };
    await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Radix scroll-lock CSP integration: PASS (${REPORT})`);
  } finally {
    client?.close();
    if (chrome) await chrome.close().catch(() => {});
    if (server) await server.close().catch(() => {});
    await rm(workdir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(async error => {
    const report = {
      timestamp: new Date().toISOString(),
      result: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    };
    await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`).catch(() => {});
    console.error(error);
    process.exitCode = 1;
  });
}
