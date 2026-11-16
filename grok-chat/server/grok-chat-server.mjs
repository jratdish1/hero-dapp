#!/usr/bin/env node
// grok-chat sidecar — VETS fleet, 2026-11-16.
// Zero-dependency Node (>=18) HTTP service that proxies a site chat widget to xAI.
// The XAI_API_KEY is read from the process environment only (systemd EnvironmentFile
// /etc/grok-chat/<site>.env, mode 0640). It is never sent to the browser or logged.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { preScreen, postScreen, isModelRefusal, withDisclaimer, REFUSAL_TEXT } from "./peptide-guard.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const env = (k, d) => (process.env[k] === undefined || process.env[k] === "" ? d : process.env[k]);

export function loadConfig() {
  return {
    host: env("HOST", "127.0.0.1"),
    port: Number(env("PORT", "3311")),
    site: env("SITE_NAME", "site"),
    chatPath: env("CHAT_PATH", "/api/grok-chat"),
    model: env("GROK_MODEL", "grok-4.3"),
    baseUrl: env("XAI_BASE_URL", "https://api.x.ai/v1").replace(/\/$/, ""),
    apiKey: env("XAI_API_KEY", ""),
    promptFile: path.resolve(HERE, "..", env("PROMPT_FILE", "prompts/site.md")),
    guard: env("GUARD", "none"), // "none" | "peptide"
    allowedOrigins: env("ALLOWED_ORIGINS", "").split(",").map((s) => s.trim()).filter(Boolean),
    clientIpHeader: env("CLIENT_IP_HEADER", "x-real-ip").toLowerCase(),
    perMin: Number(env("RATE_PER_MIN", "6")),
    perHour: Number(env("RATE_PER_HOUR", "40")),
    dailyCap: Number(env("DAILY_CAP", "1500")),
    maxTokens: Number(env("MAX_TOKENS", "600")),
    timeoutMs: Number(env("UPSTREAM_TIMEOUT_MS", "25000")),
    refusalLog: env("REFUSAL_LOG", ""),
  };
}

const MAX_BODY = 16 * 1024;
const MAX_MSG_CHARS = 1200;
const MAX_TURNS = 8;

