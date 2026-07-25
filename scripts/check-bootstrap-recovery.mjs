#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { closeSync, existsSync, openSync, readFileSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OUTPUT_ROOT = path.resolve(process.cwd(), 'dist/public');
const MANIFEST_PATH = path.join(OUTPUT_ROOT, '.vite/manifest.json');
const REPORT_PATH = path.resolve(process.cwd(), 'bootstrap-recovery-report.json');
const RECOVERY_HEADING_ID = 'dapp-recovery-title';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class ChromeStartupError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ChromeStartupError';
  }
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

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
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
  }[extension] ?? 'application/octet-stream';
}

function findManifestFile(manifest, predicate, label) {
  const entry = Object.entries(manifest).find(([key, value]) => predicate(key, value));
  if (!entry?.[1]?.file) throw new Error(`Unable to locate ${label} in Vite manifest`);
  return `/${entry[1].file}`;
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
      const timeout = setTimeout(() => reject(new Error('Timed out connecting to Chrome DevTools')), 15_000);
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
      for (const request of this.pending.values()) request.reject(new Error('Chrome DevTools closed'));
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
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
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

async function waitForFile(filePath, child) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (existsSync(filePath)) return;
    if (child.exitCode !== null) throw new Error(`Chrome exited with code ${child.exitCode}`);
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function launchChrome(chromeBin) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'vets-bootstrap-recovery-'));
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
      child,
      userDataDir,
      chromeLog,
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

async function startStaticServer() {
  let blockedPath = '';
  const requests = [];
  const indexHtml = readFileSync(path.join(OUTPUT_ROOT, 'index.html'));

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      requests.push(requestUrl.pathname);
      response.writeHead(400, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end('Malformed request path');
      return;
    }
    requests.push(pathname);

    if (blockedPath && pathname === blockedPath) {
      response.writeHead(404, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end('/* deliberately blocked by bootstrap recovery integration test */');
      return;
    }

    if (pathname.startsWith('/api/')) {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end('{"result":{"data":{"json":null}}}');
      return;
    }

    const candidate = path.resolve(OUTPUT_ROOT, `.${pathname}`);
    const safeCandidate = candidate.startsWith(`${OUTPUT_ROOT}${path.sep}`) || candidate === OUTPUT_ROOT;
    if (safeCandidate && existsSync(candidate) && statSync(candidate).isFile()) {
      response.writeHead(200, {
        'content-type': contentType(candidate),
        'cache-control': 'no-store',
      });
      response.end(readFileSync(candidate));
      return;
    }

    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(indexHtml);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Static server did not expose a TCP address');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    setBlockedPath(value) {
      blockedPath = value;
    },
    resetRequests() {
      requests.length = 0;
    },
    close() {
      return new Promise(resolve => server.close(resolve));
    },
  };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
  return result.result?.value;
}

async function waitForRecovery(client, scenario) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const state = await evaluate(client, `(() => ({
        title: document.title,
        heading: document.getElementById('${RECOVERY_HEADING_ID}')?.textContent?.trim() || '',
        focusedId: document.activeElement?.id || '',
        alert: document.querySelector('[role="alert"]')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
        body: document.body?.innerText?.replace(/\\s+/g, ' ').trim().slice(0, 500) || '',
      }))()`);
      if (state.heading) {
        if (state.focusedId !== RECOVERY_HEADING_ID) {
          throw new Error(`${scenario}: recovery heading rendered but focus remained on ${state.focusedId || 'no element'}`);
        }
        if (!state.alert.includes('confirm its status in your wallet')) {
          throw new Error(`${scenario}: wallet retry caution is missing`);
        }
        return state;
      }
    } catch (error) {
      if (String(error).includes('focus remained') || String(error).includes('wallet retry')) throw error;
    }
    await sleep(250);
  }
  const body = await evaluate(client, 'document.body?.innerText || ""').catch(() => 'unavailable');
  throw new Error(`${scenario}: shared recovery UI did not render; body=${String(body).slice(0, 300)}`);
}

async function runScenario({ client, server, name, blockedPath, expectedRequest }) {
  server.setBlockedPath(blockedPath);
  server.resetRequests();
  await client.send('Network.clearBrowserCache');
  await client.send('Page.navigate', { url: `${server.baseUrl}/dashboard?vets-recovery=${encodeURIComponent(name)}` });
  const state = await waitForRecovery(client, name);
  if (!server.requests.includes(expectedRequest)) {
    throw new Error(`${name}: blocked chunk was not requested: ${expectedRequest}`);
  }
  return {
    name,
    blockedPath,
    expectedRequest,
    heading: state.heading,
    focusedId: state.focusedId,
    alert: state.alert,
    requests: [...server.requests],
  };
}

async function main() {
  if (!existsSync(MANIFEST_PATH)) throw new Error(`Missing Vite manifest: ${MANIFEST_PATH}`);
  const chromeBin = process.env.CHROME_BIN;
  if (!chromeBin || !existsSync(chromeBin)) throw new Error('CHROME_BIN must point to an installed Chrome/Chromium executable');
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const dappChunk = findManifestFile(
    manifest,
    (key, value) => value?.name === 'DappBootstrap' || key.includes('DappBootstrap'),
    'DappBootstrap dynamic chunk',
  );
  const dashboardChunk = findManifestFile(
    manifest,
    (_key, value) => value?.src === 'src/pages/Dashboard.tsx',
    'Dashboard route chunk',
  );

  const server = await startStaticServer();
  let chrome = null;
  let client = null;
  const consoleMessages = [];

  try {
    chrome = await launchChromeWithRetry(chromeBin);
    client = new CdpClient(chrome.webSocketUrl);
    await client.connect();
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Network.enable'),
    ]);
    await client.send('Network.setCacheDisabled', { cacheDisabled: true });
    client.on('Runtime.consoleAPICalled', params => {
      consoleMessages.push((params.args ?? []).map(arg => arg.value ?? arg.description ?? '').join(' '));
    });

    const scenarios = [];
    scenarios.push(await runScenario({
      client,
      server,
      name: 'initial-bootstrap-rejection',
      blockedPath: dappChunk,
      expectedRequest: dappChunk,
    }));
    scenarios.push(await runScenario({
      client,
      server,
      name: 'route-chunk-rejection',
      blockedPath: dashboardChunk,
      expectedRequest: dashboardChunk,
    }));

    const report = {
      timestamp: new Date().toISOString(),
      dappChunk,
      dashboardChunk,
      scenarios,
      consoleMessages,
      result: 'PASS',
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Bootstrap recovery browser integration: PASS (${REPORT_PATH})`);
    for (const scenario of scenarios) {
      console.log(`${scenario.name}: ${scenario.heading}; focus=${scenario.focusedId}`);
    }
  } finally {
    client?.close();
    await chrome?.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(async error => {
    const report = {
      timestamp: new Date().toISOString(),
      result: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`).catch(() => {});
    console.error('[Bootstrap recovery browser integration failed]', error);
    process.exitCode = 1;
  });
}
