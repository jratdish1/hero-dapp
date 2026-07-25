#!/usr/bin/env python3
from pathlib import Path
import subprocess

DEPLOY = Path('.github/workflows/deploy.yml')
COMMAND = Path('.github/workflows/vets-production-command.yml')
SELF = Path('ops/pr47-final-remediation.py')
WORKFLOW = Path('.github/workflows/apply-pr47-final-remediation.yml')
BS = '\\'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def lines(*items: str) -> str:
    return '\n'.join(items) + '\n'


def validate_bash_blocks(path: Path) -> None:
    source_lines = path.read_text().splitlines()
    index = 0
    block_number = 0
    while index < len(source_lines):
        line = source_lines[index]
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if stripped == 'run: |':
            block_number += 1
            index += 1
            block = []
            while index < len(source_lines):
                candidate = source_lines[index]
                if candidate.strip() and len(candidate) - len(candidate.lstrip()) <= indent:
                    break
                block.append(candidate[indent + 2 :] if candidate.strip() else '')
                index += 1
            result = subprocess.run(
                ['bash', '-n'],
                input='\n'.join(block) + '\n',
                text=True,
                capture_output=True,
            )
            if result.returncode != 0:
                raise SystemExit(
                    f'{path}: run block {block_number} failed bash -n:\n{result.stderr}'
                )
            continue
        index += 1


deploy = DEPLOY.read_text()
deploy = replace_once(
    deploy,
    "    if: github.ref == 'refs/heads/main'\n",
    "    if: github.ref == 'refs/heads/main' && github.run_attempt == 1\n",
    'protected deployment rerun guard',
)
deploy = replace_once(
    deploy,
    lines(
        '          test "$GITHUB_REPOSITORY" = "jratdish1/hero-dapp"',
        '          test "$GITHUB_REF" = "refs/heads/main"',
    ),
    lines(
        '          test "$GITHUB_REPOSITORY" = "jratdish1/hero-dapp"',
        '          test "$GITHUB_RUN_ATTEMPT" = "1"',
        '          test "$GITHUB_REF" = "refs/heads/main"',
    ),
    'protected deployment run-attempt validation',
)
deploy = replace_once(
    deploy,
    lines(
        '      - name: Record inline rollback succeeded',
        "        if: always() && steps.deploy_app.outputs.inline_rollback_succeeded == 'true'",
        '        run: echo "Inline deployment rollback restored the previous exact SHA"',
    ),
    lines(
        '      - name: Record inline rollback attempted',
        "        if: always() && steps.deploy_app.outputs.inline_rollback_attempted == 'true'",
        '        run: echo "Inline deployment rollback was attempted"',
        '',
        '      - name: Record inline rollback succeeded',
        "        if: always() && steps.deploy_app.outputs.inline_rollback_succeeded == 'true'",
        '        run: echo "Inline deployment rollback restored the previous exact SHA"',
    ),
    'attempted-only inline rollback marker',
)
DEPLOY.write_text(deploy)

command = COMMAND.read_text()
command = replace_once(
    command,
    lines(
        'concurrency:',
        '  group: vets-production-command',
        '  cancel-in-progress: false',
        '',
    ),
    '',
    'remove workflow-level comment concurrency',
)
command = replace_once(
    command,
    lines(
        "      startsWith(github.event.comment.body, 'VETS DEPLOY ')",
        '    runs-on: ubuntu-latest',
    ),
    lines(
        "      startsWith(github.event.comment.body, 'VETS DEPLOY ')",
        '    concurrency:',
        '      group: vets-production-command',
        '      cancel-in-progress: false',
        '    runs-on: ubuntu-latest',
    ),
    'eligible-job concurrency',
)

