import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Droplets,
  Zap,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  ArrowRight,
  Star,
} from "lucide-react";

const HERO_BASE_CA = "0x00Fa69ED03d3337085A6A87B691E8a02d04Eb5f8";

const STEPS = [
  {
    step: 1,
    icon: ShoppingCart,
    color: "#C8A84B",
    title: "Buy HERO",
    subtitle: "Get your HERO tokens",
    summary: "Purchase HERO on BASE network using ETH, USDC, or any token via the Swap page.",
    details: [
      {
        heading: "What you need",
        body: "A crypto wallet (MetaMask, Coinbase Wallet, or any WalletConnect wallet) and some ETH on BASE network for gas fees.",
      },
      {
        heading: "How to buy",
        body: "Go to the Swap page, select HERO as your output token, enter the amount you want to spend, and click Swap. The aggregator finds you the best price across all DEXes automatically.",
      },
      {
        heading: "HERO Token Address (BASE)",
        body: HERO_BASE_CA,
        mono: true,
        link: `https://basescan.org/token/${HERO_BASE_CA}`,
      },
      {
        heading: "Pro tip",
        body: "Set slippage to 1-2% for HERO. Always verify the contract address before buying.",
      },
    ],
    action: { label: "Go to Swap", href: "/swap" },
  },
  {
    step: 2,
    icon: Droplets,
    color: "#4B8EC8",
    title: "What is an LP?",
    subtitle: "Liquidity Provider basics",
    summary: "An LP (Liquidity Provider) deposits two tokens into a pool, enabling others to trade. In return, you earn a share of all trading fees.",
    details: [
      {
        heading: "The simple version",
        body: "Imagine you open a currency exchange booth. You put $500 of HERO and $500 of ETH on the counter. Every time someone swaps HERO for ETH (or vice versa) at your booth, you earn a small fee. That's being an LP.",
      },
      {
        heading: "What you earn",
        body: "Trading fees (0.05%–1% per trade depending on the pool) + any HERO emissions the protocol adds as an incentive bonus.",
      },
      {
        heading: "The risk: Impermanent Loss",
        body: "If the price of HERO moves significantly vs your paired token, you may end up with less value than just holding both tokens. This is called impermanent loss. It's 'impermanent' because it can recover if prices return to your entry ratio.",
      },
      {
        heading: "LP tokens",
        body: "When you provide liquidity, you receive LP tokens. These represent your share of the pool. Hold them to keep earning fees, or stake them in the Farm to earn bonus HERO emissions.",
      },
    ],
    action: { label: "View Farm", href: "/farm" },
  },
  {
    step: 3,
    icon: Zap,
    color: "#C8A84B",
    title: "Use the ZAP Feature",
    subtitle: "The easiest way to add liquidity",
    summary: "ZAP lets you add liquidity with just ONE token instead of having to split your funds 50/50 manually. It handles everything automatically.",
    details: [
      {
        heading: "Without ZAP (the hard way)",
        body: "You'd need to: 1) Buy exactly 50% HERO and 50% ETH, 2) Approve both tokens, 3) Add them to the pool in the exact ratio. If prices move between steps, you're off-ratio.",
      },
      {
        heading: "With ZAP (the easy way)",
        body: "You put in 100% ETH (or 100% HERO, or 100% USDC). The ZAP contract automatically swaps half to the other token and adds both to the pool in one transaction. Done.",
      },
      {
        heading: "How to ZAP",
        body: "On the Farm page, click 'ZAP In' on any pool. Select your input token, enter your amount, approve, and confirm. That's it — you're an LP.",
      },
      {
        heading: "ZAP tip",
        body: "ZAP works best when the pool has good liquidity. For small pools, use a manual 50/50 split to minimize ZAP slippage.",
      },
    ],
    action: { label: "ZAP into a Pool", href: "/farm" },
  },
  {
    step: 4,
    icon: TrendingUp,
    color: "#4BC87A",
    title: "LP Benefits & Rewards",
    subtitle: "What you earn as an LP",
    summary: "As an LP, you earn trading fees automatically + bonus HERO token emissions from the protocol's incentive program.",
    details: [
      {
        heading: "Trading fees",
        body: "Every swap in your pool generates a fee (0.05%–1%). Your share is proportional to your share of the pool. Fees accrue in real-time and are automatically added to your LP position.",
      },
      {
        heading: "HERO emissions",
        body: "The HERO protocol distributes additional HERO tokens to LPs as a bonus incentive. These are called 'emissions' and are on top of the trading fees. Check the Farm page for current emission rates per pool.",
      },
      {
        heading: "How to claim",
        body: "Trading fees are automatically compounded into your LP position. HERO emissions need to be manually claimed from the Farm page (or set to auto-compound if available).",
      },
      {
        heading: "Compounding strategy",
        body: "Claim your HERO emissions regularly and either: a) Add them back to the LP (compound), or b) Single-side stake them for DAI rewards (see Step 5).",
      },
    ],
    action: { label: "View Farm Rewards", href: "/farm" },
  },
  {
    step: 5,
    icon: Award,
    color: "#C8A84B",
    title: "Stake HERO for DAI",
    subtitle: "The HERO HODLer strategy",
    summary: "Take your HERO emissions from LP farming and single-side stake them. No LP needed — just stake HERO and earn DAI stablecoin rewards.",
    details: [
      {
        heading: "Why this is powerful",
        body: "Instead of selling your HERO emissions (which creates sell pressure and hurts the price), you stake them. You earn DAI (a stablecoin worth $1) without selling HERO. You profit in stable dollars while your HERO position grows.",
      },
      {
        heading: "The flywheel",
        body: "More HERO staked → less HERO sold → stronger price → more LP fees → more HERO emissions → more staking. It's a positive feedback loop that benefits everyone in the ecosystem.",
      },
      {
        heading: "DAI stablecoin",
        body: "DAI is a decentralized stablecoin pegged to $1 USD. It's one of the most trusted stablecoins in DeFi, backed by crypto collateral rather than a bank. Your rewards are always worth $1 each.",
      },
      {
        heading: "Lock period",
        body: "Single-side staking has a 7-day lock period. Early withdrawal incurs a 10% penalty. Plan accordingly — this is designed for committed HODLers.",
      },
    ],
    action: { label: "Stake HERO", href: "/stake" },
  },
];

