// node --test tests/  — runs against a local mock of the xAI API; no network, no real key.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FAKE_KEY = "xai-test-NOT-A-REAL-KEY-1234567890";
let lastUpstream = null;
let upstreamReply = "Hello from mock.";
const mock = http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    lastUpstream = { auth: req.headers.authorization, body: JSON.parse(b) };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: upstreamReply } }] }));
  });
});
await new Promise((r) => mock.listen(0, "127.0.0.1", r));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gc-"));
const refusalLog = path.join(tmp, "refusals.jsonl");
const promptFile = path.join(tmp, "prompt.md");
fs.writeFileSync(promptFile, "<!-- c -->You are the assistant for {{SITE_NAME}}. Refuse unsafe requests.");

async function boot(extra) {
  Object.assign(process.env, {
    XAI_API_KEY: FAKE_KEY, XAI_BASE_URL: `http://127.0.0.1:${mock.address().port}/v1`, GROK_MODEL: "grok-4.3",
    ALLOWED_ORIGINS: "https://example.org", RATE_PER_MIN: "3", RATE_PER_HOUR: "100", DAILY_CAP: "1000",
    PROMPT_FILE: promptFile, PROMPT_SITE_NAME: "TestSite", GUARD: "none", REFUSAL_LOG: refusalLog, ...extra,
  });
  const { createServer, loadConfig } = await import(`../server/grok-chat-server.mjs?${Math.random()}`);
  const s = createServer(loadConfig());
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  return s;
}
const post = (s, body, headers = {}) => fetch(`http://127.0.0.1:${s.address().port}/api/grok-chat`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.org", "X-Real-IP": headers.ip || "1.1.1.1", ...headers }, body: JSON.stringify(body),
});

test("happy path uses grok-4.3, key stays server-side, prompt templated", async () => {
  const s = await boot();
  const r = await post(s, { messages: [{ role: "user", content: "hi" }] });
  const txt = await r.text();
  assert.equal(r.status, 200);
  assert.ok(!txt.includes(FAKE_KEY), "key must never be in response");
  assert.equal(lastUpstream.body.model, "grok-4.3");
  assert.equal(lastUpstream.auth, `Bearer ${FAKE_KEY}`);
  assert.equal(lastUpstream.body.messages[0].role, "system");
  assert.ok(lastUpstream.body.messages[0].content.includes("TestSite"));
  assert.ok(!lastUpstream.body.messages[0].content.includes("{{"));
  const h = await fetch(`http://127.0.0.1:${s.address().port}/api/grok-chat/health`).then((x) => x.text());
  assert.ok(!h.includes(FAKE_KEY));
  s.close();
});

test("rejects bad origin, bad json, wrong method, oversize", async () => {
  const s = await boot();
  assert.equal((await post(s, { messages: [{ role: "user", content: "x" }] }, { Origin: "https://evil.example", ip: "2.2.2.2" })).status, 403);
  assert.equal((await post(s, { nope: 1 }, { ip: "2.2.2.3" })).status, 400);
  const g = await fetch(`http://127.0.0.1:${s.address().port}/api/grok-chat`); assert.equal(g.status, 405);
  const big = await post(s, { messages: [{ role: "user", content: "a".repeat(40000) }] }, { ip: "2.2.2.4" }).catch(() => ({ status: 0 }));
  assert.ok(big.status === 0 || big.status >= 400);
  s.close();
});

test("rate limit per IP returns 429", async () => {
  const s = await boot();
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await post(s, { messages: [{ role: "user", content: "q" + i }] }, { ip: "9.9.9.9" })).status);
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
  s.close();
});

test("peptide guard: pre-screen refuses without calling model, logs, disclaimer on answers", async () => {
  const s = await boot({ GUARD: "peptide", RATE_PER_MIN: "50" });
  lastUpstream = null;
  const r = await post(s, { messages: [{ role: "user", content: "How many mcg of BPC-157 should I inject daily?" }] }, { ip: "3.3.3.3" }).then((x) => x.json());
  assert.equal(r.refused, true); assert.match(r.reply, /^REFUSAL:/); assert.equal(lastUpstream, null);
  assert.match(r.reply, /Research use only\. Not for human or veterinary use/);
  upstreamReply = "BPC-157 is a synthetic pentadecapeptide studied mainly in rodent models.";
  const ok = await post(s, { messages: [{ role: "user", content: "What is BPC-157?" }] }, { ip: "3.3.3.3" }).then((x) => x.json());
  assert.match(ok.reply, /Research use only\. Not for human or veterinary use/);
  upstreamReply = "Researchers commonly used 10 mcg per kg.";
  const scrub = await post(s, { messages: [{ role: "user", content: "Tell me about a rodent study" }] }, { ip: "3.3.3.3" }).then((x) => x.json());
  assert.equal(scrub.refused, true); assert.ok(!/10 mcg/.test(scrub.reply));
  const lines = fs.readFileSync(refusalLog, "utf8").trim().split("\n").map(JSON.parse);
  assert.ok(lines.some((l) => l.stage === "pre") && lines.some((l) => l.stage === "post"));
  assert.ok(lines.every((l) => !String(l.ip).includes("3.3.3.3")), "IP must be hashed");
  s.close();
});

test.after(() => mock.close());