old_dispatch = lines(
    '        run: |',
    '          set -euo pipefail',
    '          dispatch_epoch="$(date -u +%s)"',
    '          payload="$(jq -nc ' + BS,
    '            --arg sha "$TARGET_SHA" ' + BS,
    '            --arg correlation "$CORRELATION_ID" ' + BS,
    "            '{ref:\"main\",inputs:{commit_sha:$sha,correlation_id:$correlation,confirmation:\"DEPLOY\"}}')\"",
)
new_dispatch = lines(
    '        run: |',
    '          set -euo pipefail',
    '          main_sha="$(curl --fail-with-body --silent --show-error ' + BS,
    '            -H "Authorization: Bearer $GH_TOKEN" ' + BS,
    '            -H "Accept: application/vnd.github+json" ' + BS,
    '            -H "X-GitHub-Api-Version: 2022-11-28" ' + BS,
    '            "https://api.github.com/repos/$GITHUB_REPOSITORY/git/ref/heads/main" ' + BS,
    "            | jq -r '.object.sha')\"",
    '          test "$main_sha" = "$TARGET_SHA"',
    '          dispatch_epoch="$(date -u +%s)"',
    '          payload="$(jq -nc ' + BS,
    '            --arg sha "$TARGET_SHA" ' + BS,
    '            --arg correlation "$CORRELATION_ID" ' + BS,
    "            '{ref:\"main\",inputs:{commit_sha:$sha,correlation_id:$correlation,confirmation:\"DEPLOY\"}}')\"",
)
command = replace_once(
    command,
    old_dispatch,
    new_dispatch,
    'immediate pre-POST main recheck',
)
command = replace_once(
    command,
    lines(
        '      - name: Post deployment-start receipt',
        '        env:',
    ),
    lines(
        '      - name: Post deployment-start receipt',
        '        id: start_receipt',
        '        continue-on-error: true',
        '        env:',
    ),
    'non-blocking start receipt',
)
command = replace_once(
    command,
    lines(
        '      - name: Monitor protected deployment',
        '        id: monitor',
        '        env:',
    ),
    lines(
        '      - name: Monitor protected deployment',
        '        id: monitor',
        "        if: always() && steps.locate.outputs.run_id != ''",
        '        env:',
    ),
    'monitor after start-receipt failure',
)
command = replace_once(
    command,
    '          inline_success_conclusion="$(step_conclusion \'Record inline rollback succeeded\')"\n',
    lines(
        '          inline_attempted_conclusion="$(step_conclusion \'Record inline rollback attempted\')"',
        '          inline_success_conclusion="$(step_conclusion \'Record inline rollback succeeded\')"',
    ),
    'read attempted-only rollback marker',
)
command = replace_once(
    command,
    lines(
        '          inline_rollback_attempted=false',
        '          inline_rollback_succeeded=false',
        '          inline_rollback_failed=false',
        '          if [ "$inline_success_conclusion" = "success" ]; then',
        '            inline_rollback_attempted=true',
        '            inline_rollback_succeeded=true',
        '          fi',
    ),
    lines(
        '          inline_rollback_attempted=false',
        '          inline_rollback_succeeded=false',
        '          inline_rollback_failed=false',
        '          if [ "$inline_attempted_conclusion" = "success" ]; then',
        '            inline_rollback_attempted=true',
        '          fi',
        '          if [ "$inline_success_conclusion" = "success" ]; then',
        '            inline_rollback_attempted=true',
        '            inline_rollback_succeeded=true',
        '          fi',
    ),
    'preserve attempted-only rollback state',
)
command = replace_once(
    command,
    '            echo "- Run conclusion: **${RUN_CONCLUSION:-unknown}**"\n',
    lines(
        '            echo "- Run conclusion: **${RUN_CONCLUSION:-unknown}**"',
        '            echo "- Start receipt step outcome: **${{ steps.start_receipt.outcome }}**"',
    ),
    'receipt start-comment outcome',
)
COMMAND.write_text(command)

validate_bash_blocks(DEPLOY)
validate_bash_blocks(COMMAND)
subprocess.run(['git', 'diff', '--check'], check=True)

SELF.unlink()
WORKFLOW.unlink()
print('PR47 final remediation applied and validated')
