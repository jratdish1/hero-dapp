/**
 * Reverse Proxy for DEX Widget Iframes
 * 
 * Proxies Switch.win and SquirrelSwap widget pages through our server,
 * stripping X-Frame-Options and CSP frame-ancestors headers so they
 * can be embedded in iframes on herobase.io.
 */
import { Router, Request, Response } from "express";
import https from "https";
import http from "http";
import { URL } from "url";

const router = Router();

// Allowed widget origins (whitelist for security)
const ALLOWED_ORIGINS: Record<string, string> = {
  switch: "https://switch.win",
  squirrelswap: "https://squirrelswap.com",
};

/**
 * Proxy a widget page, stripping iframe-blocking headers.
 * Usage:
 *   /api/widget-proxy/switch/widget?network=pulsechain&from=0x...&to=0x...
 *   /api/widget-proxy/squirrelswap/?...
 */
router.get("/switch/*", (req: Request, res: Response) => {
  proxyWidget(req, res, "switch");
});

router.get("/squirrelswap/*", (req: Request, res: Response) => {
  proxyWidget(req, res, "squirrelswap");
});

function proxyWidget(req: Request, res: Response, provider: string): void {
  const baseUrl = ALLOWED_ORIGINS[provider];
  if (!baseUrl) {
    res.status(400).json({ error: "Unknown widget provider" });
    return;
  }

  // Build the target URL from the path after /api/widget-proxy/{provider}/
  const pathAfterProvider = req.path.replace(`/${provider}`, "") || "/";
  const queryString = req.url.includes("?") ? req.url.split("?")[1] : "";
  const targetUrl = `${baseUrl}${pathAfterProvider}${queryString ? "?" + queryString : ""}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  // Only allow HTTPS
  if (parsedUrl.protocol !== "https:") {
    res.status(400).json({ error: "Only HTTPS allowed" });
    return;
  }

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HeroBase/1.0)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "identity", // No compression for simplicity
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Copy status code
    const statusCode = proxyRes.statusCode || 502;

    // Copy headers but strip iframe-blocking ones
    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      const lowerKey = key.toLowerCase();
      // Strip headers that block iframe embedding
      if (
        lowerKey === "x-frame-options" ||
        lowerKey === "content-security-policy" ||
        lowerKey === "x-content-type-options"
      ) {
        continue;
      }
      if (value) {
        headers[key] = value as string | string[];
      }
    }

    // Set permissive CSP that allows our iframe embedding
    headers["X-Frame-Options"] = "ALLOWALL";
    headers["Content-Security-Policy"] = "frame-ancestors *";

    res.writeHead(statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error(`[widget-proxy] Error proxying ${provider}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Widget temporarily unavailable" });
    }
  });

  // Timeout after 15 seconds
  proxyReq.setTimeout(15000, () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: "Widget request timed out" });
    }
  });

  proxyReq.end();
}

// Also proxy sub-resources (CSS, JS) that the widget pages load
router.get("/switch-assets/*", (req: Request, res: Response) => {
  proxyAsset(req, res, "switch", "/switch-assets");
});

router.get("/squirrelswap-assets/*", (req: Request, res: Response) => {
  proxyAsset(req, res, "squirrelswap", "/squirrelswap-assets");
});

function proxyAsset(req: Request, res: Response, provider: string, prefix: string): void {
  const baseUrl = ALLOWED_ORIGINS[provider];
  if (!baseUrl) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }

  const assetPath = req.path.replace(prefix, "") || "/";
  const queryString = req.url.includes("?") ? req.url.split("?")[1] : "";
  const targetUrl = `${baseUrl}${assetPath}${queryString ? "?" + queryString : ""}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HeroBase/1.0)",
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      "Referer": baseUrl + "/",
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    const statusCode = proxyRes.statusCode || 502;
    const headers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "x-frame-options" || lowerKey === "content-security-policy") {
        continue;
      }
      if (value) {
        headers[key] = value as string | string[];
      }
    }
    // Allow cross-origin for assets
    headers["Access-Control-Allow-Origin"] = "*";
    res.writeHead(statusCode, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error(`[widget-proxy] Asset error ${provider}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Asset unavailable" });
    }
  });

  proxyReq.setTimeout(10000, () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: "Asset request timed out" });
    }
  });

  proxyReq.end();
}

export { router as widgetProxyRouter };
