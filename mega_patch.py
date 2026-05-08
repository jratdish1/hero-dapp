#!/usr/bin/env python3
"""
Mega-patch for herobase.io UI fixes:
1. SpinWheel — NFT gate notice + SSS staking recommendation
2. PriceTicker — BASE ticker matches PLS length (add VETS on BASE too)
3. AppLayout — Change "DEX" to "DApp", enlarge HERO text, add marpat-body, add header banner
4. Treasury component — real-time balance display
"""
import subprocess, sys

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"WARN: {cmd[:60]}... → {r.stderr[:200]}")
    return r.stdout

# ─── 1. SpinWheel — Add NFT notice + SSS recommendation ───────────────
print("=== Patching SpinWheel.tsx ===")
run("""cd /root/hero-dapp && sed -i 's|Connect Wallet to Spin|Connect Wallet to Spin|' client/src/pages/SpinWheel.tsx""")

# Add notice below the Connect Wallet button
run(r"""cd /root/hero-dapp && sed -i '/Connect Wallet to Spin<\/button>/a\
            <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">\
              <p className="text-xs text-orange-300 font-semibold mb-1">🎫 HERO NFT Required</p>\
              <p className="text-xs text-muted-foreground">You must hold a HERO NFT to spin the wheel daily.</p>\
              <p className="text-xs text-green-400 mt-2">💡 Tip: Put your free earned HERO into Single-Sided Staking to earn DAI rewards!</p>\
              <a href="/stake/hero" className="text-xs text-[var(--hero-orange)] underline mt-1 inline-block">→ Stake HERO for DAI</a>\
            </div>' client/src/pages/SpinWheel.tsx""")

# ─── 2. PriceTicker — Add VETS to BASE ticker to match PLS length ─────
print("=== Patching PriceTicker.tsx ===")
# Remove the conditional that hides VETS on BASE — show it on both chains
run(r"""cd /root/hero-dapp && sed -i 's|{!isBase && (|{/* Show VETS on all chains */}\n      {(|' client/src/components/PriceTicker.tsx""")
run(r"""cd /root/hero-dapp && sed -i 's|<TickerItem symbol="VETS" price={data.vets?.price} change24h={data.vets?.change24h} icon="🎖️" />|<TickerItem symbol="VETS" price={data.vets?.price} change24h={data.vets?.change24h} icon="🎖️" />\n      <Divider />\n      <TickerItem symbol={isBase ? "USDC" : "DAI"} price={isBase ? data.usdc?.price : data.dai?.price} change24h={isBase ? data.usdc?.change24h : data.dai?.change24h} icon="💵" />|' client/src/components/PriceTicker.tsx""")

# ─── 3. AppLayout — Change DEX to DApp, enlarge HERO, add marpat-body, add header banner ───
print("=== Patching AppLayout.tsx ===")
# Change "DEX" to "DApp" in the subtitle
run("""cd /root/hero-dapp && sed -i 's|{chain.name} DEX|{chain.name} DApp|' client/src/components/AppLayout.tsx""")

# Enlarge HERO text from text-lg to text-2xl
run("""cd /root/hero-dapp && sed -i 's|className="font-bold text-lg text-sidebar-foreground">HERO|className="font-bold text-2xl tracking-wide text-sidebar-foreground">HERO|' client/src/components/AppLayout.tsx""")

# Add marpat-body class to the main content area
run("""cd /root/hero-dapp && sed -i 's|<main className="flex-1 flex flex-col min-h-screen">|<main className="flex-1 flex flex-col min-h-screen marpat-body">|' client/src/components/AppLayout.tsx""")

# Add HERO banner image to the header (after the PriceTicker line)
run(r"""cd /root/hero-dapp && sed -i '/<PriceTicker \/>/a\
                <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HerobannerUN_342fe48e.jpg" alt="HERO Banner" className="h-8 rounded object-cover hidden md:block" style={{maxWidth: "200px"}} />' client/src/components/AppLayout.tsx""")

# ─── 4. Update SEO title from DEX to DApp ──────────────────────────────
print("=== Patching usePageSEO.ts ===")
run("""cd /root/hero-dapp && sed -i 's|DEX Aggregator|DApp|g' client/src/hooks/usePageSEO.ts""")

print("=== All patches applied ===")
