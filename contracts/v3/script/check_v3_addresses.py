#!/usr/bin/env python3
"""HERO V3 address-config guard (owner: VETS / jratdish1).

Validates config/v3-addresses.json:
  * every role value is exactly "TBD" or a 0x + 40-hex address
  * no zero address, and no address repeated across roles on the same chain
  * no address whose sha256(lowercase) is in security/old-address-hashes.sha256
    (KB #776 + KB #792 section 8). Matches print masked (first 6 / last 4) only.
  * chainId is 8453 (base) / 369 (pulsechain)
  * no unknown keys at the root or per chain, and no duplicate JSON keys
Modes:
  default          TBD allowed (status report). Exit 1 on any violation above.
  --require-final  additionally exit 1 if any value is still TBD (use before any deploy; Tier B).
  --self-test      prove that the guard fails on a hash-listed address and on TBD-in-final mode.
Reads local files only; no network.
"""
import argparse, contextlib, hashlib, io, json, os, re, secrets, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DEFAULT_CFG = os.path.join(ROOT, "config", "v3-addresses.json")
DEFAULT_HASHES = os.path.join(ROOT, "security", "old-address-hashes.sha256")
ADDR = re.compile(r"^0x[0-9a-fA-F]{40}$")
ROLES = ["ownerSafe", "autoLiquidityReceiver", "donationReceiver", "stakeRewardsReceiver",
         "heroToken", "heroAble", "staking"]
CHAINS = {"base": 8453, "pulsechain": 369}
ROOT_KEYS = {"_comment", "schema", "chains"}


def mask(a):
    return f"{a[:6]}…{a[-4:]}"


def load_hashes(path):
    out = set()
    for line in open(path):
        if line.strip() and not line.startswith("#"):
            out.add(line.split()[0])
    return out


def reject_duplicate_keys(pairs):
    keys = [k for k, _ in pairs]
    dupes = sorted({k for k in keys if keys.count(k) > 1})
    if dupes:
        raise ValueError(f"duplicate JSON keys {dupes}")
    return dict(pairs)


def load_config(path):
    with open(path) as f:
        return json.load(f, object_pairs_hook=reject_duplicate_keys)


def all_tbd_config():
    return {"schema": 1, "chains": {name: {"chainId": cid, **{r: "TBD" for r in ROLES}}
                                    for name, cid in CHAINS.items()}}


def check(cfg, hashes, require_final):
    errs, tbd, filled = [], 0, 0
    if not isinstance(cfg, dict):
        return ["config root must be an object"], tbd, filled
    extra_root = set(cfg) - ROOT_KEYS
    if extra_root:
        errs.append(f"root: unknown keys {sorted(extra_root)}")
    if cfg.get("schema") != 1 or isinstance(cfg.get("schema"), bool):
        errs.append("schema must be 1")
    chains = cfg.get("chains")
    if not isinstance(chains, dict):
        return errs + ["chains must be an object"], tbd, filled
    if set(chains) != set(CHAINS):
        errs.append(f"chains must be exactly {sorted(CHAINS)}")
    for name, cid in CHAINS.items():
        c = chains.get(name, {})
        if not isinstance(c, dict):
            errs.append(f"{name} must be an object")
            continue
        if c.get("chainId") != cid or isinstance(c.get("chainId"), bool):
            errs.append(f"{name}.chainId must be {cid}")
        extra = set(c) - set(ROLES) - {"chainId"}
        if extra:
            errs.append(f"{name}: unknown keys {sorted(extra)}")
        seen = {}
        for r in ROLES:
            v = c.get(r)
            where = f"{name}.{r}"
            if v == "TBD":
                tbd += 1
                if require_final:
                    errs.append(f"{where} is TBD (fail closed)")
                continue
            if not isinstance(v, str) or not ADDR.fullmatch(v):
                errs.append(f"{where} must be \"TBD\" or a 0x40-hex address")
                continue
            a = v.lower()
            filled += 1
            if int(a, 16) == 0:
                errs.append(f"{where} is the zero address")
            if hashlib.sha256(a.encode()).hexdigest() in hashes:
                errs.append(f"{where} {mask(a)} is an OLD/DENYLISTED address (KB #776 / #792 s8)")
            if a in seen:
                errs.append(f"{where} {mask(a)} duplicates {seen[a]}")
            seen[a] = where
    return errs, tbd, filled


def run(cfg_path, hashes_path, require_final):
    try:
        cfg = load_config(cfg_path)
    except ValueError as e:
        print("V3-ADDR", e)
        print("v3-address check: unreadable config -> RED")
        return 1
    errs, tbd, filled = check(cfg, load_hashes(hashes_path), require_final)
    for e in errs:
        print("V3-ADDR", e)
    mode = "final" if require_final else "draft"
    print(f"v3-address check ({mode}): tbd={tbd} filled={filled} errors={len(errs)} -> {'RED' if errs else 'GREEN'}")
    return 1 if errs else 0


def self_test():
    """Uses a random throwaway address and a temporary hash list; never touches real addresses."""
    fake = "0x" + secrets.token_hex(20)
    ok = True
    base_cfg = all_tbd_config()
    with tempfile.TemporaryDirectory() as d:
        hp = os.path.join(d, "h.sha256")
        open(hp, "w").write(hashlib.sha256(fake.encode()).hexdigest() + " selftest\n")
        cases = []
        cfg = json.loads(json.dumps(base_cfg)); cfg["chains"]["base"]["ownerSafe"] = fake
        cases.append(("hash-listed address fails", cfg, False, 1))
        cfg = json.loads(json.dumps(base_cfg)); cfg["chains"]["base"]["heroToken"] = "0x" + "0" * 40
        cases.append(("zero address fails", cfg, False, 1))
        cfg = json.loads(json.dumps(base_cfg)); cfg["chains"]["pulsechain"]["staking"] = "0x1234"
        cases.append(("malformed value fails", cfg, False, 1))
        cfg = json.loads(json.dumps(base_cfg)); cfg["chains"]["base"]["ownerSafe"] = fake + "\n"
        cases.append(("hash-listed address with trailing newline fails", cfg, False, 1))
        cfg = json.loads(json.dumps(base_cfg)); cfg["typo_heroToken"] = fake
        cases.append(("unknown root key fails", cfg, False, 1))
        cfg = json.loads(json.dumps(base_cfg)); cfg["chains"]["base"]["chainId"] = True
        cases.append(("boolean chainId fails", cfg, False, 1))
        cases.append(("all-TBD passes in draft mode", base_cfg, False, 0))
        cases.append(("all-TBD fails in final mode", base_cfg, True, 1))
        for name, cfg, final, want in cases:
            cp = os.path.join(d, "c.json"); json.dump(cfg, open(cp, "w"))
            with contextlib.redirect_stdout(io.StringIO()):
                got = run(cp, hp, final)
            res = "OK" if got == want else "FAIL"
            ok &= got == want
            print(f"self-test {name}: {res}")
        cp = os.path.join(d, "dup.json")
        open(cp, "w").write('{"schema": 1, "schema": 1, "chains": {}}')
        with contextlib.redirect_stdout(io.StringIO()):
            got = run(cp, hp, False)
        ok &= got == 1
        print(f"self-test duplicate JSON key fails: {'OK' if got == 1 else 'FAIL'}")
    print(f"self-test -> {'GREEN' if ok else 'RED'}")
    return 0 if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=DEFAULT_CFG)
    ap.add_argument("--hashes", default=DEFAULT_HASHES)
    ap.add_argument("--require-final", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    sys.exit(self_test() if a.self_test else run(a.config, a.hashes, a.require_final))
