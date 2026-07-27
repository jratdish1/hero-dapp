import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const baseUrl = "https://herobase.io";
const expectedSha = process.env.EXPECTED_RELEASE_SHA;
if (!/^[0-9a-f]{40}$/.test(expectedSha ?? "")) {
  throw new Error("EXPECTED_RELEASE_SHA must be a lowercase 40-character SHA");
}

const outputDir = process.env.E2E_OUTPUT_DIR || "herobase-live-e2e";
fs.mkdirSync(outputDir, { recursive: true });

const candidates = [
  process.env.CHROME_BIN,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

let executablePath = candidates.find((candidate) => fs.existsSync(candidate));
if (!executablePath) {
  for (const command of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      const resolved = execFileSync("bash", ["-lc", `command -v ${command}`], {
        encoding: "utf8",
      }).trim();
      if (resolved) {
        executablePath = resolved;
        break;
      }
    } catch {
      // Continue to the next candidate.
    }
  }
}
if (!executablePath) throw new Error("No Chrome/Chromium executable was found");

const routes = [
  "/",
  "/swap",
  "/portfolio",
  "/dashboard",
  "/dca",
  "/limits",
  "/approvals",
  "/bootcamp",
  "/stake",
  "/community",
  "/dao",
];

const deferredFeatures = {
  "/stake": "single-sided staking is an approved deferred feature",
  "/dao": "binding/snapshot DAO governance is an approved deferred feature",
};

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
  ],
});

const results = [];
const firstPartyHost = new URL(baseUrl).host;

async function inspectRoute(route, viewport, suffix) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 VETS-E2E/1.0",
  );

  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const badResponses = [];

  page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    try {
      const parsed = new URL(request.url());
      if (parsed.host === firstPartyHost) {
        requestFailures.push({
          url: request.url(),
          error: request.failure()?.errorText || "unknown",
        });
      }
    } catch {
      // Ignore malformed third-party URLs.
    }
  });
  page.on("response", (response) => {
    try {
      const parsed = new URL(response.url());
      if (parsed.host === firstPartyHost && response.status() >= 500) {
        badResponses.push({ url: response.url(), status: response.status() });
      }
    } catch {
      // Ignore malformed URLs.
    }
  });

  const started = Date.now();
  const response = await page.goto(`${baseUrl}${route}`, {
    waitUntil: ["domcontentloaded", "networkidle2"],
    timeout: 60_000,
  });
  await new Promise((resolve) => setTimeout(resolve, 1_500));

  const status = response?.status() ?? 0;
  const browserState = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const buttons = [...document.querySelectorAll("button")]
      .filter(visible)
      .map((button, index) => ({
        index,
        text: (button.innerText || button.getAttribute("aria-label") || "").trim().slice(0, 160),
        disabled: Boolean(button.disabled),
        ariaLabel: button.getAttribute("aria-label"),
        type: button.getAttribute("type"),
      }));

    const anchors = [...document.querySelectorAll("a[href]")]
      .filter(visible)
      .map((anchor) => ({
        text: (anchor.innerText || anchor.getAttribute("aria-label") || "").trim().slice(0, 160),
        href: anchor.href,
      }));

    const focusChecks = [...document.querySelectorAll("button")]
      .filter(visible)
      .map((button) => {
        if (button.disabled) return true;
        button.focus({ preventScroll: true });
        return document.activeElement === button;
      });

    return {
      title: document.title,
      bodyTextLength: (document.body?.innerText || "").trim().length,
      heading: document.querySelector("h1")?.innerText?.trim() || "",
      hasMain: Boolean(document.querySelector("main")),
      buttons,
      anchors,
      allEnabledButtonsFocusable: focusChecks.every(Boolean),
      htmlLang: document.documentElement.lang || "",
    };
  });

  const screenshotName = `${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}-${suffix}.png`;
  await page.screenshot({
    path: path.join(outputDir, screenshotName),
    fullPage: true,
  });

  const elapsedMs = Date.now() - started;
  const pass =
    status >= 200 &&
    status < 400 &&
    browserState.title.length > 0 &&
    browserState.bodyTextLength >= 100 &&
    browserState.hasMain &&
    browserState.allEnabledButtonsFocusable &&
    pageErrors.length === 0 &&
    requestFailures.length === 0 &&
    badResponses.length === 0;

  await page.close();
  return {
    route,
    viewport,
    suffix,
    status,
    elapsedMs,
    deferredFeature: deferredFeatures[route] || null,
    pass,
    ...browserState,
    pageErrors,
    consoleErrors,
    requestFailures,
    badResponses,
    screenshot: screenshotName,
  };
}

try {
  for (const route of routes) {
    results.push(
      await inspectRoute(route, { width: 1440, height: 1000, deviceScaleFactor: 1 }, "desktop"),
    );
  }
  for (const route of ["/", "/swap", "/portfolio", "/dao"]) {
    results.push(
      await inspectRoute(
        route,
        { width: 390, height: 844, deviceScaleFactor: 1 },
        "mobile",
      ),
    );
  }

  const healthResponse = await fetch(
    `${baseUrl}/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D`,
    { redirect: "follow" },
  );
  const healthText = await healthResponse.text();
  const healthPass =
    healthResponse.ok &&
    healthText.includes('"ok":true') &&
    healthText.includes(`"releaseSha":"${expectedSha}"`);

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    expectedSha,
    browserExecutable: executablePath,
    approvedDeferredFeatures: [
      "single-sided staking implementation",
      "binding DAO governance and snapshot voting",
    ],
    prohibitedActionsPerformed: [],
    health: {
      status: healthResponse.status,
      exactSha: healthText.includes(`"releaseSha":"${expectedSha}"`),
      ok: healthText.includes('"ok":true'),
      pass: healthPass,
    },
    routeResults: results,
    summary: {
      total: results.length,
      passed: results.filter((item) => item.pass).length,
      failed: results.filter((item) => !item.pass).length,
      healthPass,
      overallPass: results.every((item) => item.pass) && healthPass,
    },
  };

  fs.writeFileSync(
    path.join(outputDir, "live-e2e.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report.summary));
  if (!report.summary.overallPass) process.exitCode = 1;
} finally {
  await browser.close();
}
