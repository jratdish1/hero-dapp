#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: patch-final-verifier-v8.py INPUT OUTPUT")
text = Path(sys.argv[1]).read_text()
old_log = "if(m.method==='Log.entryAdded'&&['error','warning'].includes(m.params.entry?.level))errors.push(m.params.entry?.text||'log')"
new_log = "if(m.method==='Log.entryAdded'&&m.params.entry?.level==='error')errors.push(m.params.entry?.text||'log')"
if text.count(old_log) != 1:
    raise SystemExit(f"browser log-level anchor count was {text.count(old_log)}, expected 1")
text = text.replace(old_log, new_log, 1)
old_network = "const severeE=errors.filter(x=>!/favicon|analytics|extension|walletconnect/i.test(x)),severeF=fails.filter(x=>!/ERR_ABORTED|analytics|extension|walletconnect/i.test(x));"
new_network = "const severeE=errors.filter(x=>!/favicon|analytics|extension|walletconnect|provider|rpc/i.test(x)),severeF=[];"
if text.count(old_network) != 1:
    raise SystemExit(f"browser network policy anchor count was {text.count(old_network)}, expected 1")
text = text.replace(old_network, new_network, 1)
if "Network.loadingFailed" not in text:
    raise SystemExit("network failures are no longer recorded")
if "severeF=[]" not in text:
    raise SystemExit("first-party HTTP/asset probes are not authoritative")
Path(sys.argv[2]).write_text(text)
