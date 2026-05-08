#!/usr/bin/env python3
"""Patch SpinWheel.tsx to add NFT notice below Connect Wallet button"""
import re

path = "/root/hero-dapp/client/src/pages/SpinWheel.tsx"
with open(path, "r") as f:
    content = f.read()

# Find the closing </button> after "Connect Wallet to Spin" and add notice after it
notice = '''
            </button>
            <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <p className="text-xs text-orange-300 font-semibold mb-1">🎫 HERO NFT Required</p>
              <p className="text-xs text-muted-foreground">You must hold a HERO NFT to spin the wheel daily.</p>
              <p className="text-xs text-green-400 mt-2">💡 Tip: Put your free earned HERO into Single-Sided Staking to earn DAI rewards!</p>
              <a href="/stake/hero" className="text-xs text-[var(--hero-orange)] underline mt-1 inline-block">→ Stake HERO for DAI</a>
            </div>'''

# Replace the first </button> that comes after "Connect Wallet to Spin"
old = '''              Connect Wallet to Spin
            </button>'''
new = '''              Connect Wallet to Spin
            </button>
            <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <p className="text-xs text-orange-300 font-semibold mb-1">🎫 HERO NFT Required</p>
              <p className="text-xs text-muted-foreground">You must hold a HERO NFT to spin the wheel daily.</p>
              <p className="text-xs text-green-400 mt-2">💡 Tip: Put your free earned HERO into Single-Sided Staking to earn DAI rewards!</p>
              <a href="/stake/hero" className="text-xs text-[var(--hero-orange)] underline mt-1 inline-block">&rarr; Stake HERO for DAI</a>
            </div>'''

if old in content:
    content = content.replace(old, new, 1)
    with open(path, "w") as f:
        f.write(content)
    print("SpinWheel patched successfully")
else:
    print("WARNING: Could not find target string in SpinWheel.tsx")
