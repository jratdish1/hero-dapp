import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Star, Award, Crown, Gem, Flame, Clock, Wallet,
  ExternalLink, ChevronRight, Zap, Lock, TrendingUp, Users,
  Swords, Heart, Target, ImageIcon, Play, Globe, Sparkles, ShoppingCart
} from "lucide-react";
import { SERVICE_BRANCHES } from "@shared/tokens";
import { useLanguage } from "../contexts/LanguageContext";

const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/n6wZKBCrhC57u7dtf5EHg8";
const HERO_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png";

const COLLECTION_STATS = [
  { label: "Total Cards", value: "555", color: "text-orange-400", icon: Gem },
  { label: "Rarity Tiers", value: "5", color: "text-yellow-400", icon: Star },
  { label: "Categories", value: "10", color: "text-blue-400", icon: Shield },
  { label: "Nations", value: "50+", color: "text-green-400", icon: Globe },
  { label: "Animated NFTs", value: "4", color: "text-purple-400", icon: Play },
  { label: "Treasury Split", value: "85%", color: "text-red-400", icon: Heart },
];

const CATEGORIES = [
  { name: "International Forces", count: 131, desc: "Military from 50+ nations worldwide", color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10" },
  { name: "First Responders", count: 105, desc: "Fire, police, EMS, rescue, medical", color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/10" },
  { name: "Historical Warriors", count: 88, desc: "Warriors spanning 3,000+ years", color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/10" },
  { name: "Special / Community", count: 66, desc: "Veteran transition stories, crypto", color: "text-purple-400", border: "border-purple-500/30", bg: "bg-purple-500/10" },
  { name: "US Army", count: 54, desc: "All ranks, specialties, diversity", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/10" },
  { name: "US Marines", count: 44, desc: "Semper Fi — all ranks and roles", color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10" },
  { name: "US Navy", count: 31, desc: "SEALs, pilots, corpsmen, officers", color: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-500/10" },
  { name: "US Air Force", count: 23, desc: "Pilots, PJs, Thunderbirds, cyber", color: "text-sky-400", border: "border-sky-500/30", bg: "bg-sky-500/10" },
  { name: "US Coast Guard", count: 10, desc: "Rescue swimmers, cutter crews", color: "text-teal-400", border: "border-teal-500/30", bg: "bg-teal-500/10" },
  { name: "US Space Force", count: 8, desc: "Guardians, cyber warriors, orbital ops", color: "text-indigo-400", border: "border-indigo-500/30", bg: "bg-indigo-500/10" },
];

const RARITY_TIERS = [
  { name: "Common", frame: "Bronze Metallic", count: "~112", pct: "20%", color: "text-amber-600", border: "border-amber-600/30" },
  { name: "Uncommon", frame: "Silver Metallic", count: "~111", pct: "20%", color: "text-slate-300", border: "border-slate-300/30" },
  { name: "Rare", frame: "Gold Metallic", count: "~166", pct: "30%", color: "text-yellow-400", border: "border-yellow-400/30" },
  { name: "Ultra Rare", frame: "Purple Diamond", count: "~111", pct: "20%", color: "text-purple-400", border: "border-purple-400/30" },
  { name: "Legendary", frame: "Holographic Rainbow", count: "~55", pct: "10%", color: "text-orange-400", border: "border-orange-400/30" },
];

const GRAIL_CARDS = [
  { num: "001", name: "Devil Dog", codename: "US Marine Sergeant", category: "US Marines", rarity: "Legendary", chain: "Shared" },
  { num: "100", name: "Spartan", codename: "Spartan Warrior", category: "Historical", rarity: "Legendary", chain: "Shared" },
  { num: "200", name: "Valkyrie", codename: "Viking Warrior", category: "Historical", rarity: "Legendary", chain: "Shared" },
  { num: "300", name: "Ghost Rider", codename: "F-22 Raptor Pilot", category: "US Air Force", rarity: "Legendary", chain: "Shared" },
  { num: "400", name: "Veteran Barber", codename: "Veteran Entrepreneur", category: "Special", rarity: "Common", chain: "Shared" },
  { num: "480", name: "Diamond Hands", codename: "Veteran Crypto Trader", category: "Special", rarity: "Ultra Rare", chain: "Shared" },
  { num: "488", name: "Thunder Dreamer", codename: "Crazy Horse", category: "Historical", rarity: "Legendary", chain: "BASE" },
  { num: "493", name: "Spirit Chief", codename: "Sitting Bull", category: "Historical", rarity: "Ultra Rare", chain: "PulseChain" },
  { num: "503", name: "Last Pharaoh", codename: "Cleopatra", category: "Historical", rarity: "Legendary", chain: "Shared" },
  { num: "523", name: "King of Gold", codename: "Mansa Musa", category: "Historical", rarity: "Legendary", chain: "Shared" },
  { num: "543", name: "Zulu Thunder", codename: "Shaka Zulu", category: "Historical", rarity: "Legendary", chain: "Shared" },
  { num: "548", name: "World Conqueror", codename: "Genghis Khan", category: "Historical", rarity: "Legendary", chain: "Shared" },
  { num: "549", name: "Semper Fidelis", codename: "Iwo Jima Flag Raiser", category: "US Marines", rarity: "Legendary", chain: "Shared" },
  { num: "553", name: "Art of War", codename: "Sun Tzu", category: "Historical", rarity: "Legendary", chain: "Shared" },
  { num: "555", name: "VETS Forever", codename: "VETS Token", category: "Special", rarity: "Legendary", chain: "Shared" },
];

const ANIMATED_NFTS = [
  { name: "UK Firefighter", country: "United Kingdom 🇬🇧", category: "Fire", rarity: "Rare", chain: "PulseChain", video: `${CDN}/uk_firefighter_with_music_63551385.mp4`, thumb: `${CDN}/uk_firefighter_first_59e6b5df.png`, color: "border-yellow-500/50" },
  { name: "South Korean Firefighter", country: "South Korea 🇰🇷", category: "Fire", rarity: "Rare", chain: "BASE", video: `${CDN}/south_korea_firefighter_with_music_8040edfb.mp4`, thumb: `${CDN}/south_korea_firefighter_first_eeaf7bac.png`, color: "border-red-500/50" },
  { name: "US Marine", country: "United States 🇺🇸", category: "Military", rarity: "Ultra Rare", chain: "Shared", video: `${CDN}/us_marine_with_music_212595d5.mp4`, thumb: `${CDN}/us_marine_combat_first_bb2a0e98.png`, color: "border-orange-500/50" },
  { name: "Cruz Roja Paramedic", country: "Mexico 🇲🇽", category: "Medical", rarity: "Rare", chain: "PulseChain", video: `${CDN}/mexico_cruz_roja_with_music_dddf75f1.mp4`, thumb: `${CDN}/mexico_cruz_roja_first_18b422b0.png`, color: "border-green-500/50" },
];

const KEYFRAMES = [
  { name: "UK Firefighter", url: `${CDN}/uk_firefighter_first_59e6b5df.png` },
  { name: "Japan Paramedic", url: `${CDN}/japan_paramedic_first_4125bbe1.png` },
  { name: "Nigeria Military Medic", url: `${CDN}/nigeria_military_medic_first_2a3aef70.png` },
  { name: "Brazil SAMU", url: `${CDN}/brazil_samu_first_1c7e6dd7.png` },
  { name: "US Marine Combat", url: `${CDN}/us_marine_combat_first_bb2a0e98.png` },
  { name: "Germany THW Rescue", url: `${CDN}/germany_thw_rescue_first_5b58b205.png` },
  { name: "India Female Doctor", url: `${CDN}/india_female_doctor_first_85ba4079.png` },
  { name: "South Korea Firefighter", url: `${CDN}/south_korea_firefighter_first_eeaf7bac.png` },
  { name: "Australia Paramedic", url: `${CDN}/australia_paramedic_first_56f572ef.png` },
  { name: "Mexico Cruz Roja", url: `${CDN}/mexico_cruz_roja_first_18b422b0.png` },
];

const NFT_ARTWORK = {
  military: [
    { name: "Private (E-1)", tier: "Common", color: "border-zinc-500/50", glow: "shadow-zinc-500/20", image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/KCDTjud9tRyLDD264mUCsK/nft-private-e1-Yy9rYAR7xd75QbdjevTEnY.webp" },
    { name: "Sergeant (E-5)", tier: "Rare", color: "border-blue-500/50", glow: "shadow-blue-500/20", image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/KCDTjud9tRyLDD264mUCsK/nft-sergeant-e5-Qujwqya6Jo5YYtSJSiBfzm.webp" },
    { name: "Captain (O-3)", tier: "Epic", color: "border-purple-500/50", glow: "shadow-purple-500/20", image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/KCDTjud9tRyLDD264mUCsK/nft-captain-o3-Tt9MpLvXVJTotLpn6HWRvg.webp" },
    { name: "General (O-10)", tier: "Mythic", color: "border-yellow-500/50", glow: "shadow-yellow-500/20", image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/KCDTjud9tRyLDD264mUCsK/nft-general-o10-8QuVfgoUYWWC9CUZow3hn6.webp" },
  ],
  firstResponders: [
    { name: "Firefighter", tier: "First Responder", color: "border-red-500/50", glow: "shadow-red-500/20", image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/KCDTjud9tRyLDD264mUCsK/nft-firefighter-aqshSw4jLasFvWD8VjJKDW.webp" },
    { name: "Police Officer", tier: "First Responder", color: "border-blue-500/50", glow: "shadow-blue-500/20", image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/KCDTjud9tRyLDD264mUCsK/nft-police-4HcqiVtwhKaLbqvroziSKC.webp" },
    { name: "EMT / Paramedic", tier: "First Responder", color: "border-emerald-500/50", glow: "shadow-emerald-500/20", image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/KCDTjud9tRyLDD264mUCsK/nft-emt-JaN4AJkoBPm9YSgMVjUvSs.webp" },
  ],
};

const RANK_TIERS = [
  { rank: "Private (E-1)", tier: "Common", color: "text-muted-foreground", bg: "bg-zinc-500/10", border: "border-zinc-500/30", holdingReq: "1,000+ HERO", feeReduction: "1%", rarity: "40%", count: 400, icon: Shield, description: "Entry rank. Every holder starts here. Basic fee reduction and community access." },
  { rank: "Corporal (E-4)", tier: "Uncommon", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", holdingReq: "10,000+ HERO", feeReduction: "2%", rarity: "25%", count: 250, icon: Star, description: "Proven holder. Enhanced fee reduction and early access to new features." },
  { rank: "Sergeant (E-5)", tier: "Rare", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", holdingReq: "50,000+ HERO", feeReduction: "3%", rarity: "18%", count: 180, icon: Award, description: "Dedicated supporter. Priority access to governance proposals and boosted staking rewards." },
  { rank: "Lieutenant (O-2)", tier: "Epic", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", holdingReq: "250,000+ HERO", feeReduction: "4%", rarity: "10%", count: 100, icon: Crown, description: "Officer class. Significant fee reduction, exclusive Discord channels, and DAO voting power multiplier." },
  { rank: "Colonel (O-6)", tier: "Legendary", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", holdingReq: "1,000,000+ HERO", feeReduction: "5%", rarity: "5%", count: 50, icon: Gem, description: "Elite tier. Maximum fee reduction, exclusive airdrops, and direct founder access." },
  { rank: "General (O-10)", tier: "Mythic", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", holdingReq: "5,000,000+ HERO", feeReduction: "7%", rarity: "2%", count: 20, icon: Flame, description: "Supreme commander. Highest rarity. Zero-fee trading, all utilities unlocked, and legendary status." },
];

const UTILITY_FEATURES = [
  { title: "Fee Reduction", description: "Hold an NFT to automatically reduce buy/sell fees. Higher rank = bigger reduction.", icon: TrendingUp, status: "Phase 1" },
  { title: "Diamond Hands Rewards", description: "The longer you hold your NFT + tokens, the more you earn. Time-weighted staking multiplier.", icon: Clock, status: "Phase 1" },
  { title: "Governance Power", description: "NFT holders get boosted voting power in DAO proposals. Officers get 2x, Generals get 5x.", icon: Users, status: "Phase 2" },
  { title: "Exclusive Airdrops", description: "Periodic airdrops of HERO, VETS, and partner tokens exclusively to NFT holders.", icon: Zap, status: "Phase 2" },
  { title: "Staking Boost", description: "NFT holders receive boosted APY on all farm staking pools. Rank determines boost percentage.", icon: Flame, status: "Phase 3" },
  { title: "Rank Promotion", description: "As your wallet accumulates more HERO, your NFT rank can be upgraded — reflecting your true commitment.", icon: Award, status: "Phase 3" },
];


// ---- CAROUSEL COMPONENTS ----
function NftCarousel({ items }: { items: typeof NFT_ARTWORK.military }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused) return;
    let animId: number;
    let pos = 0;
    const speed = 0.5;
    const totalWidth = el.scrollWidth / 2;
    
    const animate = () => {
      pos += speed;
      if (pos >= totalWidth) pos = 0;
      el.scrollLeft = pos;
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, items]);
  
  // Duplicate items for infinite scroll
  const doubled = [...items, ...items, ...items];
  
  return (
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-hidden py-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ scrollBehavior: 'auto' }}
    >
      {doubled.map((nft, i) => (
        <div key={`${nft.name}-${i}`} className="flex-shrink-0 w-48 md:w-56">
          <NftArtCard nft={nft} />
        </div>
      ))}
    </div>
  );
}

function AnimatedNftCarousel({ items }: { items: typeof ANIMATED_NFTS }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused) return;
    let animId: number;
    let pos = 0;
    const speed = 0.4;
    const totalWidth = el.scrollWidth / 2;
    
    const animate = () => {
      pos += speed;
      if (pos >= totalWidth) pos = 0;
      el.scrollLeft = pos;
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, items]);
  
  const doubled = [...items, ...items, ...items];
  
  return (
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-hidden py-2"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ scrollBehavior: 'auto' }}
    >
      {doubled.map((nft, i) => (
        <div key={`${nft.name}-${i}`} className="flex-shrink-0 w-48 md:w-56">
          <AnimatedNftCard nft={nft} />
        </div>
      ))}
    </div>
  );
}

function KeyframeCarousel({ items }: { items: typeof KEYFRAMES }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused) return;
    let animId: number;
    let pos = 0;
    const speed = 0.3;
    const totalWidth = el.scrollWidth / 2;
    
    const animate = () => {
      pos += speed;
      if (pos >= totalWidth) pos = 0;
      el.scrollLeft = pos;
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, items]);
  
  const doubled = [...items, ...items, ...items];
  
  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-hidden py-1"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ scrollBehavior: 'auto' }}
    >
      {doubled.map((kf, i) => (
        <div key={`${kf.name}-${i}`} className="flex-shrink-0 w-16 md:w-20 group relative">
          <img src={kf.url} alt={kf.name} className="w-full aspect-[9/16] object-cover rounded-md border border-border group-hover:border-purple-500/50 transition-all" />
          <p className="text-[8px] text-muted-foreground text-center mt-1 truncate">{kf.name}</p>
        </div>
      ))}
    </div>
  );
}

function NftArtCard({ nft }: { nft: typeof NFT_ARTWORK.military[0] }) {
  const [loaded, setLoaded] = useState(false);
  const { t } = useLanguage();
  return (
    <div className={`group relative rounded-xl overflow-hidden border-2 ${nft.color} bg-card/80 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]`}>
      <div className="aspect-square relative overflow-hidden">
        {!loaded && <div className="absolute inset-0 bg-secondary animate-pulse flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground/30" /></div>}
        <img src={nft.image} alt={nft.name} className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`} onLoad={() => setLoaded(true)} />
      </div>
      <div className="p-2">
        <p className="text-foreground font-semibold text-xs truncate">{nft.name}</p>
        <Badge variant="outline" className="text-[9px] mt-0.5 border-current opacity-70">{t(nft.tier)}</Badge>
      </div>
    </div>
  );
}

function AnimatedNftCard({ nft }: { nft: typeof ANIMATED_NFTS[0] }) {
  const [playing, setPlaying] = useState(false);
  const { t } = useLanguage();
  return (
    <div className={`group relative rounded-xl overflow-hidden border-2 ${nft.color} bg-card/80 hover:shadow-xl transition-all duration-300`}>
      <div className="aspect-[9/16] relative overflow-hidden bg-black">
        {playing ? (
          <video src={nft.video} autoPlay loop controls className="w-full h-full object-cover" />
        ) : (
          <>
            <img src={nft.thumb} alt={nft.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <button onClick={() => setPlaying(true)} className="w-14 h-14 rounded-full bg-orange-500/90 hover:bg-orange-400 flex items-center justify-center transition-all hover:scale-110 shadow-lg">
                <Play className="w-6 h-6 text-white ml-1" />
              </button>
            </div>
          </>
        )}
        <div className="absolute top-2 right-2"><Badge className="text-[9px] bg-black/70 border-0 text-white">{nft.chain}</Badge></div>
      </div>
      <div className="p-3">
        <p className="text-foreground font-semibold text-sm">{nft.name}</p>
        <p className="text-muted-foreground text-xs">{nft.country}</p>
        <div className="flex items-center gap-1 mt-1">
          <Badge variant="outline" className="text-[9px] border-orange-500/40 text-orange-400">{t(nft.rarity)}</Badge>
          <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-400">{nft.category}</Badge>
        </div>
      </div>
    </div>
  );
}

export default function NftCollection() {
  const [activeTab, setActiveTab] = useState("gallery");
  const { t } = useLanguage();

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <img src={HERO_LOGO} alt="HERO" className="w-10 h-10 rounded-full object-cover border-2 border-orange-500/40" />
        <div>
          <h1 className="text-foreground font-bold text-2xl">{t("$HERO NFT Collection")}</h1>
          <p className="text-muted-foreground text-sm">{t("555 unique cards honoring military, first responders & historical warriors worldwide")}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {COLLECTION_STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="bg-card/60 border-border text-center p-3">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
              <p className={`font-bold text-lg ${stat.color}`}>{stat.value}</p>
              <p className="text-muted-foreground/70 text-[10px]">{t(stat.label)}</p>
            </Card>
          );
        })}
      </div>

      {/* Dual-Chain Banner */}
      <Card className="bg-gradient-to-r from-orange-500/10 via-purple-500/5 to-blue-500/10 border-orange-500/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-foreground font-semibold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                {t("Dual-Chain Deployment")}
              </h3>
              <p className="text-muted-foreground text-xs mt-0.5">{t("555 cards split across PulseChain (~185), BASE (~185), and Shared (~185)")}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-orange-500/40 text-orange-400 text-xs">{t("PulseChain Primary")}</Badge>
              <Badge variant="outline" className="border-blue-500/40 text-blue-400 text-xs">{t("BASE Secondary")}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-card border border-border w-full justify-start flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="gallery" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"><ImageIcon className="w-4 h-4 mr-1" />{t("Gallery")}</TabsTrigger>
          <TabsTrigger value="animated" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"><Play className="w-4 h-4 mr-1" />{t("Animated NFTs")}</TabsTrigger>
          <TabsTrigger value="grails" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400"><Crown className="w-4 h-4 mr-1" />{t("Grail Cards")}</TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"><Globe className="w-4 h-4 mr-1" />{t("Categories")}</TabsTrigger>
          <TabsTrigger value="ranks" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"><Award className="w-4 h-4 mr-1" />{t("Rank System")}</TabsTrigger>
          <TabsTrigger value="utility" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"><Zap className="w-4 h-4 mr-1" />{t("Utility")}</TabsTrigger>
          <TabsTrigger value="branches" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"><Shield className="w-4 h-4 mr-1" />{t("Service Branches")}</TabsTrigger>
          <TabsTrigger value="roadmap" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"><Target className="w-4 h-4 mr-1" />{t("Roadmap")}</TabsTrigger>
          <TabsTrigger value="marketplace" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400"><ShoppingCart className="w-4 h-4 mr-1" />{t("Marketplace")}</TabsTrigger>
        </TabsList>

        {/* GALLERY */}
        <TabsContent value="gallery" className="mt-4 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4"><Swords className="w-5 h-5 text-orange-400" /><h3 className="text-foreground font-semibold text-lg">{t("Military Rank Collection")}</h3><Badge variant="outline" className="text-[10px] border-orange-500/40 text-orange-400">{t("Sample Artwork")}</Badge></div>
            <NftCarousel items={NFT_ARTWORK.military} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4"><Heart className="w-5 h-5 text-red-400" /><h3 className="text-foreground font-semibold text-lg">{t("First Responder Collection")}</h3><Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400">{t("Sample Artwork")}</Badge></div>
            <NftCarousel items={NFT_ARTWORK.firstResponders} />
          </div>
          <Card className="bg-gradient-to-r from-orange-500/5 to-yellow-500/5 border-orange-500/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Wallet className="w-6 h-6 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-orange-400 font-semibold text-sm">555-Card Collection — Minting Coming Soon</h4>
                  <p className="text-muted-foreground text-sm mt-1">{t("85% of NFT earnings go straight into the treasury wallet for charity donations. The remaining 15% is allocated towards operations, overhead, and future development of the HERO protocol.")}</p>
                  <a href="https://x.com/hero501c3" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-400 text-xs mt-2 hover:text-orange-300">Follow @HERO501c3 for mint updates <ExternalLink className="w-3 h-3" /></a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANIMATED */}
        <TabsContent value="animated" className="mt-4 space-y-6">
          <div className="flex items-center gap-2"><Play className="w-5 h-5 text-purple-400" /><h3 className="text-foreground font-semibold text-lg">{t("Animated NFTs")}</h3><Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-400">ERC-721 Video NFTs</Badge></div>
          <p className="text-muted-foreground text-sm">Bold cartoon/comic book style. 8-second loops with patriotic orchestral music. 1080x1920 portrait format optimized for mobile and NFT display.</p>
          <AnimatedNftCarousel items={ANIMATED_NFTS} />
          <Card className="bg-card/40 border-border">
            <CardContent className="p-5">
              <h4 className="text-foreground font-semibold text-sm mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-purple-400" />Animation Keyframes</h4>
              <KeyframeCarousel items={KEYFRAMES} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* GRAILS */}
        <TabsContent value="grails" className="mt-4 space-y-4">
          <Card className="bg-card/40 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-400" />{t("The 15 Grail Cards")}</CardTitle>
              <p className="text-muted-foreground text-sm">{t("The rarest and most iconic cards in the collection. Each tells a story.")}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {GRAIL_CARDS.map((card) => (
                  <div key={card.num} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border hover:border-yellow-500/30 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center"><span className="text-yellow-400 font-bold text-sm">#{card.num}</span></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><p className="text-foreground font-semibold text-sm">{card.name}</p><Badge variant="outline" className={`text-[9px] ${card.rarity === "Legendary" ? "border-orange-500/40 text-orange-400" : card.rarity === "Ultra Rare" ? "border-purple-500/40 text-purple-400" : "border-zinc-500/40 text-zinc-400"}`}>{t(card.rarity)}</Badge></div>
                      <p className="text-muted-foreground text-xs">{card.codename} • {card.category}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400">{card.chain}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIES */}
        <TabsContent value="categories" className="mt-4 space-y-4">
          <Card className="bg-card/40 border-border">
            <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Globe className="w-5 h-5 text-blue-400" />{t("Categories")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <div key={cat.name} className={`flex items-center gap-3 p-3 rounded-lg ${cat.bg} border ${cat.border}`}>
                    <div className="flex-1"><p className={`font-semibold text-sm ${cat.color}`}>{cat.name}</p><p className="text-muted-foreground text-xs">{cat.desc}</p></div>
                    <Badge variant="outline" className={`${cat.border} ${cat.color} text-xs`}>{cat.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border">
            <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Star className="w-5 h-5 text-yellow-400" />{t("Rarity Tiers")}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {RARITY_TIERS.map((tier) => (
                  <div key={tier.name} className={`flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border ${tier.border}`}>
                    <div className="flex-1"><p className={`font-semibold text-sm ${tier.color}`}>{t(tier.name)}</p><p className="text-muted-foreground text-xs">{tier.frame} • {tier.count} cards ({tier.pct})</p></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RANKS */}
        <TabsContent value="ranks" className="mt-4 space-y-4">
          <Card className="bg-card/40 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2"><Award className="w-5 h-5 text-orange-400" />{t("NFT Rank & Utility System")}</CardTitle>
              <p className="text-muted-foreground text-sm">{t("Your rank is determined by your HERO token holdings. Higher rank = more utility.")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {RANK_TIERS.map((rank) => {
                const Icon = rank.icon;
                return (
                  <div key={rank.rank} className={`p-4 rounded-xl ${rank.bg} border ${rank.border}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`w-6 h-6 ${rank.color}`} />
                      <div>
                        <p className={`font-bold text-sm ${rank.color}`}>{rank.rank}</p>
                        <Badge variant="outline" className={`text-[9px] ${rank.border} ${rank.color}`}>{t(rank.tier)}</Badge>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-foreground font-semibold text-sm">{rank.holdingReq}</p>
                        <p className="text-muted-foreground text-[10px]">{t("Holding Requirement")}</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">{rank.description}</p>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-muted-foreground">{t("Fee Reduction")}: <span className={rank.color}>{rank.feeReduction}</span></span>
                      <span className="text-muted-foreground">{t("Rarity Tiers")}: <span className={rank.color}>{rank.rarity}</span></span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* UTILITY */}
        <TabsContent value="utility" className="mt-4 space-y-4">
          <Card className="bg-card/40 border-border">
            <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Zap className="w-5 h-5 text-orange-400" />{t("NFT Utility Features")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {UTILITY_FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div key={feat.title} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                    <Icon className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2"><p className="text-foreground font-semibold text-sm">{t(feat.title)}</p><Badge variant="outline" className="text-[9px] border-orange-500/40 text-orange-400">{t(feat.status)}</Badge></div>
                      <p className="text-muted-foreground text-xs mt-1">{feat.description}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-orange-500/5 to-yellow-500/5 border-orange-500/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Lock className="w-6 h-6 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-foreground font-semibold text-sm">Core + Enhanced + Premium Utility</h4>
                  <p className="text-muted-foreground text-sm mt-1">Every NFT holder gets Core Utility (Phase 1). Rare+ holders unlock Enhanced Utility. Legendary holders get Premium Utility including a custom animated NFT of their own military branch/unit.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BRANCHES */}
        <TabsContent value="branches" className="mt-4 space-y-4">
          <Card className="bg-card/40 border-border">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {SERVICE_BRANCHES.map((branch: any) => (
                  <div key={branch.name} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border hover:border-orange-500/30 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-xl">{branch.emoji}</div>
                    <div>
                      <p className="text-foreground font-semibold text-sm">{branch.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {branch.name === "Army" ? "This We'll Defend!" : branch.name === "Navy" ? "Forged by the Sea!" : branch.name === "Marines" ? "Semper Fi!" : branch.name === "Air Force" ? "Aim High!" : branch.name === "Coast Guard" ? "Semper Paratus!" : branch.name === "Space Force" ? "Semper Supra!" : branch.name === "Firefighters" ? "Bravest!" : branch.name === "Police" ? "Finest!" : "Heroes!"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-red-500/5 to-blue-500/5 border-red-500/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-foreground font-semibold text-sm">{t("Supporting Veterans & First Responders")}</h4>
                  <p className="text-muted-foreground text-sm mt-1">{t("HERO is a 501(c)(3) nonprofit supporting military veterans and first responders through the VIC Foundation. 85% of NFT earnings go straight into the treasury wallet for charity donations. The remaining 15% is allocated towards operations, overhead, and future development of the HERO protocol.")}</p>
                  <a href="https://x.com/hero501c3" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-orange-400 text-xs mt-2 hover:text-orange-300">Follow @HERO501c3 on X <ExternalLink className="w-3 h-3" /></a>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ROADMAP */}
        <TabsContent value="roadmap" className="mt-4 space-y-4">
          <Card className="bg-card/40 border-border">
            <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Target className="w-5 h-5 text-orange-400" />{t("NFT Development Roadmap")}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {[
                { phase: t("Phase 1"), title: t("Artwork & Minting"), status: t("In Progress"), statusColor: "text-yellow-400 border-yellow-500/40", items: ["555 unique steampunk-military trading cards complete", "4 animated video NFTs complete (UK, South Korea, US Marine, Mexico)", "ERC-721 smart contract blueprint ready", "Dual-chain deployment: PulseChain + BASE", "Mint event: 85% to treasury for charity, 15% to operations"] },
                { phase: t("Phase 2"), title: t("Utility Activation"), status: t("Planned"), statusColor: "text-blue-400 border-blue-500/40", items: ["Automatic fee reduction for NFT holders", "Diamond hands time-weighted staking multiplier", "Governance voting power boost", "Exclusive airdrop eligibility for holders"] },
                { phase: t("Phase 3"), title: t("Advanced Features"), status: t("Future"), statusColor: "text-muted-foreground border-muted-foreground/40", items: ["Rank promotion system (upgrade NFT as holdings grow)", "Staking APY boost based on NFT rank", "Cross-chain NFT bridging (PulseChain to BASE)", "Community marketplace for trading", "Custom animated NFT for Legendary holders"] },
              ].map((phase) => (
                <div key={phase.phase} className="relative pl-8 border-l-2 border-border">
                  <div className="absolute left-0 top-0 w-4 h-4 rounded-full bg-orange-500 -translate-x-[9px]" />
                  <div className="flex items-center gap-2 mb-2"><h4 className="text-foreground font-semibold">{phase.phase}: {phase.title}</h4><Badge variant="outline" className={`text-[10px] ${phase.statusColor}`}>{phase.status}</Badge></div>
                  <ul className="space-y-1.5">{phase.items.map((item, i) => (<li key={i} className="flex items-start gap-2 text-muted-foreground text-sm"><ChevronRight className="w-3 h-3 text-orange-400 shrink-0 mt-1" />{item}</li>))}</ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MARKETPLACE - NFT Nutters via SquirrelSwap */}
        <TabsContent value="marketplace" className="mt-4 space-y-4">
          <Card className="bg-card/40 border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-green-400" />
                {t("NFT Nutters Marketplace")}
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                {t("Browse, buy, and trade HERO NFTs on the NFT Nutters marketplace powered by SquirrelSwap. 85% of all NFT earnings go straight into the treasury wallet for charity donations. The remaining 15% is allocated towards operations, overhead, and future development of the HERO protocol.")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="w-full rounded-xl overflow-hidden border border-border" style={{ minHeight: '800px' }}>
                <iframe
                  src="https://app.squirrelswap.pro/#/nutters?tab=marketplace"
                  width="100%"
                  height="800"
                  style={{ border: 'none', borderRadius: '12px' }}
                  allow="clipboard-write"
                  title="NFT Nutters Marketplace"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="https://app.squirrelswap.pro/#/nutters?tab=marketplace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors text-sm font-medium"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {t("Open Full Marketplace")}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