export function createServer(cfg = loadConfig()) {
  if (!cfg.apiKey) throw new Error("XAI_API_KEY is not set (expected in the service EnvironmentFile)");
  // {{KEY}} placeholders are filled from PROMPT_KEY env vars (e.g. PROMPT_SITE_URL).
  const systemPrompt = fs.readFileSync(cfg.promptFile, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\{\{(\w+)\}\}/g, (_, k) => process.env[`PROMPT_${k}`] || "")
    .trim();
  const buckets = new Map(); // ip -> {min:[ts], hour:[ts]}
  let day = new Date().toISOString().slice(0, 10);
  let dayCount = 0;
  let salt = crypto.randomBytes(16).toString("hex");

  const ipHash = (ip) => crypto.createHash("sha256").update(salt + ip).digest("hex").slice(0, 16);

  function rateLimited(ip) {
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; dayCount = 0; salt = crypto.randomBytes(16).toString("hex"); buckets.clear(); }
    if (dayCount >= cfg.dailyCap) return "daily";
    const b = buckets.get(ip) || { min: [], hour: [] };
    b.min = b.min.filter((t) => now - t < 60_000);
    b.hour = b.hour.filter((t) => now - t < 3_600_000);
    if (b.min.length >= cfg.perMin || b.hour.length >= cfg.perHour) { buckets.set(ip, b); return "ip"; }
    b.min.push(now); b.hour.push(now); buckets.set(ip, b);
    dayCount++;
    if (buckets.size > 50_000) buckets.clear(); // memory guard
    return null;
  }

  function logRefusal(ip, stage, category, text) {
    if (!cfg.refusalLog) return;
    const rec = { ts: new Date().toISOString(), site: cfg.site, stage, category, ip: ipHash(ip), excerpt: String(text).slice(0, 200) };
    try { fs.appendFileSync(cfg.refusalLog, JSON.stringify(rec) + "\n"); } catch (e) { console.error(`[grok-chat ${cfg.site}] refusal log write failed: ${e.code || e.message}`); }
  }

  function send(res, status, obj, extra = {}) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra });
    res.end(body);
  }

  function originOk(req) {
    if (!cfg.allowedOrigins.length) return true;
    const o = req.headers.origin;
    return typeof o === "string" && cfg.allowedOrigins.includes(o);
  }

  function clientIp(req) {
    const h = req.headers[cfg.clientIpHeader];
    return (Array.isArray(h) ? h[0] : h || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  }

  function validate(body) {
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) return null;
    const msgs = body.messages.slice(-MAX_TURNS).map((m) => ({
      role: m && m.role === "assistant" ? "assistant" : "user",
      content: typeof m?.content === "string" ? m.content.slice(0, MAX_MSG_CHARS) : "",
    })).filter((m) => m.content.trim());
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
    return msgs;
  }

  async function callGrok(messages) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
    try {
      const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({ model: cfg.model, temperature: 0.2, max_tokens: cfg.maxTokens, messages: [{ role: "system", content: systemPrompt }, ...messages] }),
      });
      if (!r.ok) throw new Error(`upstream_${r.status}`);
      const j = await r.json();
      const text = j?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) throw new Error("upstream_empty");
      return text.trim();
    } finally { clearTimeout(t); }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === `${cfg.chatPath}/health`) return send(res, 200, { ok: true, site: cfg.site, model: cfg.model, guard: cfg.guard });
    if (url.pathname !== cfg.chatPath) return send(res, 404, { error: "not_found" });
    if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" }, { Allow: "POST" });
    if (!originOk(req)) return send(res, 403, { error: "origin_not_allowed" });
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "json_required" });

    let raw = "";
    let tooBig = false;
    req.setEncoding("utf8");
    req.on("data", (c) => { raw += c; if (raw.length > MAX_BODY) { tooBig = true; req.destroy(); } });
    req.on("end", async () => {
      if (tooBig) return;
      let body; try { body = JSON.parse(raw); } catch { return send(res, 400, { error: "bad_json" }); }
      const msgs = validate(body);
      if (!msgs) return send(res, 400, { error: "bad_request" });
      const ip = clientIp(req);
      const limited = rateLimited(ip);
      if (limited) return send(res, 429, { error: "rate_limited", reply: "You're sending messages quickly. Please wait a minute and try again." }, { "Retry-After": "60" });

      const last = msgs[msgs.length - 1].content;
      if (cfg.guard === "peptide") {
        const pre = preScreen(last);
        if (pre) { logRefusal(ip, "pre", pre, last); return send(res, 200, { reply: withDisclaimer(REFUSAL_TEXT(pre)), refused: true }); }
      }
      try {
        let reply = await callGrok(msgs);
        let refused = false;
        if (cfg.guard === "peptide") {
          const post = postScreen(reply);
          if (post) { logRefusal(ip, "post", post, last); reply = REFUSAL_TEXT(post); refused = true; }
          else if (isModelRefusal(reply)) { logRefusal(ip, "model", "model_refusal", last); refused = true; }
          reply = withDisclaimer(reply);
        }
        return send(res, 200, { reply, refused });
      } catch (e) {
        console.error(`[grok-chat ${cfg.site}] upstream error: ${e && e.name === "AbortError" ? "timeout" : e.message}`);
        return send(res, 502, { error: "upstream_unavailable", reply: "The assistant is unavailable right now. Please use the contact link below." });
      }
    });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cfg = loadConfig();
  createServer(cfg).listen(cfg.port, cfg.host, () => console.log(`[grok-chat ${cfg.site}] listening on ${cfg.host}:${cfg.port} model=${cfg.model} guard=${cfg.guard}`));
}
