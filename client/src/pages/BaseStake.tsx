import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectWalletPrompt } from "@/components/ConnectWalletPrompt";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  TrendingUp,
  Droplets,
  Zap,
  Info,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

const HERO_BASE_CA = "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8";

const BASE_STAKE_POOLS = [
  {
    id: 1,
    pair: "HERO/WETH",
    dex: "Aerodrome",
    dexIcon: "🔵",
    pairAddress: "0xb813599dd596C179C8888C8A4Bd3FEC8308D1E20",
    liquidity: 4354,
    volume24h: 19,
    apy: "24.5",
    active: true,
    featured: true,
    zapUrl: `https://aerodrome.finance/deposit?token0=${HERO_BASE_CA}&token1=0x4200000000000000000000000000000000000006&type=-1`,
    dexUrl: "https://aerodrome.finance/pools",
  },
  {
    id: 2,
    pair: "HERO/WETH",
    dex: "Uniswap V3",
    dexIcon: "🦄",
    pairAddress: "0x3Bb159de8604ab7E0148EDC24F2A568c430476CF",
    liquidity: 3617,
    volume24h: 54,
    apy: "31.2",
    active: true,
    featured: true,
    zapUrl: `https://app.uniswap.org/add/${HERO_BASE_CA}/0x4200000000000000000000000000000000000006/3000?chain=base`,
    dexUrl: "https://app.uniswap.org/explore/pools/base",
  },
  {
    id: 3,
    pair: "HERO/USDC",
    dex: "Aerodrome",
    dexIcon: "🔵",
    pairAddress: "0xa3F80BFea263c22f921a2C5d7A28b74338957098",
    liquidity: 1005,
    volume24h: 15,
    apy: "18.7",
    active: true,
    featured: false,
    zapUrl: `https://aerodrome.finance/deposit?token0=${HERO_BASE_CA}&token1=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&type=-1`,
    dexUrl: "https://aerodrome.finance/pools",
  },
  {
    id: 4,
    pair: "HERO/BRETT",
    dex: "Aerodrome",
    dexIcon: "🔵",
    pairAddress: "0x26Eb84fbE7EA1a9E65C3473DEe73D0E96dd033F6",
    liquidity: 636,
    volume24h: 10,
    apy: "12.4",
    active: false,
    featured: false,
    zapUrl: `https://aerodrome.finance/deposit?token0=${HERO_BASE_CA}&token1=0x532f27101965dd16442E59d40670FaF5eBB142E4&type=-1`,
    dexUrl: "https://aerodrome.finance/pools",
  },
  {
    id: 5,
    pair: "HERO/AERO",
    dex: "Aerodrome",
    dexIcon: "🔵",
    pairAddress: "0x35A0B568A217c0aEd83A855aED11983bf3609444",
    liquidity: 650,
    volume24h: 6,
    apy: "11.8",
    active: false,
    featured: false,
    zapUrl: `https://aerodrome.finance/deposit?token0=${HERO_BASE_CA}&token1=0x940181a94A35A4569E4529A3CDfB74e38FD98631&type=-1`,
    dexUrl: "https://aerodrome.finance/pools",
  },
  {
    id: 6,
    pair: "HERO/cbBTC",
    dex: "Aerodrome",
    dexIcon: "🔵",
    pairAddress: "0xEEbf52397cd685878618834Cf2c7A675884D1f4B",
    liquidity: 892,
    volume24h: 2,
    apy: "9.6",
    active: false,
    featured: false,
    zapUrl: `https://aerodrome.finance/deposit?token0=${HERO_BASE_CA}&token1=0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf&type=-1`,
    dexUrl: "https://aerodrome.finance/pools",
  },
  {
    id: 7,
    pair: "ZORA/HERO",
    dex: "Aerodrome",
    dexIcon: "🔵",
    pairAddress: "0x40529F54CfF8bad0AA6d19EC8983d16e9E27B1b7",
    liquidity: 940,
    volume24h: 42,
    apy: "14.2",
    active: false,
    featured: false,
    zapUrl: `https://aerodrome.finance/deposit?token0=0x1111111111166b7FE7bd91427724B487980aFc69&token1=${HERO_BASE_CA}&type=-1`,
    dexUrl: "https://aerodrome.finance/pools",
  },
  {
    id: 8,
    pair: "jesse/HERO",
    dex: "Aerodrome",
    dexIcon: "🔵",
    pairAddress: "0xbAd80210fa3119324243279CB0212b1CE3218569",
    liquidity: 334,
    volume24h: 7,
    apy: "8.1",
    active: false,
    featured: false,
    zapUrl: `https://aerodrome.finance/pools`,
    dexUrl: "https://aerodrome.finance/pools",
  },
];

