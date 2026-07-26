#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: patch-host-finalizer-v9.py INPUT OUTPUT")
text = Path(sys.argv[1]).read_text()

old_already = '''   health_ok "$HEALTH_LOCAL" && health_ok "$HEALTH_PUBLIC"; then
  already=true
fi
'''
new_already = '''   health_ok "$HEALTH_LOCAL"; then
  already=true
fi
'''
if text.count(old_already) != 1:
    raise SystemExit(f"already-prepared public-health anchor count was {text.count(old_already)}, expected 1")
text = text.replace(old_already, new_already, 1)

old_new_health = '''  health_ok "$HEALTH_LOCAL"; health_ok "$HEALTH_PUBLIC"
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" pm2 jlist | EXPECTED_SHA="$TARGET_SHA" node -e '''
new_new_health = '''  health_ok "$HEALTH_LOCAL"
  curl --fail --silent --show-error --connect-timeout 5 --max-time 15 --output /dev/null https://herobase.io/
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" pm2 jlist | EXPECTED_SHA="$TARGET_SHA" node -e '''
if text.count(old_new_health) != 1:
    raise SystemExit(f"new-runtime public-health anchor count was {text.count(old_new_health)}, expected 1")
text = text.replace(old_new_health, new_new_health, 1)

insert_marker = '''printf 'VETS_HOST_PREPARED=true\\n'
printf 'VETS_HOST_FINAL_SHA=%s\\n' "$TARGET_SHA"
VPS1

ssh -i "$DEPLOY_KEY"'''
insert_replacement = '''printf 'VETS_HOST_PREPARED=true\\n'
printf 'VETS_HOST_FINAL_SHA=%s\\n' "$TARGET_SHA"
VPS1

# The canonical runtime is locally exact. Purge Cloudflare, then require the
# public edge to report the same release before publishing deployment secrets.
purge_ok=false
for attempt in $(seq 1 3); do
  if response="$(curl -4 --fail-with-body --silent --show-error \\
      --connect-timeout 10 --max-time 30 -X POST \\
      "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \\
      -H "Authorization: Bearer $CF_API_TOKEN" \\
      -H 'Content-Type: application/json' \\
      --data '{"purge_everything":true}')" &&
     jq -e '.success == true and ((.errors // []) | length == 0)' <<<"$response" >/dev/null; then
    purge_ok=true
    break
  fi
  sleep $((attempt * 3))
done
test "$purge_ok" = true
printf 'VETS_HOST_PREP_CLOUDFLARE_PURGE=PASS\\n'
public_health='https://herobase.io/api/trpc/system.health?input=%7B%22json%22%3A%7B%22timestamp%22%3A0%7D%7D'
public_exact=false
for attempt in $(seq 1 20); do
  response="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 "$public_health" || true)"
  if grep -q '"ok":true' <<<"$response" && grep -q "\\"releaseSha\\":\\"$TARGET_SHA\\"" <<<"$response"; then
    public_exact=true
    break
  fi
  sleep 3
done
test "$public_exact" = true
printf 'VETS_HOST_PREP_PUBLIC_EXACT_SHA=PASS\\n'
unset response

ssh -i "$DEPLOY_KEY"'''
if text.count(insert_marker) != 1:
    raise SystemExit(f"VDS purge insertion anchor count was {text.count(insert_marker)}, expected 1")
text = text.replace(insert_marker, insert_replacement, 1)

if 'VETS_HOST_PREP_CLOUDFLARE_PURGE=PASS' not in text:
    raise SystemExit('Cloudflare purge gate missing')
if 'VETS_HOST_PREP_PUBLIC_EXACT_SHA=PASS' not in text:
    raise SystemExit('public exact-SHA gate missing')
Path(sys.argv[2]).write_text(text)
