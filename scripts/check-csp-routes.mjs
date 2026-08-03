#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { closeSync, existsSync, openSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'dist/public');
const REPORT = path.join(ROOT, 'csp-browser-report.json');
const ROUTES = [
  { requestedPath: '/', expectedPath: '/', marker: 'Swap Aggregator', requiresDapp: false },
  { requestedPath: '/wallet', expectedPath: '/portfolio', marker: 'Portfolio Tracker', requiresDapp: true },
  { requestedPath: '/stake', expectedPath: '/stake', marker: 'HERO Stake', requiresDapp: true },
  { requestedPath: '/dao', expectedPath: '/dao', marker: 'HERO DAO Governance', requiresDapp: true },
  { requestedPath: '/dao/proposals', expectedPath: '/dao/proposals', marker: 'Proposals', requiresDapp: true },
];

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
  const config = readFileSync(path.join(ROOT, 'nginx/herobase-cache-headers.conf'), 'utf8');
  const policies = Array.from(
    config.matchAll(/add_header Content-Security-Policy "([^"]+)" always;/g),
    match => match[1],
  );
  if (policies.length === 0) throw new Error('Production CSP was not found');
  if (new Set(policies).size !== 1) {
    throw new Error('Effective Nginx CSP policies are not identical');
  }
  return policies[0];
}

class Cdp {
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
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) {
      listener(message.params ?? {});
    }
  }

  send(method, params = {}) {
    const id = this.id++;
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

  on(method, listener) {
    const values = this.listeners.get(method) ?? new Set();
    values.add(listener);
    this.listeners.set(method, values);
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
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 12,
    retryDelay: 250,
  });
  if (existsSync(profile)) throw new Error(`Chrome profile cleanup failed: ${profile}`);
}

async function launch(bin) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'vets-csp-browser-'));
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
    const detail = result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.text
      ?? 'Browser evaluation failed';
    throw new Error(detail);
  }
  return result.result?.value;
}

async function readRouteState(client) {
  return evaluate(client, `(() => {
    const body = document.body?.innerText?.trim() || '';
    const resources = performance.getEntriesByType('resource')
      .map(entry => {
        try { return new URL(entry.name).pathname; }
        catch { return String(entry.name); }
      });
    return {
      body,
      currentPath: window.location.pathname,
      headings: Array.from(document.querySelectorAll('h1'), node => node.textContent?.trim() || ''),
      resources,
      dappLoaded: resources.some(resource => resource.startsWith('/assets/DappBootstrap-') && resource.endsWith('.js')),
      loading: body.includes('Loading secure DApp...') || body === 'Loading...',
      recoveryHeading: document.getElementById('dapp-recovery-title')?.textContent?.trim() || '',
      errorHeading: document.getElementById('application-error-title')?.textContent?.trim() || '',
      violations: window.__vetsCspViolations || [],
      styleInsertions: window.__vetsStyleInsertions || [],
    };
  })()`);
}

async function waitForRoute(client, route) {
  const deadline = Date.now() + 30_000;
  let state = null;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      state = await readRouteState(client);
      const markerPresent = state.body.includes(route.marker);
      const pathMatches = state.currentPath === route.expectedPath;
      const runtimeMatches = route.requiresDapp ? state.dappLoaded : !state.dappLoaded;
      if (
        markerPresent
        && pathMatches
        && runtimeMatches
        && !state.loading
        && !state.recoveryHeading
        && !state.errorHeading
      ) {
        await sleep(750);
        return readRouteState(client);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(250);
  }
  throw new Error(
    `${route.requestedPath}: route runtime did not settle: state=${JSON.stringify(state)}; lastError=${lastError || 'none'}`,
  );
}

