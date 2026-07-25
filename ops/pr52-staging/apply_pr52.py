#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GH_TOKEN"]
OWNER = os.environ["GITHUB_REPOSITORY_OWNER"]
HEAD = os.environ.get("APPLY_HEAD_SHA", os.environ["GITHUB_SHA"])
BRANCH = "fix/production-controller-hardening-20260725"
API = f"https://api.github.com/repos/{REPO}"

EXPECTED = {
    "deploy.yml": "5dd8e30e4e836201a4aab758f20eba34d1f86abbc51dfc2b587cc5122c05d0b8",
    "vets-production-command.yml": "42d1f9931737330dd74f8d26c27a70a95171a547386aebe459000b2022bd0a5b",
    "DEPLOY_INSTRUCTIONS.md": "48941d09e170971ff5d7b71da23c9f91d599f8fc7bf614d65bb18f1e311a57c8",
}

DELETE_PATHS = [
    "ops/PRODUCTION_CONTROLLER_HARDENING_PLAN.md",
    ".github/workflows/apply-pr52-staged.yml",
    ".github/workflows/apply-pr52-staged-v2.yml",
    "ops/pr52-staging/apply_pr52.py",
    "ops/pr52-staging/trigger.txt",
    *[f"ops/pr52-staging/deploy.b64.{n:02d}" for n in range(1, 6)],
    *[f"ops/pr52-staging/command.b64.{n:02d}" for n in range(1, 6)],
    *[f"ops/pr52-staging/instructions.b64.{n:02d}" for n in range(1, 3)],
]


def api(method: str, path: str, payload: object | None = None) -> object:
    body = None if payload is None else json.dumps(payload).encode()
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "VETS-PR52-Applier",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    url = path if path.startswith("https://") else f"{API}{path}"
    last: Exception | None = None
    for attempt in range(1, 6):
        try:
            request = Request(url, data=body, headers=headers, method=method)
            with urlopen(request, timeout=60) as response:
                raw = response.read()
            return {} if not raw else json.loads(raw)
        except (HTTPError, URLError, TimeoutError) as exc:
            last = exc
            print(f"API retry {attempt}/5: {method} {url}: {exc}", file=sys.stderr)
            time.sleep(attempt * 2)
    raise RuntimeError(f"GitHub API failed: {method} {url}: {last}")


def reconstruct(pattern: str, output: Path) -> bytes:
    chunks = sorted(Path("ops/pr52-staging").glob(pattern))
    if not chunks:
        raise RuntimeError(f"No chunks matched {pattern}")
    encoded = "".join(path.read_text().strip() for path in chunks)
    data = base64.b64decode(encoded, validate=True)
    output.write_bytes(data)
    return data


def validate_bash_blocks(path: Path, expected_count: int) -> None:
    lines = path.read_text().splitlines()
    blocks: list[str] = []
    index = 0
    expression = re.compile(r"\$\{\{.*?\}\}")
    while index < len(lines):
        line = lines[index]
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if stripped not in {"run: |", "run: |-"}:
            index += 1
            continue
        index += 1
        block: list[str] = []
        while index < len(lines):
            candidate = lines[index]
            candidate_indent = len(candidate) - len(candidate.lstrip())
            if candidate.strip() and candidate_indent <= indent:
                break
            block.append(candidate[indent + 2 :] if candidate.strip() else "")
            index += 1
        blocks.append("\n".join(block) + "\n")
    if len(blocks) != expected_count:
        raise RuntimeError(f"{path}: expected {expected_count} Bash blocks, found {len(blocks)}")
    for number, block in enumerate(blocks, 1):
        result = subprocess.run(
            ["bash", "-n"],
            input=expression.sub("VALUE", block),
            text=True,
            capture_output=True,
        )
        if result.returncode:
            raise RuntimeError(f"{path}: Bash block {number} failed: {result.stderr}")


def validate_files(files: dict[str, Path]) -> None:
    for name, path in files.items():
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != EXPECTED[name]:
            raise RuntimeError(f"{name}: SHA-256 mismatch: {digest}")

    subprocess.run(
        ["ruby", "-e", 'require "yaml"; ARGV.each { |path| YAML.load_file(path) }',
         str(files["deploy.yml"]), str(files["vets-production-command.yml"])],
        check=True,
    )
    validate_bash_blocks(files["deploy.yml"], 12)
    validate_bash_blocks(files["vets-production-command.yml"], 11)

    bidi = set("\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069")
    credential = re.compile(
        r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{20,}|"
        r"sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}"
    )
    for path in files.values():
        text = path.read_text()
        if any(char in bidi for char in text):
            raise RuntimeError(f"{path}: hidden/bidirectional Unicode found")
        if credential.search(text):
            raise RuntimeError(f"{path}: credential-like content found")


