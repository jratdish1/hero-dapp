#!/usr/bin/env python3
"""HERO V3 guard (owner: VETS / jratdish1).

The single-sided staking contract lives in two places: contracts/v2 (hero-dapp #119) and
contracts/v3/src/staking (this port). They must stay byte-identical, or one copy ships
fixes the other lacks. Exit 1 if the v3 copy differs from the pinned sha256 in STAKING.md,
or if the v2 copy exists and differs from the v3 copy. Reads local files only.
Usage: check_staking_sync.py
"""
import hashlib, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
V3_ROOT = os.path.join(HERE, "..")
V3 = os.path.join(V3_ROOT, "src", "staking", "HeroSingleSidedStaking.sol")
V2 = os.path.join(V3_ROOT, "..", "v2", "HeroSingleSidedStaking.sol")
DOC = os.path.join(V3_ROOT, "STAKING.md")


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def main():
    with open(DOC) as f:
        m = re.search(r"sha256 `([0-9a-f]{64})`", f.read())
    if not m:
        print("staking-sync: STAKING.md has no pinned sha256 -> RED")
        return 1
    pinned, v3 = m.group(1), sha(V3)
    errs = []
    if v3 != pinned:
        errs.append(f"v3 copy sha256 {v3} != STAKING.md pin {pinned}")
    if os.path.exists(V2):
        v2 = sha(V2)
        if v2 != v3:
            errs.append(f"contracts/v2 copy sha256 {v2} != v3 copy {v3}")
    else:
        print("staking-sync: contracts/v2/HeroSingleSidedStaking.sol not present (#119 not merged); pin check only")
    for e in errs:
        print("staking-sync:", e)
    print(f"staking-sync -> {'RED' if errs else 'GREEN'}")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
