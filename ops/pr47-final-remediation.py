#!/usr/bin/env python3
from pathlib import Path
import subprocess

DEPLOY = Path('.github/workflows/deploy.yml')
COMMAND = Path('.github/workflows/vets-production-command.yml')
SELF = Path('ops/pr47-final-remediation.py')
WORKFLOW = Path('.github/workflows/apply-pr47-final-remediation.yml')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def validate_bash_blocks(path: Path) -> None:
    lines = path.read_text().splitlines()
    index = 0
    block_number = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if stripped == 'run: |':
            block_number += 1
            index += 1
            block = []
            while index < len(lines):
                candidate = lines[index]
                if candidate.strip() and len(candidate) - len(candidate.lstrip()) <= indent:
                    break
                if candidate.strip():
                    block.append(candidate[indent + 2 :])
                else:
                    block.append('')
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
    '          test "$GITHUB_REPOSITORY" = "jratdish1/hero-dapp"\n'
    '          test "$GITHUB_REF" = "refs/heads/main"\n',
    '          test "$GITHUB_REPOSITORY" = "jratdish1/hero-dapp"\n'
    '          test "$GITHUB_RUN_ATTEMPT" = "1"\n'
    '          test "$GITHUB_REF" = "refs/heads/main"\n',
    'protected deployment run-attempt validation',
)
deploy = replace_once(
    deploy,
    '      - name: Record inline rollback succeeded\n'
    "        if: always() && steps.deploy_app.outputs.inline_rollback_succeeded == 'true'\n"
    '        run: echo "Inline deployment rollback restored the previous exact SHA"\n',
    '      - name: Record inline rollback attempted\n'
    "        if: always() && steps.deploy_app.outputs.inline_rollback_attempted == 'true'\n"
    '        run: echo "Inline deployment rollback was attempted"\n\n'
    '      - name: Record inline rollback succeeded\n'
    "        if: always() && steps.deploy_app.outputs.inline_rollback_succeeded == 'true'\n"
    '        run: echo "Inline deployment rollback restored the previous exact SHA"\n',
    'attempted-only inline rollback marker',
)
DEPLOY.write_text(deploy)

command = COMMAND.read_text()
command = replace_once(
    command,
    'concurrency:\n'
    '  group: vets-production-command\n'
    '  cancel-in-progress: false\n\n',
    '',
    'remove workflow-level comment concurrency',
)
command = replace_once(
    command,
    "      startsWith(github.event.comment.body, 'VETS DEPLOY ')\n"
    '    runs-on: ubuntu-latest\n',
    "      startsWith(github.event.comment.body, 'VETS DEPLOY ')\n"
    '    concurrency:\n'
    '      group: vets-production-command\n'
    '      cancel-in-progress: false\n'
    '    runs-on: ubuntu-latest\n',
    'eligible-job concurrency',
)
command = replace_once(
    command,
    '        run: |\n'
    '          set -euo pipefail\n'
    '          dispatch_epoch="$(date -u +%s)"\n'
    '          payload="$(jq -nc \\\n'
    '            --arg sha "$TARGET_SHA" \\\n'
    '            --arg correlation "$CORRELATION_ID" \\\n'
    "            '{ref:\"main\",inputs:{commit_sha:$sha,correlation_id:$correlation,confirmation:\"DEPLOY\"}}')"\n",
    '        run: |\n'
    '          set -euo pipefail\n'
    '          main_sha="$(curl --fail-with-body --silent --show-error \\\n'
    '            -H "Authorization: Bearer $GH_TOKEN" \\\n'
    '            -H "Accept: application/vnd.github+json" \\\n'
    '            -H "X-GitHub-Api-Version: 2022-11-28" \\\n'
    '            "https://api.github.com/repos/$GITHUB_REPOSITORY/git/ref/heads/main" \\\n'
    "            | jq -r '.object.sha')"\n"
    '          test "$main_sha" = "$TARGET_SHA"\n'
    '          dispatch_epoch="$(date -u +%s)"\n'
    '          payload="$(jq -nc \\\n'
    '            --arg sha "$TARGET_SHA" \\\n'
    '            --arg correlation "$CORRELATION_ID" \\\n'
    "            '{ref:\"main\",inputs:{commit_sha:$sha,correlation_id:$correlation,confirmation:\"DEPLOY\"}}')"\n",
    'immediate pre-POST main recheck',
)
command = replace_once(
    command,
    '      - name: Post deployment-start receipt\n'
    '        env:\n',
    '      - name: Post deployment-start receipt\n'
    '        id: start_receipt\n'
    '        continue-on-error: true\n'
    '        env:\n',
    'non-blocking start receipt',
)
command = replace_once(
    command,
    '      - name: Monitor protected deployment\n'
    '        id: monitor\n'
    '        env:\n',
    '      - name: Monitor protected deployment\n'
    '        id: monitor\n'
    "        if: always() && steps.locate.outputs.run_id != ''\n"
    '        env:\n',
    'monitor after start-receipt failure',
)
command = replace_once(
    command,
    '          inline_success_conclusion="$(step_conclusion \'Record inline rollback succeeded\')"\n',
    '          inline_attempted_conclusion="$(step_conclusion \'Record inline rollback attempted\')"\n'
    '          inline_success_conclusion="$(step_conclusion \'Record inline rollback succeeded\')"\n',
    'read attempted-only rollback marker',
)
command = replace_once(
    command,
    '          inline_rollback_attempted=false\n'
    '          inline_rollback_succeeded=false\n'
    '          inline_rollback_failed=false\n'
    '          if [ "$inline_success_conclusion" = "success" ]; then\n'
    '            inline_rollback_attempted=true\n'
    '            inline_rollback_succeeded=true\n'
    '          fi\n',
    '          inline_rollback_attempted=false\n'
    '          inline_rollback_succeeded=false\n'
    '          inline_rollback_failed=false\n'
    '          if [ "$inline_attempted_conclusion" = "success" ]; then\n'
    '            inline_rollback_attempted=true\n'
    '          fi\n'
    '          if [ "$inline_success_conclusion" = "success" ]; then\n'
    '            inline_rollback_attempted=true\n'
    '            inline_rollback_succeeded=true\n'
    '          fi\n',
    'preserve attempted-only rollback state',
)
command = replace_once(
    command,
    '            echo "- Run conclusion: **${RUN_CONCLUSION:-unknown}**"\n',
    '            echo "- Run conclusion: **${RUN_CONCLUSION:-unknown}**"\n'
    '            echo "- Start receipt step outcome: **${{ steps.start_receipt.outcome }}**"\n',
    'receipt start-comment outcome',
)
COMMAND.write_text(command)

validate_bash_blocks(DEPLOY)
validate_bash_blocks(COMMAND)
subprocess.run(['git', 'diff', '--check'], check=True)

SELF.unlink()
WORKFLOW.unlink()
print('PR47 final remediation applied and validated')
