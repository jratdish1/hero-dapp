#!/usr/bin/env python3
from pathlib import Path

path = Path('server/routers.ts')
text = path.read_text(encoding='utf-8')
old = """                success: false,
                requiresConfirmation: true,
                message: \"This will permanently bind this wallet to your account. Set confirmBinding: true to proceed.\",
                walletAddress: input.walletAddress,
"""
new = """                success: false,
                requiresConfirmation: true,
                message: \"This will permanently bind this wallet to your account. Set confirmBinding: true to proceed.\",
                walletAddress: input.walletAddress,
                proposalId: undefined,
                contentHash: undefined,
                anchorTxHash: undefined,
                ...advisoryProposalMetadata(),
"""
if text.count(old) != 1:
    raise SystemExit(f'expected one proposal confirmation return, found {text.count(old)}')
path.write_text(text.replace(old, new), encoding='utf-8')
