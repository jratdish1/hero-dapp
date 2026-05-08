#!/usr/bin/env python3
"""Fix SpinWheel.tsx - wrap button + notice in a React fragment"""

path = "/root/hero-dapp/client/src/pages/SpinWheel.tsx"
with open(path, "r") as f:
    content = f.read()

# The issue: two adjacent JSX elements in a ternary need a fragment wrapper
old = '''          {!walletConnected ? (
            <button
              onClick={() => setWalletConnected(true)}
              className="w-full mt-4 py-3 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
            >
              Connect Wallet to Spin
            </button>
            <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <p className="text-xs text-orange-300 font-semibold mb-1">🎫 HERO NFT Required</p>
              <p className="text-xs text-muted-foreground">You must hold a HERO NFT to spin the wheel daily.</p>
              <p className="text-xs text-green-400 mt-2">💡 Tip: Put your free earned HERO into Single-Sided Staking to earn DAI rewards!</p>
              <a href="/stake/hero" className="text-xs text-[var(--hero-orange)] underline mt-1 inline-block">&rarr; Stake HERO for DAI</a>
            </div>'''

new = '''          {!walletConnected ? (
            <>
            <button
              onClick={() => setWalletConnected(true)}
              className="w-full mt-4 py-3 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400 transition-colors"
            >
              Connect Wallet to Spin
            </button>
            <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <p className="text-xs text-orange-300 font-semibold mb-1">🎫 HERO NFT Required</p>
              <p className="text-xs text-muted-foreground">You must hold a HERO NFT to spin the wheel daily.</p>
              <p className="text-xs text-green-400 mt-2">💡 Tip: Put your free earned HERO into Single-Sided Staking to earn DAI rewards!</p>
              <a href="/stake/hero" className="text-xs text-[var(--hero-orange)] underline mt-1 inline-block">&rarr; Stake HERO for DAI</a>
            </div>
            </>'''

if old in content:
    content = content.replace(old, new, 1)
    with open(path, "w") as f:
        f.write(content)
    print("SpinWheel fixed - wrapped in fragment")
else:
    print("ERROR: Could not find target string")
    # Try to debug
    print(content[content.find("!walletConnected"):content.find("!walletConnected")+500])