def create_blob(data: bytes) -> str:
    response = api("POST", "/git/blobs", {
        "content": base64.b64encode(data).decode(),
        "encoding": "base64",
    })
    sha = response["sha"]
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise RuntimeError("Invalid blob SHA")
    return sha


def main() -> None:
    if REPO != "jratdish1/hero-dapp":
        raise RuntimeError("Unexpected repository")
    if os.environ.get("GITHUB_HEAD_REF") not in {"", BRANCH, None} and os.environ.get("GITHUB_REF") != f"refs/heads/{BRANCH}":
        raise RuntimeError("Unexpected branch")

    commit = api("GET", f"/commits/{HEAD}")
    if commit.get("commit", {}).get("message") != "chore: execute PR52 exact applier":
        raise RuntimeError("Unexpected trigger message")
    if commit.get("author", {}).get("login") != OWNER:
        raise RuntimeError("Trigger commit was not authored by repository owner")

    work = Path("/tmp/pr52-exact")
    work.mkdir(parents=True, exist_ok=True)
    files = {
        "deploy.yml": work / "deploy.yml",
        "vets-production-command.yml": work / "vets-production-command.yml",
        "DEPLOY_INSTRUCTIONS.md": work / "DEPLOY_INSTRUCTIONS.md",
    }
    reconstruct("deploy.b64.*", files["deploy.yml"])
    reconstruct("command.b64.*", files["vets-production-command.yml"])
    reconstruct("instructions.b64.*", files["DEPLOY_INSTRUCTIONS.md"])
    validate_files(files)

    git_commit = api("GET", f"/git/commits/{HEAD}")
    base_tree = git_commit["tree"]["sha"]
    blobs = {name: create_blob(path.read_bytes()) for name, path in files.items()}

    entries = [
        {"path": ".github/workflows/deploy.yml", "mode": "100644", "type": "blob", "sha": blobs["deploy.yml"]},
        {"path": ".github/workflows/vets-production-command.yml", "mode": "100644", "type": "blob", "sha": blobs["vets-production-command.yml"]},
        {"path": "DEPLOY_INSTRUCTIONS.md", "mode": "100644", "type": "blob", "sha": blobs["DEPLOY_INSTRUCTIONS.md"]},
        *[{"path": path, "mode": "100644", "type": "blob", "sha": None} for path in DELETE_PATHS],
    ]
    tree = api("POST", "/git/trees", {"base_tree": base_tree, "tree": entries})
    tree_sha = tree["sha"]
    child = api("POST", "/git/commits", {
        "message": "fix: implement hardened owner-authorized production controller",
        "tree": tree_sha,
        "parents": [HEAD],
    })
    child_sha = child["sha"]

    final_tree = api("GET", f"/git/trees/{tree_sha}?recursive=1")
    lookup = {entry["path"]: entry.get("sha") for entry in final_tree["tree"]}
    expected_paths = {
        ".github/workflows/deploy.yml": blobs["deploy.yml"],
        ".github/workflows/vets-production-command.yml": blobs["vets-production-command.yml"],
        "DEPLOY_INSTRUCTIONS.md": blobs["DEPLOY_INSTRUCTIONS.md"],
    }
    for path, sha in expected_paths.items():
        if lookup.get(path) != sha:
            raise RuntimeError(f"Final tree mismatch: {path}")
    leftovers = [path for path in lookup if path.startswith("ops/pr52-staging/")]
    if leftovers or "ops/PRODUCTION_CONTROLLER_HARDENING_PLAN.md" in lookup:
        raise RuntimeError(f"Temporary files remain: {leftovers}")

    receipt = (
        "## VETS PR52 exact implementation staged\n\n"
        f"VETS_PR52_STAGED_COMMIT={child_sha}\n"
        f"VETS_PR52_STAGED_TREE={tree_sha}\n"
        f"deploy_sha256={EXPECTED['deploy.yml']}\n"
        f"command_sha256={EXPECTED['vets-production-command.yml']}\n"
        f"instructions_sha256={EXPECTED['DEPLOY_INSTRUCTIONS.md']}\n\n"
        "Validation: YAML PASS; 23 embedded Bash blocks PASS; credential-pattern scan PASS; "
        "hidden/bidirectional Unicode scan PASS. The branch ref was not moved by this workflow."
    )
    api("POST", "/issues/52/comments", {"body": receipt})
    Path("pr52-exact-evidence.json").write_text(json.dumps({
        "trigger_parent": HEAD,
        "staged_commit": child_sha,
        "tree": tree_sha,
        "hashes": EXPECTED,
        "validation": "PASS",
        "branch_ref_updated": False,
    }, indent=2) + "\n")
    print(receipt)


if __name__ == "__main__":
    main()