async function main() {
  const indexPath = path.join(OUTPUT, 'index.html');
  if (!existsSync(indexPath)) throw new Error('Production build is missing');
  const policy = cspPolicy();
  const index = readFileSync(indexPath);

  const server = createServer((request, response) => {
    response.setHeader('content-security-policy', policy);
    response.setHeader('cache-control', 'no-store');

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Malformed request path');
      return;
    }

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
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('CSP server address missing');

  const chromeBin = process.env.CHROME_BIN;
  if (!chromeBin || !existsSync(chromeBin)) throw new Error('CHROME_BIN is required');
  const chrome = await launch(chromeBin);
  const client = new Cdp(chrome.url);
  await client.connect();

  const consoleErrors = [];
  client.on('Runtime.consoleAPICalled', params => {
    const text = (params.args ?? []).map(arg => arg.value ?? arg.description ?? '').join(' ');
    if (/content security policy|refused to/i.test(text)) consoleErrors.push(text);
  });

  await Promise.all([
    client.send('Page.enable'),
    client.send('Runtime.enable'),
    client.send('Network.enable'),
  ]);
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    (() => {
      window.__vetsCspViolations = [];
      window.__vetsStyleInsertions = [];
      const creationStacks = new WeakMap();
      const originalCreateElement = Document.prototype.createElement;
      Document.prototype.createElement = function(tagName, options) {
        const node = originalCreateElement.call(this, tagName, options);
        if (String(tagName).toLowerCase() === 'style') {
          creationStacks.set(node, new Error('style element created').stack || '');
        }
        return node;
      };
      const captureStyle = (node, method) => {
        if (!(node instanceof HTMLStyleElement)) return;
        window.__vetsStyleInsertions.push({
          method,
          id: node.id || '',
          className: node.className || '',
          attributes: Array.from(node.attributes || [], attribute => [attribute.name, attribute.value]),
          text: (node.textContent || '').slice(0, 4000),
          outerHTML: (node.outerHTML || '').slice(0, 5000),
          creationStack: (creationStacks.get(node) || '').slice(0, 5000),
          insertionStack: (new Error('style element inserted').stack || '').slice(0, 5000),
        });
      };
      const originalAppendChild = Node.prototype.appendChild;
      Node.prototype.appendChild = function(node) {
        captureStyle(node, 'appendChild');
        return originalAppendChild.call(this, node);
      };
      const originalInsertBefore = Node.prototype.insertBefore;
      Node.prototype.insertBefore = function(node, reference) {
        captureStyle(node, 'insertBefore');
        return originalInsertBefore.call(this, node, reference);
      };
      const originalAppend = Element.prototype.append;
      Element.prototype.append = function(...nodes) {
        for (const node of nodes) captureStyle(node, 'append');
        return originalAppend.apply(this, nodes);
      };
      document.addEventListener('securitypolicyviolation', event => {
        window.__vetsCspViolations.push({
          blockedURI: event.blockedURI,
          effectiveDirective: event.effectiveDirective,
          violatedDirective: event.violatedDirective,
          sourceFile: event.sourceFile,
          lineNumber: event.lineNumber,
        });
      });
    })();
  ` });

  const results = [];
  try {
    for (const route of ROUTES) {
      await client.send('Page.navigate', {
        url: `http://127.0.0.1:${address.port}${route.requestedPath}`,
      });
      const state = await waitForRoute(client, route);
      if (state.violations.length > 0) {
        throw new Error(
          `${route.requestedPath}: CSP violations: ${JSON.stringify(state.violations)}`,
        );
      }
      if (state.styleInsertions.length > 0) {
        throw new Error(
          `${route.requestedPath}: runtime style insertion observed: ${JSON.stringify(state.styleInsertions)}`,
        );
      }
      results.push({
        requestedPath: route.requestedPath,
        currentPath: state.currentPath,
        expectedPath: route.expectedPath,
        marker: route.marker,
        headings: state.headings,
        dappLoaded: state.dappLoaded,
        body: state.body.slice(0, 240),
        resourceCount: state.resources.length,
        violations: state.violations,
        styleInsertions: state.styleInsertions,
      });
    }
    if (consoleErrors.length > 0) {
      throw new Error(`CSP console errors: ${JSON.stringify(consoleErrors)}`);
    }
    writeFileSync(
      REPORT,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        result: 'PASS',
        policy,
        routes: results,
        consoleErrors,
      }, null, 2)}\n`,
    );
    console.log(
      `Production CSP route matrix: PASS (${ROUTES.map(route => route.requestedPath).join(', ')})`,
    );
  } finally {
    client.close();
    await chrome.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  writeFileSync(
    REPORT,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      result: 'FAIL',
      error: error instanceof Error ? error.message : String(error),
    }, null, 2)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});