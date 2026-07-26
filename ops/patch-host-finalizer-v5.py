#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: patch-host-finalizer-v5.py INPUT OUTPUT")

source = Path(sys.argv[1]).read_text()
pattern = re.compile(
    r'''command="VETS DEPLOY \$TARGET_SHA"\n'''
    r'''comments="\$\(gh api --paginate "repos/\$REPO/issues/\$TRACKER_ISSUE/comments\?per_page=100" --slurp \| jq 'add'\)"\n'''
    r'''count="\$\(jq -r --arg body "\$command" '\[\.\[\]\|select\(\.user\.login=="jratdish1" and \.body==\$body\)\]\|length' <<<"\$comments"\)"\n'''
    r'''if \[ "\$count" = 0 \]; then command_comment="\$\(gh api "repos/\$REPO/issues/\$TRACKER_ISSUE/comments" -f body="\$command"\)"; elif \[ "\$count" = 1 \]; then command_comment="\$\(jq -c --arg body "\$command" '\[\.\[\]\|select\(\.user\.login=="jratdish1" and \.body==\$body\)\]\|\.\[0\]' <<<"\$comments"\)"; else exit 74; fi\n'''
    r'''comment_id="\$\(jq -r '\.id' <<<"\$command_comment"\)"; \[\[ "\$comment_id" =~ \^\[0-9\]\+\$ \]\]\n'''
    r'''printf 'VETS_OWNER_COMMAND_COMMENT_ID=%s\\n' "\$comment_id"\n'''
    r'''printf 'VETS_OWNER_COMMAND_POSTED=true\\n'\n'''
)

replacement = r'''command="VETS DEPLOY $TARGET_SHA"
comments="$(gh api --paginate "repos/$REPO/issues/$TRACKER_ISSUE/comments?per_page=100" --slurp | jq 'add')"
owner_exact="$(jq -c --arg body "$command" '[.[] | select(.user.login == "jratdish1" and .body == $body)]' <<<"$comments")"
unconsumed='[]'
while IFS= read -r candidate_id; do
  [[ "$candidate_id" =~ ^[0-9]+$ ]] || continue
  correlation="issue-43-comment-$candidate_id"
  consumed_count="$(jq -r --arg correlation "$correlation" '[.[] | select(
    .user.login == "github-actions[bot]" and
    (.body | startswith("VETS_DEPLOY_CONSUMED v1\n")) and
    (.body | contains("correlation_id: " + $correlation + "\n"))
  )] | length' <<<"$comments")"
  if [ "$consumed_count" = '0' ]; then
    candidate="$(jq -c --argjson id "$candidate_id" '.[] | select(.id == $id)' <<<"$owner_exact")"
    unconsumed="$(jq -c --argjson item "$candidate" '. + [$item]' <<<"$unconsumed")"
  fi
done < <(jq -r '.[].id' <<<"$owner_exact")
unconsumed_count="$(jq -r 'length' <<<"$unconsumed")"
case "$unconsumed_count" in
  0)
    command_comment="$(gh api "repos/$REPO/issues/$TRACKER_ISSUE/comments" -f body="$command")"
    ;;
  1)
    command_comment="$(jq -c '.[0]' <<<"$unconsumed")"
    ;;
  *)
    echo "BLOCKED: multiple unconsumed exact owner deployment commands exist" >&2
    exit 74
    ;;
esac
comment_id="$(jq -r '.id' <<<"$command_comment")"
[[ "$comment_id" =~ ^[0-9]+$ ]]
printf 'VETS_OWNER_COMMAND_COMMENT_ID=%s\n' "$comment_id"
printf 'VETS_OWNER_COMMAND_POSTED=true\n'
'''

patched, count = pattern.subn(lambda _: replacement, source)
if count != 1:
    raise SystemExit(f"expected exactly one owner-command block, patched {count}")
if "multiple unconsumed exact owner deployment commands" not in patched:
    raise SystemExit("consumption-aware retry guard was not installed")
if "gh api --paginate" not in patched:
    raise SystemExit("complete Issue ledger pagination was lost")
Path(sys.argv[2]).write_text(patched)