function StepCard({ step, isLast }: { step: (typeof STEPS)[0]; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = step.icon;

  return (
    <div className="relative">
      {/* Connector line */}
      {!isLast && (
        <div
          className="absolute left-7 top-full w-0.5 h-6 z-0"
          style={{ background: "linear-gradient(to bottom, #3D5A3D, transparent)" }}
        />
      )}

      <div
        className="rounded-xl overflow-hidden transition-all duration-200"
        style={{
          border: `1px solid ${step.color}40`,
          background: `linear-gradient(135deg, ${step.color}08, rgba(28,42,28,0.9))`,
        }}
      >
        <button
          className="w-full p-4 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${step.color}20`, border: `1px solid ${step.color}40` }}
            >
              <Icon className="w-5 h-5" style={{ color: step.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${step.color}20`, color: step.color }}
                >
                  Step {step.step}
                </span>
                <span className="text-xs text-muted-foreground">{step.subtitle}</span>
              </div>
              <h3 className="text-base font-bold text-white">{step.title}</h3>
              <p className="text-xs mt-1" style={{ color: "#8a9a8a" }}>{step.summary}</p>
            </div>
            <div className="flex-shrink-0 mt-1">
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${step.color}20` }}>
            {step.details.map((d, i) => (
              <div key={i} className="pt-3">
                <p className="text-xs font-semibold text-white mb-1">{d.heading}</p>
                {d.link ? (
                  <a
                    href={d.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs flex items-center gap-1 hover:underline break-all"
                    style={{ color: step.color, fontFamily: d.mono ? "monospace" : "inherit" }}
                  >
                    {d.body}
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <p
                    className="text-xs leading-relaxed"
                    style={{
                      color: "#d4d4c0",
                      fontFamily: d.mono ? "monospace" : "inherit",
                    }}
                  >
                    {d.body}
                  </p>
                )}
              </div>
            ))}
            <a
              href={step.action.href}
              className="mt-3 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)`,
                color: step.color === "#4B8EC8" || step.color === "#4BC87A" ? "#fff" : "#0d1a0d",
              }}
            >
              {step.action.label}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Onboarding() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Star className="w-6 h-6" style={{ color: "#C8A84B" }} />
          <h1 className="text-3xl font-bold" style={{ color: "#C8A84B" }}>
            New to HERO?
          </h1>
          <Star className="w-6 h-6" style={{ color: "#C8A84B" }} />
        </div>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Welcome, Patriot. This is your mission briefing. Five steps to go from zero to earning
          passive income with HERO Protocol — no prior crypto experience needed.
        </p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Badge
            className="text-xs"
            style={{ background: "rgba(200,168,75,0.15)", color: "#C8A84B", border: "1px solid rgba(200,168,75,0.3)" }}
          >
            🇺🇸 Built for Veterans &amp; First Responders
          </Badge>
        </div>
      </div>

      {/* Mission overview */}
      <div
        className="rounded-xl p-4 mb-6 flex items-start gap-3"
        style={{ background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.2)" }}
      >
        <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#C8A84B" }} />
        <div className="text-sm" style={{ color: "#d4d4c0" }}>
          <p className="font-semibold text-white mb-1">Your Mission</p>
          <p>
            Buy HERO → Add it to a liquidity pool → Earn trading fees + HERO emissions →
            Stake your HERO emissions for DAI stablecoin rewards. Repeat. Build wealth without
            selling your position.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {STEPS.map((step, i) => (
          <StepCard key={step.step} step={step} isLast={i === STEPS.length - 1} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs" style={{ color: "#5a6a5a" }}>
        <p>Questions? Join the HERO community on Telegram or Discord.</p>
        <p className="mt-1">Not financial advice. Always DYOR. 🦅</p>
      </div>
    </div>
  );
}
