#!/usr/bin/env python3
"""HERO V3 dry-run guard (owner: VETS / jratdish1).

Fetches runtime code of deployed contracts from a LOCAL anvil RPC and checks every 20-byte window
(PUSH20 constants and immutables alike) against security/old-address-hashes.sha256
(#776 + #792 section 8). Prints only masked hits. Exit 1 on any hit.
Usage: scan_bytecode.py http://127.0.0.1:PORT 0xaddr [0xaddr ...]
"""
import hashlib, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
HASHES = os.path.join(HERE, "..", "..", "security", "old-address-hashes.sha256")


def rpc(url, method, params):
    req = urllib.request.Request(url, json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
                                 {"content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))["result"]


def main():
    url, addrs = sys.argv[1], sys.argv[2:]
    if not url.startswith("http://127.0.0.1:"):
        sys.exit("refusing non-local RPC")
    bad = {l.split()[0] for l in open(HASHES) if l.strip() and not l.startswith("#")}
    hits = 0
    for a in addrs:
        code = bytes.fromhex(rpc(url, "eth_getCode", [a, "latest"])[2:])
        if not code:
            print(f"bytecode-scan {a[:6]}…{a[-4:]}: NO CODE"); hits += 1; continue
        n = 0
        for i in range(len(code) - 19):
            w = "0x" + code[i:i + 20].hex()
            if hashlib.sha256(w.encode()).hexdigest() in bad:
                print(f"  HIT {w[:6]}…{w[-4:]} at byte {i}"); n += 1
        print(f"bytecode-scan {a[:6]}…{a[-4:]}: bytes={len(code)} windows={max(len(code)-19,0)} hits={n}")
        hits += n
    print(f"bytecode-scan total hits={hits} -> {'GREEN' if hits == 0 else 'RED'}")
    sys.exit(1 if hits else 0)


main()
