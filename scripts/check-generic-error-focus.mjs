#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const REPORT_PATH = path.resolve(process.cwd(), 'generic-error-focus-report.json');
const EXPECTED_HEADING_ID = 'application-error-title';
const EXPECTED_HEADING = 'An unexpected application error occurred.';

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

async function runChrome(chromeBin, url) {
  const args = [
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
    '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1',
    '--virtual-time-budget=5000',
    '--dump-dom',
    url,
  ];

  const child = spawn(chromeBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });

  const exitCode = await Promise.race([
    new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 1));
    }),
    new Promise((_, reject) => {
      setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Timed out waiting for headless Chrome generic focus test'));
      }, 30_000);
    }),
  ]);

  if (exitCode !== 0) {
    throw new Error(`Headless Chrome exited with ${exitCode}: ${stderr.slice(-1000)}`);
  }
  return { stdout, stderr };
}

function attribute(dom, name) {
  const match = dom.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1] ?? '';
}

async function main() {
  const chromeBin = process.env.CHROME_BIN;
  if (!chromeBin || !existsSync(chromeBin)) {
    throw new Error('CHROME_BIN must point to an installed Chrome/Chromium executable');
  }

  const workdir = await mkdtemp(path.join(os.tmpdir(), 'vets-generic-error-focus-'));
  const entryPath = path.join(workdir, 'entry.tsx');
  const bundlePath = path.join(workdir, 'harness.js');
  const htmlPath = path.join(workdir, 'index.html');
  const errorBoundaryPath = path.resolve(process.cwd(), 'client/src/components/ErrorBoundary.tsx');
  const dappBoundaryPath = path.resolve(process.cwd(), 'client/src/components/DappLoadBoundary.tsx');
  let server;

  try {
    const entry = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import ErrorBoundary from ${JSON.stringify(errorBoundaryPath)};
      import { createRootErrorHandlers } from ${JSON.stringify(dappBoundaryPath)};

      function ThrowOnInitialRender() {
        throw new Error('VETS mounted generic error focus test');
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
      absWorkingDir: process.cwd(),
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2022'],
      jsx: 'automatic',
      define: {
        'import.meta.env.DEV': 'false',
      },
      tsconfig: path.resolve(process.cwd(), 'tsconfig.json'),
      logLevel: 'silent',
    });
    await writeFile(
      htmlPath,
      '<!doctype html><html><head><meta charset="utf-8"><title>VETS generic focus test</title></head><body><div id="root"></div><script type="module" src="/harness.js"></script></body></html>',
    );

    server = await startStaticServer(workdir);
    const { stdout, stderr } = await runChrome(chromeBin, server.url);
    const ready = attribute(stdout, 'data-ready');
    const focusedId = attribute(stdout, 'data-focused-id');
    const heading = attribute(stdout, 'data-heading');
    const focusClass = attribute(stdout, 'data-focus-class');

    if (ready !== 'true') throw new Error('Generic focus harness did not report ready');
    if (focusedId !== EXPECTED_HEADING_ID) {
      throw new Error(`Generic error heading was not focused: ${focusedId || 'none'}`);
    }
    if (heading !== EXPECTED_HEADING) {
      throw new Error(`Unexpected generic error heading: ${heading || 'missing'}`);
    }
    if (!focusClass.includes('focus:outline') || focusClass.includes('focus:outline-none')) {
      throw new Error(`Generic error heading lacks a visible focus indicator: ${focusClass}`);
    }

    const report = {
      timestamp: new Date().toISOString(),
      result: 'PASS',
      focusedId,
      heading,
      focusClass,
      consoleWasSanitized: !stderr.includes('VETS mounted generic error focus test'),
    };
    if (!report.consoleWasSanitized) {
      throw new Error('Generic error detail leaked into the production browser console');
    }
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Mounted generic error focus: PASS (${REPORT_PATH})`);
  } finally {
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
    };
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`).catch(() => {});
    console.error('[Mounted generic error focus failed]', error);
    process.exitCode = 1;
  });
}
