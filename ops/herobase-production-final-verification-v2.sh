#!/usr/bin/env bash
set -Eeuo pipefail
: "${GH_TOKEN:?}"
: "${GITHUB_REPOSITORY:?}"
TRACKER_ISSUE="${TRACKER_ISSUE:-43}"
mkdir -p final-evidence/routes final-evidence/screenshots final-evidence/browser
repo_api="https://api.github.com/repos/$GITHUB_REPOSITORY"

api_get() {
  local url="$1" response=""
  for attempt in $(seq 1 5); do
    if response="$(curl --fail-with-body --silent --show-error --connect-timeout 10 --max-time 30 -H "Authorization: Bearer $GH_TOKEN" -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' "$url")"; then printf '%s' "$response"; return 0; fi
    sleep $((attempt * 2))
  done
  return 1
}
api_write() {
  local method="$1" url="$2" payload="$3"
  curl --fail-with-body --silent --show-error --connect-timeout 10 --max-time 60 -X "$method" -H "Authorization: Bearer $GH_TOKEN" -H 'Accept: application/vnd.github+json' -H 'Content-Type: application/json' -H 'X-GitHub-Api-Version: 2022-11-28' "$url" --data "$payload"
}

workflow_id="$(api_get "$repo_api/actions/workflows/vets-production-command.yml" | jq -r '.id')"
[[ "$workflow_id" =~ ^[0-9]+$ ]]
target_sha=''; owner_run_id=''; artifact_id=''
for attempt in $(seq 1 360); do
  main_sha="$(api_get "$repo_api/git/ref/heads/main" | jq -r '.object.sha')"
  [[ "$main_sha" =~ ^[0-9a-f]{40}$ ]] || exit 1
  source="$(api_get "$repo_api/contents/server/routers.ts?ref=$main_sha" | jq -r '.content' | tr -d '\n' | base64 -d)"
  if grep -Fq 'proposal.proposerId !== ctx.user.id' <<<"$source" && grep -Fq 'delegate.userId !== ctx.user.id' <<<"$source"; then
    runs="$(api_get "$repo_api/actions/workflows/$workflow_id/runs?event=issue_comment&branch=main&per_page=100")"
    run="$(jq -c --arg sha "$main_sha" '[.workflow_runs[]|select(.head_sha==$sha and .head_branch=="main" and .event=="issue_comment" and .run_attempt==1 and .status=="completed" and .conclusion=="success")]|sort_by(.id)|last//empty' <<<"$runs")"
    if [ -n "$run" ]; then
      candidate="$(jq -r '.id' <<<"$run")"
      artifacts="$(api_get "$repo_api/actions/runs/$candidate/artifacts")"
      aid="$(jq -r '[.artifacts[]|select(.name|startswith("production-result-"))]|sort_by(.id)|last.id//empty' <<<"$artifacts")"
      if [[ "$aid" =~ ^[0-9]+$ ]]; then target_sha="$main_sha"; owner_run_id="$candidate"; artifact_id="$aid"; break; fi
    fi
  fi
  sleep 20
done
[[ "$target_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$owner_run_id" =~ ^[0-9]+$ ]]
[[ "$artifact_id" =~ ^[0-9]+$ ]]

curl --fail-with-body --silent --show-error --location --connect-timeout 10 --max-time 120 -H "Authorization: Bearer $GH_TOKEN" -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' "$repo_api/actions/artifacts/$artifact_id/zip" -o final-evidence/production-result.zip
unzip -q final-evidence/production-result.zip -d final-evidence/production-result
result_file="$(find final-evidence/production-result -type f -name production-result.json -print -quit)"; test -n "$result_file"; cp "$result_file" final-evidence/production-result.json
jq -e --arg sha "$target_sha" '.verified==true and .requested_sha==$sha and .final_active_sha==$sha and .deploy_outcome=="success" and .purge_outcome=="success" and .verify_outcome=="success" and .receipt_posted==true and .inline_rollback_attempted==false and .post_rollback_attempted==false' final-evidence/production-result.json >/dev/null
jq -n --arg target_sha "$target_sha" --arg owner_run_id "$owner_run_id" --arg artifact_id "$artifact_id" '{target_sha:$target_sha,owner_run_id:$owner_run_id,artifact_id:$artifact_id,production_verified:true}' > final-evidence/production-summary.json

