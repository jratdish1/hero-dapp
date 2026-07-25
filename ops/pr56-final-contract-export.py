#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.request import Request, urlopen

REPO = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GH_TOKEN"]
DEPLOY = Path(".github/workflows/deploy.yml")
COMMAND = Path(".github/workflows/vets-production-command.yml")
DOCS = Path("DEPLOY_INSTRUCTIONS.md")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def validate_bash(path: Path) -> int:
    text = path.read_text()
    lines = text.splitlines()
    expression = re.compile(r"\$\{\{.*?\}\}")
    index = 0
    count = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if stripped not in {"run: |", "run: |-"}:
            index += 1
            continue
        count += 1
        index += 1
        block: list[str] = []
        while index < len(lines):
            candidate = lines[index]
            candidate_indent = len(candidate) - len(candidate.lstrip())
            if candidate.strip() and candidate_indent <= indent:
                break
            block.append(candidate[indent + 2 :] if candidate.strip() else "")
            index += 1
        result = subprocess.run(
            ["bash", "-n"],
            input=expression.sub("VALUE", "\n".join(block) + "\n"),
            text=True,
            capture_output=True,
            check=False,
        )
        if result.returncode:
            raise RuntimeError(f"{path}: Bash block {count}: {result.stderr}")
    return count


def create_blob(content: bytes) -> str:
    payload = json.dumps(
        {"content": base64.b64encode(content).decode(), "encoding": "base64"}
    ).encode()
    request = Request(
        f"https://api.github.com/repos/{REPO}/git/blobs",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "VETS-PR56-Final-Contract-Exporter",
        },
    )
    with urlopen(request, timeout=60) as response:
        sha = json.loads(response.read())["sha"]
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise RuntimeError("GitHub returned an invalid blob SHA")
    return sha


def main() -> None:
    deploy = DEPLOY.read_text()
    command = COMMAND.read_text()
    docs = DOCS.read_text()

    old_filter = '.head_sha == $sha and .head_branch == "main" and .event == "push"'
    new_filter = (
        '.head_sha == $sha and .head_branch == "main" and .event == "push" '
        'and .run_attempt == 1'
    )
    deploy = replace_once(deploy, old_filter, new_filter, "deploy run-attempt gate")
    command = replace_once(command, old_filter, new_filter, "command run-attempt gate")

    old_comments = '''          comments="$(api_get \\
            "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$TRACKER_ISSUE/comments?per_page=100")"
'''
    new_comments = '''          collect_issue_comments() {
            local page=1 response count exhausted=false
            : > "$RUNNER_TEMP/command-issue-comments.jsonl"
            while [ "$page" -le 200 ]; do
              response="$(api_get \\
                "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$TRACKER_ISSUE/comments?per_page=100&page=$page")"
              jq -c '.' <<<"$response" >> "$RUNNER_TEMP/command-issue-comments.jsonl"
              count="$(jq -r 'length' <<<"$response")"
              if [ "$count" -lt 100 ]; then
                exhausted=true
                break
              fi
              page=$((page + 1))
            done
            test "$exhausted" = "true"
            jq -s 'add // []' "$RUNNER_TEMP/command-issue-comments.jsonl"
          }

          comments="$(collect_issue_comments)"
'''
    command = replace_once(
        command, old_comments, new_comments, "owner-command exhaustive ledger scan"
    )

    docs = replace_once(
        docs,
        """- exact target `push` CI and repository-safety workflow/job success;
- preservation of the exact selected CI and Security workflow run IDs in the authorization marker, immutable result, and final receipt;
""",
        """- exact target `push` CI and repository-safety workflow/job success;
- only first-attempt CI and Security workflow runs qualify; successful reruns never authorize production;
- preservation of the exact selected CI and Security workflow run IDs in the authorization marker, immutable result, and final receipt;
""",
        "documentation first-attempt evidence",
    )
    docs = replace_once(
        docs,
        """- Deploy and rollback correlations remain single-use and fail closed on duplicate exact authorization markers.
""",
        """- Deploy and rollback correlations remain single-use and fail closed on duplicate exact authorization markers.
- Both the owner-command preflight and reusable authorization scan the Issue #43 ledger to exhaustion and fail closed at the bounded safety ceiling.
""",
        "documentation exhaustive ledger evidence",
    )

    output_dir = Path("pr56-contract-output")
    output_dir.mkdir(exist_ok=True)
    outputs = {
        "deploy.yml": deploy,
        "vets-production-command.yml": command,
        "DEPLOY_INSTRUCTIONS.md": docs,
    }
    for name, text in outputs.items():
        (output_dir / name).write_text(text)

    for name in ("deploy.yml", "vets-production-command.yml"):
        subprocess.run(
            ["ruby", "-e", 'require "yaml"; YAML.load_file(ARGV[0])', str(output_dir / name)],
            check=True,
        )

    bash_counts = {
        name: validate_bash(output_dir / name)
        for name in ("deploy.yml", "vets-production-command.yml")
    }

    forbidden = set("\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069")
    credential = re.compile(
        r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{20,}|"
        r"sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}"
    )
    for name, text in outputs.items():
        if any(char in forbidden for char in text):
            raise RuntimeError(f"{name}: hidden or bidirectional Unicode found")
        if credential.search(text):
            raise RuntimeError(f"{name}: credential pattern found")

    if deploy.count(".run_attempt == 1") < 2:
        raise RuntimeError("deploy evidence still accepts workflow reruns")
    if command.count(".run_attempt == 1") < 2:
        raise RuntimeError("owner-command evidence still accepts workflow reruns")
    if 'test "$exhausted" = "true"' not in command:
        raise RuntimeError("owner-command ledger scan does not fail closed")
    if "timeout-minutes: 120" not in deploy or "timeout-minutes: 75" in deploy:
        raise RuntimeError("protected recovery time budget regressed")

    blobs = {name: create_blob(text.encode()) for name, text in outputs.items()}
    receipt = {
        "source_head": os.environ["GITHUB_SHA"],
        "blobs": blobs,
        "bash_blocks": bash_counts,
        "validation": "PASS",
    }
    Path("pr56-contract-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt, sort_keys=True))


if __name__ == "__main__":
    main()
