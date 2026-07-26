#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: patch-host-finalizer-v5b.py INPUT OUTPUT")

text = Path(sys.argv[1]).read_text()
start_marker = 'command="VETS DEPLOY $TARGET_SHA"\n'
end_marker = "printf 'VETS_OWNER_COMMAND_POSTED=true\\n'\n"
if text.count(start_marker) != 1:
    raise SystemExit(f"owner command start marker count was {text.count(start_marker)}, expected 1")
if text.count(end_marker) != 1:
    raise SystemExit(f"owner command end marker count was {text.count(end_marker)}, expected 1")
start = text.index(start_marker)
end = text.index(end_marker, start) + len(end_marker)

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
patched = text[:start] + replacement + text[end:]
if patched.count('multiple unconsumed exact owner deployment commands') != 1:
    raise SystemExit('consumption-aware guard was not installed exactly once')
Path(sys.argv[2]).write_text(patched)