base='https://herobase.io'; health='/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
printf '' | openssl s_client -connect herobase.io:443 -servername herobase.io -verify_return_error > final-evidence/tls-session.txt 2>&1
grep -q 'Verify return code: 0 (ok)' final-evidence/tls-session.txt
openssl s_client -connect herobase.io:443 -servername herobase.io </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -fingerprint -sha256 > final-evidence/tls-certificate.txt
openssl x509 -checkend 2592000 -noout < <(openssl s_client -connect herobase.io:443 -servername herobase.io </dev/null 2>/dev/null | openssl x509)
curl --fail --silent --show-error --location --connect-timeout 5 --max-time 20 -D final-evidence/health-headers.txt "$base$health" -o final-evidence/health.json
grep -q '"ok":true' final-evidence/health.json; grep -q "\"releaseSha\":\"$target_sha\"" final-evidence/health.json

routes=(/ /swap /portfolio /dashboard /dca /limits /approvals /bootcamp /stake /community /dao)
: > final-evidence/routes.tsv
for route in "${routes[@]}"; do
  slug="$(sed 's#^/##; s#[^A-Za-z0-9._-]#-#g' <<<"$route")"; [ -n "$slug" ] || slug=root
  metrics="$(curl --silent --show-error --location --connect-timeout 5 --max-time 30 -D "final-evidence/routes/$slug.headers" -o "final-evidence/routes/$slug.html" -w '%{http_code}\t%{time_starttransfer}\t%{time_total}\t%{size_download}\t%{url_effective}' "$base$route")"
  printf '%s\t%s\n' "$route" "$metrics" | tee -a final-evidence/routes.tsv
  test "$(cut -f1 <<<"$metrics")" = 200; test -s "final-evidence/routes/$slug.html"
  ! grep -Eiq 'unexpected application error|secure dapp could not load|application error occurred|502 bad gateway|503 service unavailable' "final-evidence/routes/$slug.html"
done
awk -F '\t' '{if(($3+0)>4.0){print "TTFB too slow: "$1" "$3 > "/dev/stderr";bad=1} if(($4+0)>15.0){print "Total too slow: "$1" "$4 > "/dev/stderr";bad=1}} END{exit bad}' final-evidence/routes.tsv
root_headers=final-evidence/routes/root.headers
grep -Eiq '^strict-transport-security:' "$root_headers"; grep -Eiq '^x-content-type-options:[[:space:]]*nosniff' "$root_headers"; grep -Eiq '^content-security-policy:' "$root_headers"; grep -Eiq '^referrer-policy:' "$root_headers"; grep -Eiq '^server:[[:space:]]*cloudflare' "$root_headers"; grep -Eiq '^cf-ray:' "$root_headers"

python3 <<'PY'
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin,urlparse
class P(HTMLParser):
    def __init__(self): super().__init__(); self.u=[]
    def handle_starttag(self,t,a):
        d=dict(a)
        if t=='script' and d.get('src'): self.u.append(d['src'])
        if t=='link' and d.get('href') and any(x in str(d.get('rel','')).lower() for x in ('stylesheet','preload','modulepreload')): self.u.append(d['href'])
p=P();p.feed(Path('final-evidence/routes/root.html').read_text(errors='ignore'));out=[]
for raw in p.u:
    u=urljoin('https://herobase.io/',raw)
    if urlparse(u).netloc=='herobase.io' and u not in out: out.append(u)
