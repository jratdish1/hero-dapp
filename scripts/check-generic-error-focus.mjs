#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const PROJECT_ROOT = process.cwd();
const REPORT_PATH = path.resolve(PROJECT_ROOT, 'generic-error-focus-report.json');
const EXPECTED_HEADING_ID = 'application-error-title';
const EXPECTED_HEADING = 'An unexpected application error occurred.';
const SENSITIVE_DETAIL = 'VETS mounted generic error focus test';
const SANITIZED_MARKER = '[React runtime error]';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ChromeStartupError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ChromeStartupError';
  }
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl);
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
        reject(new Error(`Chrome DevTools WebSocket error: ${event.message ?? 'unknown'}`));
      }, { once: true });
    });

    this.socket.addEventListener('message', event => void this.handleMessage(event.data));
    this.socket.addEventListener('close', () => {
      for (const request of this.pending.values()) {
        request.reject(new Error('Chrome DevTools closed'));
      }
      this.pending.clear();
    });
  }

  async handleMessage(data) {
    const raw = typeof data === 'string' ? data : await data.text();
    const message = JSON.parse(raw);
    if (message.id) {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result ?? {});
      return;
    }
    if (message.method) {
      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params ?? {});
      }
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out executing CDP method ${method}`));
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
    return () => listeners.delete(listener);
  }

  close() {
    this.socket?.close();
  }
}

function contentType(filePath) {
  return path.extname(filePath) === '.js'
    ? 'text/javascript; charset=utf-8'
    : 'text/html; charset=utf-8';
}

async function startStaticServer(root) {
  const server = createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Malformed request path');
      return;
    }

    const requested = pathname === '/' ? '/index.html' : pathname;
    const candidate = path.resolve(root, `.${requested}`);
    if (!candidate.startsWith(`${root}${path.sep}`) || !existsSync(candidate)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': contentType(candidate),
      'cache-control': 'no-store',
    });
    response.end(readFileSync(candidate));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Generic focus server did not expose a TCP address');
  }

  return {
    url: `http://127.0.0.1:${address.port}/index.html`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

async function waitForFile(filePath, child) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (existsSync(filePath)) return;
    if (child.exitCode !== null) {
      throw new Error(`Chrome exited with code ${child.exitCode}`);
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function stopChromeProcess(child, userDataDir) {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      sleep(5_000),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  if (userDataDir) await rm(userDataDir, { recursive: true, force: true });
}

async function launchChrome(chromeBin) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'vets-generic-error-focus-'));
  const chromeLog = path.join(userDataDir, 'chrome.log');
  const logFd = openSync(chromeLog, 'a');
  const child = spawn(chromeBin, [
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
    `--user-data-dir=${userDataDir}`,
    '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1',
    '--window-size=1280,900',
    'about:blank',
  ], { stdio: ['ignore', logFd, logFd] });
  closeSync(logFd);

  try {
    const portFile = path.join(userDataDir, 'DevToolsActivePort');
    await waitForFile(portFile, child);
    const [portText] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
    const port = Number.parseInt(portText, 10);
    if (!Number.isInteger(port)) {
      throw new Error(`Invalid Chrome debugging port: ${portText}`);
    }

    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
      method: 'PUT',
    });
    if (!targetResponse.ok) {
      throw new Error(`Unable to create Chrome target: ${targetResponse.status}`);
    }
    const target = await targetResponse.json();
    if (!target.webSocketDebuggerUrl) {
      throw new Error('Chrome target lacks a DevTools WebSocket URL');
    }

    return {
      webSocketUrl: target.webSocketDebuggerUrl,
      close: () => stopChromeProcess(child, userDataDir),
    };
  } catch (error) {
    const logTail = await readFile(chromeLog, 'utf8')
      .then(value => value.slice(-2_000))
      .catch(() => 'Chrome log unavailable');
    await stopChromeProcess(child, userDataDir).catch(() => {});
    throw new ChromeStartupError(
      `Chrome startup failed: ${error instanceof Error ? error.message : String(error)}; log=${logTail}`,
      { cause: error },
    );
  }
}

async function launchChromeWithRetry(chromeBin, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await launchChrome(chromeBin);
    } catch (error) {
      if (!(error instanceof ChromeStartupError)) throw error;
      lastError = error;
      console.error(`Chrome startup attempt ${attempt}/${attempts} failed: ${error.message}`);
      if (attempt < attempts) await sleep(attempt * 1_000);
    }
  }
  throw lastError ?? new ChromeStartupError('Chrome failed to start');
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
  }
  return result.result?.value;
}

async function waitForHarness(client) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const state = await evaluate(client, `(() => ({
        ready: document.body?.dataset.ready || '',
        focusedId: document.activeElement?.id || '',
        heading: document.body?.dataset.heading || '',
        focusClass: document.body?.dataset.focusClass || '',
      }))()`);
      if (state.ready === 'true') return state;
    } catch {
      // Navigation can briefly invalidate the execution context.
    }
    await sleep(100);
  }
  throw new Error('Generic focus harness did not report ready');
}