function PoolCard({ pool }: { pool: (typeof BASE_STAKE_POOLS)[0] }) {
  const [expanded, setExpanded] = useState(false);
  const { isConnected } = useAccount();

  const handleDeposit = () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    window.open(pool.zapUrl, "_blank");
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        border: pool.featured ? "1px solid rgba(200,168,75,0.4)" : "1px solid #3D5A3D",
        background: pool.featured
          ? "linear-gradient(135deg, rgba(200,168,75,0.08), rgba(28,42,28,0.95))"
          : "rgba(28,42,28,0.8)",
        boxShadow: pool.featured ? "0 0 20px rgba(200,168,75,0.08)" : "none",
      }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{pool.dexIcon}</span>
            <div>
              <div className="font-bold text-white text-sm">{pool.pair}</div>
              <div className="text-xs" style={{ color: "#8a9a8a" }}>{pool.dex}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pool.featured && (
              <Badge
                className="text-xs"
                style={{ background: "rgba(200,168,75,0.15)", color: "#C8A84B", border: "1px solid rgba(200,168,75,0.3)" }}
              >
                ⭐ Featured
              </Badge>
            )}
            {pool.active ? (
              <Badge className="text-xs bg-green-900/40 text-green-400 border-green-700/40">
                Active
              </Badge>
            ) : (
              <Badge className="text-xs bg-yellow-900/30 text-yellow-500 border-yellow-700/30">
                Low Liq
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <div className="text-xs mb-1" style={{ color: "#8a9a8a" }}>Liquidity</div>
            <div className="text-sm font-semibold text-white">${pool.liquidity.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: "#8a9a8a" }}>24h Volume</div>
            <div className="text-sm font-semibold text-white">${pool.volume24h}</div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: "#8a9a8a" }}>Est. APY</div>
            <div className="text-sm font-bold" style={{ color: "#C8A84B" }}>{pool.apy}%</div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDeposit}
            className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all hover:opacity-90"
            style={{
              background: pool.featured
                ? "linear-gradient(135deg, #C8A84B, #a8882b)"
                : "rgba(200,168,75,0.15)",
              color: pool.featured ? "#0d1a0d" : "#C8A84B",
              border: pool.featured ? "none" : "1px solid rgba(200,168,75,0.3)",
            }}
          >
            <Zap className="w-3 h-3" />
            ZAP In
          </button>
          <a
            href={`https://dexscreener.com/base/${pool.pairAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all hover:opacity-80"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid #3D5A3D",
              color: "#8a9a8a",
            }}
          >
            <TrendingUp className="w-3 h-3" />
            Chart
          </a>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-2 rounded-lg text-xs transition-all hover:opacity-80"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #3D5A3D", color: "#8a9a8a" }}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className="px-4 pb-4 pt-0 text-xs space-y-2"
          style={{ borderTop: "1px solid #3D5A3D" }}
        >
          <div className="pt-3 flex items-center justify-between">
            <span style={{ color: "#8a9a8a" }}>Pair Address</span>
            <a
              href={`https://basescan.org/address/${pool.pairAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline"
              style={{ color: "#C8A84B", fontFamily: "monospace" }}
            >
              {pool.pairAddress.slice(0, 8)}...{pool.pairAddress.slice(-6)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#8a9a8a" }}>DEX</span>
            <span className="text-white">{pool.dex}</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#8a9a8a" }}>Network</span>
            <span className="text-white">BASE (Chain ID: 8453)</span>
          </div>
          <div className="mt-2 p-2 rounded-lg" style={{ background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)" }}>
            <p style={{ color: "#b8a870" }}>
              💡 <strong>ZAP Tip:</strong> Use the ZAP feature to add liquidity with a single token —
              no need to split 50/50 manually. Aerodrome handles the split automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BaseStake() {
  const { isConnected } = useAccount();
  const [filter, setFilter] = useState<"all" | "active" | "featured">("featured");

  const filteredPools = BASE_STAKE_POOLS.filter((p) => {
    if (filter === "active") return p.active;
    if (filter === "featured") return p.featured;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: "rgba(200,168,75,0.15)", border: "1px solid rgba(200,168,75,0.3)" }}
          >
            🔵
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#C8A84B" }}>
              HERO Stake — BASE Network
            </h1>
            <p className="text-sm text-muted-foreground">
              Provide liquidity for HERO on BASE and earn rewards
            </p>
          </div>
          <Badge
            className="ml-auto text-xs"
            style={{ background: "rgba(200,168,75,0.15)", color: "#C8A84B", border: "1px solid rgba(200,168,75,0.3)" }}
          >
            BETA
          </Badge>
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="grid grid-cols-3 gap-3 mb-6 rounded-xl p-4"
        style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #3D5A3D" }}
      >
        <div className="text-center">
          <div className="text-xs mb-1" style={{ color: "#8a9a8a" }}>Total Pairs</div>
          <div className="text-xl font-bold text-white">8</div>
        </div>
        <div className="text-center">
          <div className="text-xs mb-1" style={{ color: "#8a9a8a" }}>Total Liquidity</div>
          <div className="text-xl font-bold" style={{ color: "#C8A84B" }}>$12,428</div>
        </div>
        <div className="text-center">
          <div className="text-xs mb-1" style={{ color: "#8a9a8a" }}>24h Volume</div>
          <div className="text-xl font-bold text-white">$155</div>
        </div>
      </div>

      {/* HERO CA */}
      <div
        className="flex items-center gap-2 rounded-lg p-3 mb-4 text-xs"
        style={{ background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.2)" }}
      >
        <Shield className="w-4 h-4 flex-shrink-0" style={{ color: "#C8A84B" }} />
        <span style={{ color: "#8a9a8a" }}>HERO Token (BASE):</span>
        <a
          href={`https://basescan.org/token/${HERO_BASE_CA}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:underline"
          style={{ color: "#C8A84B", fontFamily: "monospace" }}
        >
          {HERO_BASE_CA}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Filter tabs */}
      <div
        className="flex rounded-xl p-1 gap-1 mb-4"
        style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #3D5A3D" }}
      >
        {(["featured", "active", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all"
            style={
              filter === f
                ? { background: "linear-gradient(135deg, #C8A84B, #a8882b)", color: "#0d1a0d" }
                : { color: "#8a9a8a" }
            }
          >
            {f === "featured" ? "⭐ Featured" : f === "active" ? "✅ Active" : "All Pairs"}
          </button>
        ))}
      </div>

      {/* Pool cards */}
      <div className="space-y-3">
        {filteredPools.map((pool) => (
          <PoolCard key={pool.id} pool={pool} />
        ))}
      </div>

      {/* Info footer */}
      <div
        className="mt-6 rounded-xl p-4 text-xs space-y-2"
        style={{ background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.2)" }}
      >
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#C8A84B" }} />
          <div style={{ color: "#b8a870" }}>
            <p className="font-semibold text-white mb-1">How to Provide Liquidity (LP)</p>
            <p>
              1. Click <strong className="text-white">ZAP In</strong> on any pool — this takes you directly to the DEX with the pair pre-selected.
            </p>
            <p>2. Choose your input token and amount. The ZAP feature handles the 50/50 split automatically.</p>
            <p>3. Approve the transaction and confirm. You'll receive LP tokens representing your share.</p>
            <p>4. Your LP tokens earn trading fees + any HERO emissions automatically.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
