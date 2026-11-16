/* grok-chat embed widget — VETS fleet 2026-11-16. Vanilla JS, no dependencies, CSP-safe
   (external script + external stylesheet, no inline styles/eval). No API key ever lives here;
   it only talks to the same-origin endpoint in data-endpoint.
   Usage:
   <script src="/grok-chat/grok-chat.js" defer
     data-endpoint="/api/grok-chat" data-title="VIC Assistant"
     data-greeting="Hi! Ask me about VIC Foundation."
     data-fallback-url="https://vicfoundation.com/#contact" data-fallback-label="Contact us"
     data-mode="standard|peptide" data-notice="optional footer notice"></script> */
(function () {
  "use strict";
  if (window.__grokChatLoaded) return;
  window.__grokChatLoaded = true;
  var me = document.currentScript || document.querySelector('script[src*="grok-chat.js"]');
  var d = (me && me.dataset) || {};
  var cfg = {
    endpoint: d.endpoint || "/api/grok-chat",
    title: d.title || "Assistant",
    greeting: d.greeting || "Hi! How can I help?",
    fallbackUrl: d.fallbackUrl || "/",
    fallbackLabel: d.fallbackLabel || "Contact",
    mode: d.mode === "peptide" ? "peptide" : "standard",
    notice: d.notice || "AI answers can be wrong. Not financial, legal, or medical advice.",
    css: d.css || (me && me.src ? me.src.replace(/grok-chat\.js(\?.*)?$/, "grok-chat.css") : "/grok-chat/grok-chat.css"),
  };
  var AGE_KEY = "grokChat21Ack";
  var history = [];
  var busy = false;

  var link = document.createElement("link");
  link.rel = "stylesheet"; link.href = cfg.css;
  document.head.appendChild(link);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  // Render model text safely: textContent only, with http(s) URLs turned into links.
  function renderText(node, text) {
    var re = /(https?:\/\/[^\s<>"')\]]+)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el("a", null, m[1]); a.href = m[1]; a.target = "_blank"; a.rel = "noopener noreferrer nofollow";
      node.appendChild(a); last = m.index + m[1].length;
    }
    if (last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  var root = el("div", "gc-root");
  var btn = el("button", "gc-launch", "💬");
  btn.type = "button"; btn.setAttribute("aria-label", "Open chat: " + cfg.title); btn.setAttribute("aria-expanded", "false");
  var panel = el("div", "gc-panel");
  panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", cfg.title); panel.hidden = true;

  var head = el("div", "gc-head");
  var ht = el("div", "gc-title", cfg.title);
  var hs = el("div", "gc-sub", "Powered by Grok");
  var hl = el("div"); hl.appendChild(ht); hl.appendChild(hs);
  var close = el("button", "gc-close", "×"); close.type = "button"; close.setAttribute("aria-label", "Close chat");
  head.appendChild(hl); head.appendChild(close);

  var log = el("div", "gc-log"); log.setAttribute("aria-live", "polite");
  var form = el("form", "gc-form");
  var input = el("textarea", "gc-input"); input.rows = 2; input.maxLength = 1000; input.placeholder = "Type your question…"; input.setAttribute("aria-label", "Message");
  var send = el("button", "gc-send", "Send"); send.type = "submit";
  form.appendChild(input); form.appendChild(send);

  var foot = el("div", "gc-foot");
  var fa = el("a", null, cfg.fallbackLabel); fa.href = cfg.fallbackUrl; fa.rel = "noopener";
  foot.appendChild(document.createTextNode(cfg.notice + " ")); foot.appendChild(fa);

  panel.appendChild(head); panel.appendChild(log);

  // Peptide mode: 21+ / research-only acknowledgement gate before chatting.
  var gate = null;
  function ackGiven() { try { return sessionStorage.getItem(AGE_KEY) === "1"; } catch (e) { return false; } }
  if (cfg.mode === "peptide" && !ackGiven()) {
    gate = el("div", "gc-gate");
    gate.appendChild(el("p", null, "This research assistant is for adults 21+ only. Information is educational, for laboratory research use only, not for human or veterinary use, and not medical advice. It will not provide dosing, protocols, or personal health guidance."));
    var ok = el("button", "gc-send", "I am 21+ and understand"); ok.type = "button";
    ok.addEventListener("click", function () { try { sessionStorage.setItem(AGE_KEY, "1"); } catch (e) {} gate.remove(); form.hidden = false; input.focus(); });
    gate.appendChild(ok);
    panel.appendChild(gate); form.hidden = true;
  }
  panel.appendChild(form); panel.appendChild(foot);
  root.appendChild(panel); root.appendChild(btn);

  function add(role, text) {
    var b = el("div", "gc-msg gc-" + role);
    renderText(b, text);
    log.appendChild(b); log.scrollTop = log.scrollHeight;
    return b;
  }
  add("assistant", cfg.greeting);

  function toggle(open) {
    panel.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    if (open && !form.hidden) input.focus();
  }
  btn.addEventListener("click", function () { toggle(panel.hidden); });
  close.addEventListener("click", function () { toggle(false); btn.focus(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) toggle(false); });
  input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit")); } });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q || busy) return;
    busy = true; send.disabled = true; input.value = "";
    add("user", q);
    history.push({ role: "user", content: q });
    history = history.slice(-8);
    var wait = add("assistant gc-wait", "…");
    fetch(cfg.endpoint, {
      method: "POST", credentials: "omit",
      headers: { "Content-Type": "application/json", "X-Requested-With": "grok-chat" },
      body: JSON.stringify({ messages: history }),
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) {
        wait.remove();
        var text = (res.j && typeof res.j.reply === "string" && res.j.reply) ||
          "Sorry, I couldn't answer that right now. Please use the " + cfg.fallbackLabel + " link below.";
        if (res.s === 200) history.push({ role: "assistant", content: text });
        add("assistant", text.replace(/^\s*REFUSAL:\s*/i, ""));
      })
      .catch(function () { wait.remove(); add("assistant", "Connection problem. Please try again or use the " + cfg.fallbackLabel + " link below."); })
      .then(function () { busy = false; send.disabled = false; });
  });

  function mount() { document.body.appendChild(root); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