async function main() {
  const chromeBin = process.env.CHROME_BIN;
  if (!chromeBin || !existsSync(chromeBin)) {
    throw new Error('CHROME_BIN must point to an installed Chrome/Chromium executable');
  }

  const workdir = await mkdtemp(path.join(os.tmpdir(), 'vets-generic-error-focus-build-'));
  const entryPath = path.join(workdir, 'entry.tsx');
  const bundlePath = path.join(workdir, 'harness.js');
  const htmlPath = path.join(workdir, 'index.html');
  const errorBoundaryPath = path.resolve(PROJECT_ROOT, 'client/src/components/ErrorBoundary.tsx');
  const dappBoundaryPath = path.resolve(PROJECT_ROOT, 'client/src/components/DappLoadBoundary.tsx');
  let server = null;
  let chrome = null;
  let client = null;

  try {
    const entry = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import ErrorBoundary from ${JSON.stringify(errorBoundaryPath)};
      import { createRootErrorHandlers } from ${JSON.stringify(dappBoundaryPath)};

      function ThrowOnInitialRender() {
        throw new Error(${JSON.stringify(SENSITIVE_DETAIL)});
      }

      const root = document.getElementById('root');
      if (!root) throw new Error('Missing generic focus test root');
      createRoot(root, createRootErrorHandlers(false)).render(
        <ErrorBoundary><ThrowOnInitialRender /></ErrorBoundary>,
      );

      setTimeout(() => {
        const heading = document.getElementById(${JSON.stringify(EXPECTED_HEADING_ID)});
        document.body.dataset.ready = 'true';
        document.body.dataset.focusedId = document.activeElement?.id || '';
        document.body.dataset.heading = heading?.textContent?.trim() || '';
        document.body.dataset.focusClass = heading?.className || '';
      }, 100);
    `;

    await writeFile(entryPath, entry);
    await build({
      absWorkingDir: PROJECT_ROOT,
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      jsx: 'automatic',
      nodePaths: [path.resolve(PROJECT_ROOT, 'node_modules')],
      define: {
        'import.meta.env.DEV': 'false',
      },
      tsconfig: path.resolve(PROJECT_ROOT, 'tsconfig.json'),
      logLevel: 'silent',
    });
    await writeFile(
      htmlPath,
      '<!doctype html><html><head><meta charset="utf-8"><title>VETS generic focus test</title></head><body><div id="root"></div><script type="module" src="/harness.js"></script></body></html>',
    );

    server = await startStaticServer(workdir);
    chrome = await launchChromeWithRetry(chromeBin);
    client = new CdpClient(chrome.webSocketUrl);
    await client.connect();

    const consoleMessages = [];
    const exceptionMessages = [];
    client.on('Runtime.consoleAPICalled', params => {
      consoleMessages.push(
        (params.args ?? []).map(arg => arg.value ?? arg.description ?? '').join(' '),
      );
    });
    client.on('Runtime.exceptionThrown', params => {
      const details = params.exceptionDetails ?? {};
      exceptionMessages.push([
        details.text,
        details.exception?.description,
        details.exception?.value,
      ].filter(Boolean).join(' '));
    });

    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
    ]);
    await client.send('Page.navigate', { url: server.url });
    const state = await waitForHarness(client);

    if (state.focusedId !== EXPECTED_HEADING_ID) {
      throw new Error(`Generic error heading was not focused: ${state.focusedId || 'none'}`);
    }
    if (state.heading !== EXPECTED_HEADING) {
      throw new Error(`Unexpected generic error heading: ${state.heading || 'missing'}`);
    }
    if (!state.focusClass.includes('focus:outline') || state.focusClass.includes('focus:outline-none')) {
      throw new Error(`Generic error heading lacks a visible focus indicator: ${state.focusClass}`);
    }

    const sanitizedMarkerObserved = consoleMessages.some(message =>
      message.includes(SANITIZED_MARKER),
    );
    const sensitiveDetailAbsent = ![...consoleMessages, ...exceptionMessages].some(message =>
      message.includes(SENSITIVE_DETAIL),
    );
    if (!sanitizedMarkerObserved) {
      throw new Error(`Sanitized renderer console marker was not observed: ${JSON.stringify(consoleMessages)}`);
    }
    if (!sensitiveDetailAbsent) {
      throw new Error('Sensitive generic error detail leaked through renderer diagnostics');
    }

    const report = {
      timestamp: new Date().toISOString(),
      result: 'PASS',
      focusedId: state.focusedId,
      heading: state.heading,
      focusClass: state.focusClass,
      consoleMessages,
      exceptionMessages,
      sanitizedMarkerObserved,
      sensitiveDetailAbsent,
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Mounted generic error focus: PASS (${REPORT_PATH})`);
  } finally {
    client?.close();
    await chrome?.close().catch(() => {});
    await server?.close().catch(() => {});
    await rm(workdir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(async error => {
    const report = {
      timestamp: new Date().toISOString(),
      result: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
      errorKind: error instanceof ChromeStartupError ? 'chrome-startup' : 'assertion-or-runtime',
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`).catch(() => {});
    console.error('[Mounted generic error focus failed]', error);
    process.exitCode = 1;
  });
}
