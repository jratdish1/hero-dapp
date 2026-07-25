#!/usr/bin/env python3
from __future__ import annotations

import base64, json, os, re, subprocess, sys, time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO=os.environ['GITHUB_REPOSITORY']; TOKEN=os.environ['GH_TOKEN']; HEAD=os.environ['APPLY_HEAD_SHA']
OWNER=os.environ['GITHUB_REPOSITORY_OWNER']; BRANCH='fix/production-controller-final-evidence-20260725'
API=f'https://api.github.com/repos/{REPO}'
DEPLOY=Path('.github/workflows/deploy.yml'); DOCS=Path('DEPLOY_INSTRUCTIONS.md')
SELF=Path('ops/pr56-finalize.py'); WORKFLOW=Path('.github/workflows/apply-pr56-finalize.yml'); TRIGGER=Path('ops/pr56-finalize.trigger')

def api(method,path,payload=None):
    body=None if payload is None else json.dumps(payload).encode(); url=path if path.startswith('https://') else API+path
    headers={'Authorization':f'Bearer {TOKEN}','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'VETS-PR56-Finalizer'}
    if body is not None: headers['Content-Type']='application/json'
    last=None
    for attempt in range(1,6):
        try:
            with urlopen(Request(url,data=body,headers=headers,method=method),timeout=60) as r: raw=r.read()
            return {} if not raw else json.loads(raw)
        except (HTTPError,URLError,TimeoutError) as exc:
            last=exc; print(f'API retry {attempt}/5: {method} {url}: {exc}',file=sys.stderr); time.sleep(attempt*2)
    raise RuntimeError(f'GitHub API failed: {last}')

def once(text,old,new,label):
    count=text.count(old)
    if count!=1: raise RuntimeError(f'{label}: expected 1 match, found {count}')
    return text.replace(old,new,1)

def bash_blocks(path):
    lines=path.read_text().splitlines(); expr=re.compile(r'\$\{\{.*?\}\}'); i=0; count=0
    while i<len(lines):
        line=lines[i]; stripped=line.lstrip(); indent=len(line)-len(stripped)
        if stripped not in {'run: |','run: |-'}: i+=1; continue
        count+=1; i+=1; block=[]
        while i<len(lines):
            candidate=lines[i]; ci=len(candidate)-len(candidate.lstrip())
            if candidate.strip() and ci<=indent: break
            block.append(candidate[indent+2:] if candidate.strip() else ''); i+=1
        result=subprocess.run(['bash','-n'],input=expr.sub('VALUE','\n'.join(block)+'\n'),text=True,capture_output=True)
        if result.returncode: raise RuntimeError(f'{path}: Bash block {count}: {result.stderr}')
    return count

def blob(data):
    sha=api('POST','/git/blobs',{'content':base64.b64encode(data).decode(),'encoding':'base64'})['sha']
    if not re.fullmatch(r'[0-9a-f]{40}',sha): raise RuntimeError('invalid blob sha')
    return sha

def patch_deploy(s):
    s=once(s,'''    outputs:\n      consumption_comment_id: ${{ steps.authorization.outputs.consumption_comment_id }}\n      authorization_mode: ${{ steps.authorization.outputs.authorization_mode }}\n''','''    outputs:\n      consumption_comment_id: ${{ steps.authorization.outputs.consumption_comment_id }}\n      authorization_mode: ${{ steps.authorization.outputs.authorization_mode }}\n      ci_run_id: ${{ steps.authorization.outputs.ci_run_id }}\n      security_run_id: ${{ steps.authorization.outputs.security_run_id }}\n''','authorize run-id outputs')
    s=once(s,'''          collect_issue_comments() {\n            local page response\n            : > "$RUNNER_TEMP/issue-comments.jsonl"\n            for page in $(seq 1 20); do\n              response="$(api_get \\\n                "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$TRACKER_ISSUE/comments?per_page=100&page=$page")"\n              jq -c '.' <<<"$response" >> "$RUNNER_TEMP/issue-comments.jsonl"\n              [ "$(jq -r 'length' <<<"$response")" -lt 100 ] && break\n            done\n            jq -s 'add' "$RUNNER_TEMP/issue-comments.jsonl"\n          }\n''','''          collect_issue_comments() {\n            local page=1 response count exhausted=false\n            : > "$RUNNER_TEMP/issue-comments.jsonl"\n            while [ "$page" -le 200 ]; do\n              response="$(api_get \\\n                "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$TRACKER_ISSUE/comments?per_page=100&page=$page")"\n              jq -c '.' <<<"$response" >> "$RUNNER_TEMP/issue-comments.jsonl"\n              count="$(jq -r 'length' <<<"$response")"\n              if [ "$count" -lt 100 ]; then\n                exhausted=true\n                break\n              fi\n              page=$((page + 1))\n            done\n            test "$exhausted" = "true"\n            jq -s 'add // []' "$RUNNER_TEMP/issue-comments.jsonl"\n          }\n''','exhaustive pagination')
    s=once(s,'''            jq -e --arg name "$required_job" '\n              [.jobs[] | select(.name == $name)]\n              | if length == 0 then false\n                else (max_by(.id) | .status == "completed" and .conclusion == "success")\n                end\n            ' <<<"$jobs" >/dev/null\n          }\n\n          all_comments="$(collect_issue_comments)"\n''','''            jq -e --arg name "$required_job" '\n              [.jobs[] | select(.name == $name)]\n              | if length == 0 then false\n                else (max_by(.id) | .status == "completed" and .conclusion == "success")\n                end\n            ' <<<"$jobs" >/dev/null\n            printf '%s' "$run_id"\n          }\n\n          ci_run_id="$(require_workflow_run ci.yml test-build-scan)"\n          security_run_id="$(require_workflow_run security-and-quality.yml repository-safety)"\n          [[ "$ci_run_id" =~ ^[0-9]+$ ]]\n          [[ "$security_run_id" =~ ^[0-9]+$ ]]\n          all_comments="$(collect_issue_comments)"\n''','capture exact workflow ids')
    s=once(s,'''                "command_run_id: $COMMAND_RUN_ID" \\\n                "target_sha: $DEPLOY_SHA" \\\n''','''                "command_run_id: $COMMAND_RUN_ID" \\\n                "ci_run_id: $ci_run_id" \\\n                "security_run_id: $security_run_id" \\\n                "target_sha: $DEPLOY_SHA" \\\n''','deploy marker run ids')
    s=once(s,'''                "deployment_run_id: $GITHUB_RUN_ID" \\\n                "target_sha: $DEPLOY_SHA" \\\n''','''                "deployment_run_id: $GITHUB_RUN_ID" \\\n                "ci_run_id: $ci_run_id" \\\n                "security_run_id: $security_run_id" \\\n                "target_sha: $DEPLOY_SHA" \\\n''','rollback marker run ids')
    s=once(s,'''          require_workflow_run ci.yml test-build-scan\n          require_workflow_run security-and-quality.yml repository-safety\n\n          response="$(api_post_once \\\n            "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$TRACKER_ISSUE/comments" \\\n            "$(jq -nc --arg body "$consumption_body" '{body:$body}')")"\n          consumption_comment_id="$(jq -r '.id' <<<"$response")"\n          [[ "$consumption_comment_id" =~ ^[0-9]+$ ]]\n          echo "consumption_comment_id=$consumption_comment_id" >> "$GITHUB_OUTPUT"\n          echo "authorization_mode=$authorization_mode" >> "$GITHUB_OUTPUT"\n''','''          exact_marker_matches() {\n            local comments="$1"\n            jq -c --arg body "$consumption_body" '[.[] | select(\n              .user.login == "github-actions[bot]" and .body == $body\n            )]' <<<"$comments"\n          }\n\n          wait_for_exact_marker() {\n            local attempts="$1" comments matches count\n            for attempt in $(seq 1 "$attempts"); do\n              comments="$(collect_issue_comments)"\n              matches="$(exact_marker_matches "$comments")"\n              count="$(jq -r 'length' <<<"$matches")"\n              if [ "$count" = "1" ]; then\n                jq -c '.[0]' <<<"$matches"\n                return 0\n              fi\n              if [ "$count" -gt 1 ]; then\n                echo "Duplicate exact authorization markers found" >&2\n                return 2\n              fi\n              sleep $((attempt * 2))\n            done\n            return 1\n          }\n\n          initial_matches="$(exact_marker_matches "$all_comments")"\n          test "$(jq -r 'length' <<<"$initial_matches")" = "0"\n          payload="$(jq -nc --arg body "$consumption_body" '{body:$body}')"\n          set +e\n          response="$(api_post_once \\\n            "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$TRACKER_ISSUE/comments" \\\n            "$payload")"\n          first_status=$?\n          set -e\n          if [ "$first_status" -ne 0 ]; then\n            if ! marker="$(wait_for_exact_marker 3)"; then\n              set +e\n              api_post_once \\\n                "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$TRACKER_ISSUE/comments" \\\n                "$payload" >/dev/null\n              retry_status=$?\n              set -e\n              if [ "$retry_status" -ne 0 ]; then\n                echo "Authorization marker retry response was ambiguous; reconciling from Issue evidence" >&2\n              fi\n            fi\n          fi\n          marker="$(wait_for_exact_marker 5)"\n          consumption_comment_id="$(jq -r '.id' <<<"$marker")"\n          [[ "$consumption_comment_id" =~ ^[0-9]+$ ]]\n          echo "consumption_comment_id=$consumption_comment_id" >> "$GITHUB_OUTPUT"\n          echo "authorization_mode=$authorization_mode" >> "$GITHUB_OUTPUT"\n          echo "ci_run_id=$ci_run_id" >> "$GITHUB_OUTPUT"\n          echo "security_run_id=$security_run_id" >> "$GITHUB_OUTPUT"\n''','idempotent authorization marker')
    s=once(s,'''      AUTHORIZATION_MODE: ${{ needs.authorize.outputs.authorization_mode }}\n      CONSUMPTION_COMMENT_ID: ${{ needs.authorize.outputs.consumption_comment_id }}\n      TRACKER_ISSUE: '43'\n''','''      AUTHORIZATION_MODE: ${{ needs.authorize.outputs.authorization_mode }}\n      CONSUMPTION_COMMENT_ID: ${{ needs.authorize.outputs.consumption_comment_id }}\n      CI_RUN_ID: ${{ needs.authorize.outputs.ci_run_id }}\n      SECURITY_RUN_ID: ${{ needs.authorize.outputs.security_run_id }}\n      TRACKER_ISSUE: '43'\n''','deploy authorization ids env')
    s=once(s,'''          [[ "$CONSUMPTION_COMMENT_ID" =~ ^[0-9]+$ ]]\n''','''          [[ "$CONSUMPTION_COMMENT_ID" =~ ^[0-9]+$ ]]\n          [[ "$CI_RUN_ID" =~ ^[0-9]+$ ]]\n          [[ "$SECURITY_RUN_ID" =~ ^[0-9]+$ ]]\n''','validate authorization ids')
    s=once(s,'''          - Consumption comment: \`$CONSUMPTION_COMMENT_ID\`\n          - Mutation started: **${MUTATION_STARTED:-false}**\n''','''          - Consumption comment: \`$CONSUMPTION_COMMENT_ID\`\n          - Authorized CI run: \`$CI_RUN_ID\`\n          - Authorized Security run: \`$SECURITY_RUN_ID\`\n          - Mutation started: **${MUTATION_STARTED:-false}**\n''','receipt authorization ids')
    s=once(s,'''            --arg consumption_comment_id "$CONSUMPTION_COMMENT_ID" \\\n            --arg deploy_outcome "$DEPLOY_OUTCOME" \\\n''','''            --arg consumption_comment_id "$CONSUMPTION_COMMENT_ID" \\\n            --arg ci_run_id "$CI_RUN_ID" \\\n            --arg security_run_id "$SECURITY_RUN_ID" \\\n            --arg deploy_outcome "$DEPLOY_OUTCOME" \\\n''','result authorization id args')
    s=once(s,'''              consumption_comment_id:$consumption_comment_id,\n              mutation_started:$mutation_started,\n''','''              consumption_comment_id:$consumption_comment_id,\n              ci_run_id:$ci_run_id,\n              security_run_id:$security_run_id,\n              mutation_started:$mutation_started,\n''','result authorization id fields')
    s=once(s,'''      - name: Enforce verified production state\n        if: always()\n        env:\n          VERIFIED: ${{ steps.state.outputs.verified }}\n        shell: bash\n        run: test "$VERIFIED" = "true"\n''','''      - name: Enforce verified production state and durable receipt\n        if: always()\n        env:\n          VERIFIED: ${{ steps.state.outputs.verified }}\n          RECEIPT_POSTED: ${{ steps.receipt.outputs.posted }}\n        shell: bash\n        run: |\n          test "$VERIFIED" = "true"\n          test "$RECEIPT_POSTED" = "true"\n''','receipt enforcement')
    return s

def patch_docs(s):
    s=once(s,'''- refuses duplicate deploy or rollback correlations before consuming authorization;\n''','''- paginates the entire Issue #43 comment ledger to exhaustion and fails closed if a bounded safety ceiling is reached;\n- refuses duplicate deploy or rollback correlations before consuming authorization;\n- reconciles an accepted-but-response-lost authorization POST from exact bot-authored Issue evidence before any bounded retry;\n''','docs pagination/idempotency')
    s=once(s,'''- verifies latest successful exact-SHA CI and Security push runs and named jobs;\n- posts the consume/rollback marker only after all authorization gates pass.\n''','''- verifies latest successful exact-SHA CI and Security push runs and named jobs;\n- preserves the exact selected CI and Security workflow run IDs in the authorization marker, immutable result, and final receipt;\n- posts the consume/rollback marker only after all authorization gates pass.\n''','docs run-id evidence')
    s=once(s,'''The final receipt and artifact record whether the receipt post succeeded. A receipt API failure does **not** trigger application rollback after an otherwise exact-SHA-verified deployment; the immutable artifact remains the durable source of truth for application state.\n''','''The final receipt and artifact record whether the receipt post succeeded. A receipt API failure does **not** trigger application rollback after an otherwise exact-SHA-verified deployment, but the workflow remains incomplete until the receipt is durably posted. The immutable artifact remains the source of truth for application state during any receipt-delivery outage.\n''','docs receipt enforcement')
    return s

def validate():
    subprocess.run(['ruby','-e','require "yaml"; YAML.load_file(ARGV[0])',str(DEPLOY)],check=True)
    count=bash_blocks(DEPLOY)
    bidi=set('\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069')
    cred=re.compile(r'BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}')
    for p in (DEPLOY,DOCS):
        t=p.read_text()
        if any(c in bidi for c in t): raise RuntimeError(f'{p}: bidi found')
        if cred.search(t): raise RuntimeError(f'{p}: credential pattern found')
    subprocess.run(['git','diff','--check','--',str(DEPLOY),str(DOCS)],check=True)
    return count

def main():
    if REPO!='jratdish1/hero-dapp' or os.environ.get('GITHUB_HEAD_REF')!=BRANCH: raise RuntimeError('wrong repo/branch')
    commit=api('GET',f'/commits/{HEAD}')
    if commit.get('commit',{}).get('message')!='chore: execute PR56 finalization': raise RuntimeError('wrong trigger')
    if commit.get('author',{}).get('login')!=OWNER: raise RuntimeError('trigger not owner-authored')
    DEPLOY.write_text(patch_deploy(DEPLOY.read_text())); DOCS.write_text(patch_docs(DOCS.read_text()))
    blocks=validate()
    blobs={str(DEPLOY):blob(DEPLOY.read_bytes()),str(DOCS):blob(DOCS.read_bytes())}
    base=api('GET',f'/git/commits/{HEAD}')['tree']['sha']
    entries=[{'path':p,'mode':'100644','type':'blob','sha':sha} for p,sha in blobs.items()]+[
      {'path':str(SELF),'mode':'100644','type':'blob','sha':None},
      {'path':str(WORKFLOW),'mode':'100644','type':'blob','sha':None},
      {'path':str(TRIGGER),'mode':'100644','type':'blob','sha':None},
    ]
    tree=api('POST','/git/trees',{'base_tree':base,'tree':entries})
    child=api('POST','/git/commits',{'message':'fix: finalize production authorization evidence and idempotency','tree':tree['sha'],'parents':[HEAD]})
    final=api('GET',f"/git/trees/{tree['sha']}?recursive=1")
    lookup={e['path']:e.get('sha') for e in final['tree']}
    for p,sha in blobs.items():
        if lookup.get(p)!=sha: raise RuntimeError(f'tree mismatch {p}')
    for p in (str(SELF),str(WORKFLOW),str(TRIGGER)):
        if p in lookup: raise RuntimeError(f'temporary remains {p}')
    body=f'''## VETS PR56 finalization staged\n\nVETS_PR56_STAGED_COMMIT={child['sha']}\nVETS_PR56_STAGED_TREE={tree['sha']}\ndeploy_bash_blocks={blocks}\n\nValidation: YAML PASS; every embedded Bash block PASS; credential-pattern scan PASS; hidden/bidirectional Unicode scan PASS; git diff check PASS. The staged child removes every temporary finalization file and preserves the final three-file scope.'''
    api('POST','/issues/56/comments',{'body':body})
    Path('pr56-finalization-evidence.json').write_text(json.dumps({'trigger_parent':HEAD,'staged_commit':child['sha'],'tree':tree['sha'],'deploy_bash_blocks':blocks,'validation':'PASS','branch_ref_updated':False},indent=2)+'\n')
    print(body)

if __name__=='__main__': main()
