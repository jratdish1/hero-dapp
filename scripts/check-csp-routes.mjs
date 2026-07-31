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
const ROUTES = ['/', '/wallet', '/stake', '/dao', '/dao/proposals'];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function contentType(file) {
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  })[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}
function cspPolicy() {
  const config = readFileSync(path.join(ROOT, 'nginx/herobase-cache-headers.conf'), 'utf8');
  const policy = config.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1];
  if (!policy) throw new Error('Production CSP was not found');
  return policy;
}
class Cdp {
  constructor(url) { this.url = url; this.socket = null; this.id = 1; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP connection timeout')), 15000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', event => { clearTimeout(timer); reject(new Error(event.message ?? 'CDP error')); }, { once: true });
    });
    this.socket.addEventListener('message', event => void this.handle(event.data));
  }
  async handle(data) {
    const message = JSON.parse(typeof data === 'string' ? data : await data.text());
    if (message.id) {
      const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id); message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result ?? {}); return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
  }
  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
      this.pending.set(id, { resolve(value) { clearTimeout(timer); resolve(value); }, reject(error) { clearTimeout(timer); reject(error); } });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) { const values = this.listeners.get(method) ?? new Set(); values.add(listener); this.listeners.set(method, values); }
  close() { this.socket?.close(); }
}
async function launch(bin) {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'vets-csp-browser-'));
  const log = path.join(profile, 'chrome.log'); const fd = openSync(log, 'a');
  const child = spawn(bin, ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-sync','--metrics-recording-only','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--window-size=1280,900','about:blank'], { stdio: ['ignore', fd, fd] });
  closeSync(fd);
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(portFile); i += 1) { if (child.exitCode !== null) throw new Error(`Chrome exited ${child.exitCode}`); await sleep(100); }
  const [port] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const target = await response.json();
  return { url: target.webSocketDebuggerUrl, async close() { child.kill('SIGTERM'); await sleep(500); if (child.exitCode === null) child.kill('SIGKILL'); await rm(profile, { recursive: true, force: true }); } };
}
async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Browser evaluation failed');
  return result.result?.value;
}
async function main() {
  if (!existsSync(path.join(OUTPUT, 'index.html'))) throw new Error('Production build is missing');
  const policy = cspPolicy();
  const index = readFileSync(path.join(OUTPUT, 'index.html'));
  const server = createServer((request, response) => {
    response.setHeader('content-security-policy', policy);
    response.setHeader('cache-control', 'no-store');
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    if (pathname.startsWith('/api/')) { response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }); response.end('{"result":{"data":{"json":null}}}'); return; }
    const candidate = path.resolve(OUTPUT, `.${pathname}`);
    if (candidate.startsWith(`${OUTPUT}${path.sep}`) && existsSync(candidate) && statSync(candidate).isFile()) { response.writeHead(200, { 'content-type': contentType(candidate) }); response.end(readFileSync(candidate)); return; }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(index);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('CSP server address missing');
  const chromeBin = process.env.CHROME_BIN; if (!chromeBin || !existsSync(chromeBin)) throw new Error('CHROME_BIN is required');
  const chrome = await launch(chromeBin); const client = new Cdp(chrome.url); await client.connect();
  const consoleErrors = [];
  client.on('Runtime.consoleAPICalled', params => { const text = (params.args ?? []).map(arg => arg.value ?? arg.description ?? '').join(' '); if (/content security policy|refused to/i.test(text)) consoleErrors.push(text); });
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__vetsCspViolations=[];document.addEventListener('securitypolicyviolation',event=>window.__vetsCspViolations.push({blockedURI:event.blockedURI,effectiveDirective:event.effectiveDirective,violatedDirective:event.violatedDirective,sourceFile:event.sourceFile,lineNumber:event.lineNumber}));` });
  const results = [];
  try {
    for (const route of ROUTES) {
      await client.send('Page.navigate', { url: `http://127.0.0.1:${address.port}${route}` });
      const deadline = Date.now() + 20000; let body = '';
      while (Date.now() < deadline) { body = await evaluate(client, 'document.body?.innerText?.trim().slice(0,500) || ""').catch(() => ''); if (body) break; await sleep(250); }
      await sleep(1000);
      const violations = await evaluate(client, 'window.__vetsCspViolations || []');
      if (!body) throw new Error(`${route}: body did not render`);
      if (violations.length) throw new Error(`${route}: CSP violations: ${JSON.stringify(violations)}`);
      results.push({ route, body: body.slice(0, 160), violations });
    }
    if (consoleErrors.length) throw new Error(`CSP console errors: ${JSON.stringify(consoleErrors)}`);
    writeFileSync(REPORT, `${JSON.stringify({ timestamp: new Date().toISOString(), result: 'PASS', policy, routes: results, consoleErrors }, null, 2)}\n`);
    console.log(`Production CSP route matrix: PASS (${ROUTES.join(', ')})`);
  } finally { client.close(); await chrome.close().catch(() => {}); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { writeFileSync(REPORT, `${JSON.stringify({ timestamp: new Date().toISOString(), result: 'FAIL', error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`); console.error(error); process.exitCode = 1; });
