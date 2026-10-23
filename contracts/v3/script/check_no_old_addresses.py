#!/usr/bin/env python3
"""HERO V3 guard (owner: VETS / jratdish1).

Fails (exit 1) if any 0x-prefixed 40-hex address in the given paths hashes to an entry
in security/old-address-hashes.sha256 (KB #776 + KB #792 section 8). Prints only a
masked form (first 6 / last 4). Usage: check_no_old_addresses.py [paths...]
"""
import hashlib, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HASHES = os.path.join(HERE, "..", "security", "old-address-hashes.sha256")
ADDR = re.compile(r"0x[0-9a-fA-F]{40}(?![0-9a-fA-F])")


def load():
    out = {}
    for line in open(HASHES):
        if line.strip() and not line.startswith("#"):
            h, label = line.split(None, 1)
            out[h] = label.strip()
    return out


def main(paths):
    bad = load()
    hits = 0
    files = 0
    for root in paths or [os.path.join(HERE, "..")]:
        for dp, dn, fn in os.walk(root) if os.path.isdir(root) else [("", [], [root])]:
            dn[:] = [d for d in dn if d not in ("out", "cache", "node_modules", ".git", "broadcast")]
            for f in fn:
                p = os.path.join(dp, f)
                try:
                    text = open(p, encoding="utf-8", errors="ignore").read()
                except OSError:
                    continue
                files += 1
                for i, line in enumerate(text.splitlines(), 1):
                    for m in ADDR.finditer(line):
                        a = m.group(0).lower()
                        if hashlib.sha256(a.encode()).hexdigest() in bad:
                            hits += 1
                            print(f"OLD-ADDRESS {p}:{i} {a[:6]}…{a[-4:]} [{bad[hashlib.sha256(a.encode()).hexdigest()]}]")
    print(f"old-address check: files={files} hits={hits} hashes={len(bad)} -> {'RED' if hits else 'GREEN'}")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
