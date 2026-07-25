#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
import re
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GH_TOKEN"]
PR_NUMBER = os.environ["PR_NUMBER"]
DEPLOY = Path(".github/workflows/deploy.yml")
COMMAND = Path(".github/workflows/vets-production-command.yml")
DOCS = Path("DEPLOY_INSTRUCTIONS.md")
OUTPUT = Path("pr57-output")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def github_request(method: str, path: str, payload: dict | None = None) -> dict:
    body = None if payload is None else json.dumps(payload).encode()
    request = Request(
        f"https://api.github.com/repos/{REPO}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "VETS-PR57-Finalizer",
        },
    )
    last: Exception | None = None
    for attempt in range(1, 6):
        try:
            with urlopen(request, timeout=60) as response:
                raw = response.read()
            return {} if not raw else json.loads(raw)
        except (HTTPError, URLError, TimeoutError) as exc:
            last = exc
            if method == "POST" and path.startswith("/issues/"):
                break
            time.sleep(attempt * 2)
    raise RuntimeError(f"GitHub API failed: {method} {path}: {last}")


def create_blob(content: bytes) -> str:
    result = github_request(
        "POST",
        "/git/blobs",
        {"content": base64.b64encode(content).decode(), "encoding": "base64"},
    )
    sha = result.get("sha", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise RuntimeError("GitHub returned an invalid blob SHA")
    return sha


def bash_blocks(path: Path) -> int:
    lines = path.read_text().splitlines()
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


def main() -> None:
    if REPO != "jratdish1/hero-dapp":
        raise RuntimeError("wrong repository")
    if not PR_NUMBER.isdigit():
        raise RuntimeError("invalid pull request number")

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
            local page=1 response count
            : > "$RUNNER_TEMP/command-issue-comments.jsonl"
            while :; do
              [ "$page" -le 10000 ] || {
                echo "Issue comment pagination exceeded fail-closed bound" >&2
                return 74
              }
              response="$(api_get \\
                "https://api.github.com/repos/$GITHUB_REPOSITORY/issues/$TRACKER_ISSUE/comments?per_page=100&page=$page")"
              jq -c '.' <<<"$response" >> "$RUNNER_TEMP/command-issue-comments.jsonl"
              count="$(jq -r 'length' <<<"$response")"
              [ "$count" -lt 100 ] && break
              page=$((page + 1))
            done
            jq -s 'add' "$RUNNER_TEMP/command-issue-comments.jsonl"
          }

          comments="$(collect_issue_comments)"
'''
    command = replace_once(
        command,
        old_comments,
        new_comments,
        "owner-command exhaustive correlation scan",
    )

    docs = replace_once(
        docs,
        """- Correlation lookup paginates the complete Issue #43 ledger and fails closed if the ledger cannot be exhausted safely.
""",
        """- Both the owner-command preflight and reusable authorization paginate the complete Issue #43 ledger and fail closed if the ledger cannot be exhausted safely.
""",
        "documentation complete-ledger scope",
    )
    docs = replace_once(
        docs,
        """- exact target `push` CI and repository-safety workflow/job success;
- preservation of the exact authorizing CI and Security workflow run IDs in the consumption record, final Issue receipt, and immutable result;
""",
        """- exact target `push` CI and repository-safety workflow/job success;
- only first-attempt CI and Security workflow runs qualify; successful reruns never authorize production;
- preservation of the exact authorizing CI and Security workflow run IDs in the consumption record, final Issue receipt, and immutable result;
""",
        "documentation first-attempt evidence",
    )

    OUTPUT.mkdir(exist_ok=True)
    outputs = {
        "deploy.yml": deploy,
        "vets-production-command.yml": command,
        "DEPLOY_INSTRUCTIONS.md": docs,
    }
    for name, text in outputs.items():
        (OUTPUT / name).write_text(text)

    for name in ("deploy.yml", "vets-production-command.yml"):
        subprocess.run(
            ["ruby", "-e", 'require "yaml"; YAML.load_file(ARGV[0])', str(OUTPUT / name)],
            check=True,
        )

    bash_counts = {
        name: bash_blocks(OUTPUT / name)
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

    if new_filter not in deploy or new_filter not in command:
        raise RuntimeError("first-attempt release evidence gate is absent")
    if "timeout-minutes: 120" not in deploy or "timeout-minutes: 75" in deploy:
        raise RuntimeError("protected rollback time budget regressed")
    if 'Issue comment pagination exceeded fail-closed bound' not in command:
        raise RuntimeError("owner-command correlation scan does not fail closed")
    if "VETS_MUTATION_STARTED=true" not in deploy:
        raise RuntimeError("mutation-start recovery evidence regressed")
    if 'test "$RECEIPT_POSTED" = "true"' not in deploy:
        raise RuntimeError("durable receipt enforcement regressed")

    blobs = {name: create_blob(text.encode()) for name, text in outputs.items()}
    receipt = {
        "source_sha": os.environ["GITHUB_SHA"],
        "blobs": blobs,
        "bash_blocks": bash_counts,
        "validation": "PASS",
    }
    (OUTPUT / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")

    comment = "\n".join(
        [
            "VETS_PR57_BLOBS v1",
            f"source_sha: {receipt['source_sha']}",
            f"deploy_blob: {blobs['deploy.yml']}",
            f"command_blob: {blobs['vets-production-command.yml']}",
            f"docs_blob: {blobs['DEPLOY_INSTRUCTIONS.md']}",
            f"deploy_bash_blocks: {bash_counts['deploy.yml']}",
            f"command_bash_blocks: {bash_counts['vets-production-command.yml']}",
            "validation: PASS",
        ]
    )
    github_request("POST", f"/issues/{PR_NUMBER}/comments", {"body": comment})
    print(comment)


if __name__ == "__main__":
    main()