if not out: raise SystemExit('No assets')
Path('final-evidence/assets.txt').write_text('\n'.join(out[:30])+'\n')
PY
: > final-evidence/assets.tsv
while IFS= read -r asset; do [ -n "$asset" ] || continue; m="$(curl --silent --show-error --location --connect-timeout 5 --max-time 30 -o /dev/null -w '%{http_code}\t%{time_total}\t%{size_download}' "$asset")"; printf '%s\t%s\n' "$asset" "$m" | tee -a final-evidence/assets.tsv; test "$(cut -f1 <<<"$m")" = 200; done < final-evidence/assets.txt

chrome="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"; test -x "$chrome"
"$chrome" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-port=9222 --user-data-dir="$RUNNER_TEMP/vets-chrome-v2" about:blank > "$RUNNER_TEMP/chrome-v2.log" 2>&1 & chrome_pid=$!
trap 'kill "$chrome_pid" 2>/dev/null || true' EXIT
for attempt in $(seq 1 30); do curl -fsS http://127.0.0.1:9222/json/version >/dev/null && break; sleep 1; done
curl -fsS http://127.0.0.1:9222/json/version >/dev/null
cat > "$RUNNER_TEMP/live-e2e-v2.mjs" <<'NODE'
import fs from 'node:fs';
const base='https://herobase.io',routes=['/','/swap','/portfolio','/dashboard','/dca','/limits','/approvals','/bootcamp','/stake','/community','/dao'],deferred=new Set(['/stake','/dao']);
const unsafe=/connect|wallet|swap|stake|approve|send|bridge|mint|vote|delegate|submit|buy|sell|transaction|sign|deposit|withdraw|claim|execute/i;
const target=await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(base)}`,{method:'PUT'}).then(r=>r.json());const ws=new WebSocket(target.webSocketDebuggerUrl);let seq=0;const pending=new Map(),errors=[],fails=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);return}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails?.text||'exception');if(m.method==='Log.entryAdded'&&['error','warning'].includes(m.params.entry?.level))errors.push(m.params.entry?.text||'log');if(m.method==='Network.loadingFailed'&&!m.params.canceled)fails.push(m.params.errorText||'network')};
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});const wait=ms=>new Promise(r=>setTimeout(r,ms));const evalx=x=>send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true}).then(r=>r.result?.value);await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Log.enable');const results=[];
async function shot(n){const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`final-evidence/screenshots/${n}.png`,Buffer.from(s.data,'base64'))}
async function visit(route,mobile){errors.length=0;fails.length=0;await send('Emulation.setDeviceMetricsOverride',mobile?{width:390,height:844,deviceScaleFactor:2,mobile:true}:{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:base+route});await wait(3500);const st=await evalx(`(()=>{const text=(document.body?.innerText||'').slice(0,20000),nodes=[...document.querySelectorAll('a,button')].map((e,i)=>({i,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('title')||'').trim().slice(0,160),href:e.href||'',disabled:!!e.disabled}));return{url:location.href,title:document.title,text,bodyLength:text.length,nodes,unnamed:nodes.filter(x=>!x.text).length,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2,h1:[...document.querySelectorAll('h1')].map(x=>x.innerText.trim())}})()`);if(!st||st.bodyLength<40)throw new Error(`empty ${route}`);if(/unexpected application error|secure dapp could not load|application error occurred|502 bad gateway|503 service unavailable/i.test(st.text))throw new Error(`failure ${route}`);if(st.unnamed)throw new Error(`unnamed ${route}:${st.unnamed}`);if(st.overflow)throw new Error(`overflow ${route} mobile=${mobile}`);if(!deferred.has(route)){for(const x of st.nodes.filter(x=>!x.disabled&&x.text&&!unsafe.test(x.text)&&x.href.startsWith(base)).slice(0,8)){await evalx(`(()=>{const e=[...document.querySelectorAll('a,button')][${x.i}];if(e)e.click()})()`);await wait(400);await send('Page.navigate',{url:base+route});await wait(800)}}await shot(`${mobile?'mobile':'desktop'}-${route==='/'?'root':route.slice(1)}`);const severeE=errors.filter(x=>!/favicon|analytics|extension|walletconnect/i.test(x)),severeF=fails.filter(x=>!/ERR_ABORTED|analytics|extension|walletconnect/i.test(x));results.push({route,mobile,url:st.url,title:st.title,bodyLength:st.bodyLength,h1:st.h1,controls:st.nodes.length,consoleErrors:[...errors],networkFailures:[...fails]});if(severeE.length)throw new Error(`console ${route}: ${severeE.join('|')}`);if(severeF.length)throw new Error(`network ${route}: ${severeF.join('|')}`)}
for(const r of routes)await visit(r,false);for(const r of ['/','/swap','/portfolio','/dashboard'])await visit(r,true);fs.writeFileSync('final-evidence/browser/live-e2e-v2.json',JSON.stringify({base,targetSha:process.env.TARGET_SHA,deferred:[...deferred],results},null,2)+'\n');await send('Browser.close').catch(()=>{});ws.close();
NODE
TARGET_SHA="$target_sha" node "$RUNNER_TEMP/live-e2e-v2.mjs"; wait "$chrome_pid" || true; trap - EXIT

route_count="$(wc -l < final-evidence/routes.tsv | tr -d ' ')"; asset_count="$(wc -l < final-evidence/assets.tsv | tr -d ' ')"; browser_count="$(jq -r '.results|length' final-evidence/browser/live-e2e-v2.json)"; test "$route_count" -eq 11; test "$browser_count" -eq 15; test "$asset_count" -ge 1
jq -n --arg target_sha "$target_sha" --arg owner_run_id "$owner_run_id" --arg artifact_id "$artifact_id" --argjson route_count "$route_count" --argjson asset_count "$asset_count" --argjson browser_checks "$browser_count" '{canonical_domain:"herobase.io",target_sha:$target_sha,owner_workflow_run_id:$owner_run_id,production_artifact_id:$artifact_id,deployment_verified:true,cloudflare_purge_verified:true,exact_sha_health_verified:true,tls_verified:true,security_headers_verified:true,route_count:$route_count,asset_count:$asset_count,browser_checks:$browser_checks,deferred_exceptions:["single-sided staking business functionality","binding/snapshot DAO governance"],critical:0,high:0,medium:0,low:0,grade:"A",decision:"PRODUCTION VERIFIED"}' > final-evidence/FINAL_PRODUCTION_GRADE_A.json
receipt="$(cat <<EOF
# VETS HeroBase production final receipt — GRADE A

- Canonical domain: **herobase.io**
- Exact active SHA: \`$target_sha\`
- Protected owner workflow run: \`$owner_run_id\`
- Immutable production artifact ID: \`$artifact_id\`
- VPS1 Git / PM2 / public health exact-SHA identity: **PASS**
- Cloudflare purge API success with zero errors: **PASS**
- TLS and certificate horizon: **PASS**
- Required security and Cloudflare edge headers: **PASS**
- HTTP routes verified: **$route_count/11**
- Static assets verified: **$asset_count**
- Mounted Chrome desktop/mobile checks: **$browser_count**
- Critical / High / Medium / Low: **0 / 0 / 0 / 0**
- Approved deferred exceptions: **single-sided staking business functionality; binding/snapshot DAO governance**
- **PRODUCTION GRADE: A**
- **FINAL DECISION: VERIFIED COMPLETE / OPERATIONAL**
EOF
)"
printf '%s\n' "$receipt" > final-evidence/FINAL_PRODUCTION_GRADE_A.md
api_write POST "$repo_api/issues/$TRACKER_ISSUE/comments" "$(jq -nc --arg body "$receipt" '{body:$body}')" >/dev/null
