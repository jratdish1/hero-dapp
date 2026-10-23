#!/usr/bin/env python3
"""HERO V3 provenance re-check (owner: VETS / jratdish1). Read-only; no keys; nothing broadcast.

Re-fetches the verified source of one OLD contract, checks it against security/provenance.json,
recompiles it with the exact solc release, and compares the result with eth_getCode from a public RPC.

The old address is NOT stored in this repo (it is on the KB #776 / #792 section 8 lists). Pass it
explicitly; the script checks sha256(lowercase address) against the manifest before using it.

  python3 script/verify_provenance.py HERO_base 0x<full old address>

Labels: HERO_base BB_base ABLE_base HERO_pls BB_pls ABLE_pls
"""
import hashlib, json, os, subprocess, sys, tempfile, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = json.load(open(os.path.join(HERE, "..", "security", "provenance.json"), encoding="utf-8"))
RPC = {8453: "https://mainnet.base.org", 369: "https://rpc.pulsechain.com"}
UA = {"user-agent": "hero-v3-provenance/1", "content-type": "application/json"}


def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=60))


def solc(ver):
    path = os.path.join(tempfile.gettempdir(), f"solc-{ver}")
    if not os.path.exists(path):
        req = urllib.request.Request(f"https://binaries.soliditylang.org/linux-amd64/solc-linux-amd64-v{ver}", headers=UA)
        with open(path, "wb") as f:
            f.write(urllib.request.urlopen(req, timeout=120).read())
        os.chmod(path, 0o755)
    return path


def strip_meta(b):
    n = int.from_bytes(b[-2:], "big")
    return b[: -(n + 2)]


def main(label, addr):
    m = next(x for x in MANIFEST if x["label"] == label)
    if hashlib.sha256(addr.lower().encode()).hexdigest() != m["address_sha256"]:
        sys.exit(f"address does not match manifest hash for {label} ({m['address_masked']})")
    if m["chainId"] == 8453:
        d = get(f"https://sourcify.dev/server/v2/contract/8453/{addr}?fields=all")
        srcs = {p: {"content": s["content"]} for p, s in d["sources"].items()}
        settings = d["compilation"]["compilerSettings"]
        path, name = d["compilation"]["fullyQualifiedName"].rsplit(":", 1)
    else:
        d = get(f"https://api.scan.pulsechain.com/api/v2/smart-contracts/{addr}")
        main_path = d.get("file_path") or f"{d['name']}.sol"
        srcs = {main_path: {"content": d["source_code"]}}
        for a in d.get("additional_sources") or []:
            srcs[a["file_path"]] = {"content": a["source_code"]}
        settings = d.get("compiler_settings") or {"optimizer": {"enabled": True, "runs": d.get("optimization_runs") or 200}}
        path, name = main_path, d["name"]
    got = hashlib.sha256(srcs[m["main_file"]]["content"].encode()).hexdigest()
    print(f"[{label}] verbatim sha256 {got} manifest {m['verbatim_sha256']} -> {'OK' if got == m['verbatim_sha256'] else 'MISMATCH'}")
    settings["outputSelection"] = {"*": {"*": ["evm.deployedBytecode.object", "evm.deployedBytecode.immutableReferences"]}}
    out = json.loads(subprocess.run([solc(m["compiler"]), "--standard-json"], input=json.dumps(
        {"language": "Solidity", "sources": srcs, "settings": settings}), capture_output=True, text=True).stdout)
    c = out["contracts"][path][name]["evm"]["deployedBytecode"]
    code = get(RPC[m["chainId"]], json.dumps({"jsonrpc": "2.0", "id": 1, "method": "eth_getCode", "params": [addr, "latest"]}).encode())["result"]
    onchain = bytearray.fromhex(code[2:])
    for refs in c.get("immutableReferences", {}).values():
        for r in refs:
            onchain[r["start"]: r["start"] + r["length"]] = bytes(r["length"])
    compiled = bytearray.fromhex(c["object"])
    print(f"[{label}] solc {m['compiler']} runtime exact={onchain == compiled} excl-metadata={strip_meta(onchain) == strip_meta(compiled)}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
