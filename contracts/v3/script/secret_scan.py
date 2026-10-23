#!/usr/bin/env python3
"""Zero-match secret scan over git-staged files. Prints file:line:rule only, never the matched text.
64-hex strings are allowed ONLY if they are reproducible public hashes listed in the repo's
security/old-address-hashes.sha256 or security/provenance.json, or a known public constant."""
import json, os, re, subprocess, sys
RULES = {
 "pem-private-key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
 "github-token": re.compile(r"\b(ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}"),
 "aws-key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
 "slack-token": re.compile(r"xox[abprs]-[A-Za-z0-9-]{10,}"),
 "openai-like": re.compile(r"\bsk-[A-Za-z0-9_-]{32,}"),
 "google-api": re.compile(r"AIza[0-9A-Za-z_-]{35}"),
 "cf-token-assign": re.compile(r"(?i)(cloudflare|cf)_?(api)?_?token\s*[:=]\s*['\"]?[A-Za-z0-9_-]{30,}"),
 "kv-secret-assign": re.compile(r"(?i)\b(private_?key|mnemonic|seed_?phrase|secret|password|api_?key)\b\s*[:=]\s*['\"][^'\"\s]{8,}['\"]"),
 "mnemonic-12": re.compile(r"(?i)\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b(?=.*(mnemonic|seed))"),
 "hex64": re.compile(r"(?<![0-9a-fA-F])(?:0x)?([0-9a-fA-F]{64})(?![0-9a-fA-F])"),
}
root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
allow = set()
for p in subprocess.check_output(["git", "ls-files", "--cached", "*old-address-hashes.sha256", "*provenance.json", "*public-constants.txt"], text=True, cwd=root).split():
    allow |= {m.lower() for m in re.findall(r"[0-9a-fA-F]{64}", open(os.path.join(root, p)).read())}
allow |= set(a.lower() for a in sys.argv[1:])
files = subprocess.check_output(["git", "diff", "--cached", "--name-only", "--diff-filter=AM"], text=True, cwd=root).split()
hits = 0
for f in files:
    blob = subprocess.run(["git", "show", f":{f}"], capture_output=True, cwd=root).stdout.decode("utf-8", "ignore")
    for i, line in enumerate(blob.splitlines(), 1):
        for name, rx in RULES.items():
            for m in rx.finditer(line):
                if name == "hex64" and m.group(1).lower() in allow:
                    continue
                hits += 1
                print(f"{f}:{i}:{name}")
print(f"secret-scan: files={len(files)} matches={hits} -> {'GREEN' if hits == 0 else 'RED'}")
sys.exit(1 if hits else 0)
