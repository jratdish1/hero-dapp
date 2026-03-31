import { useState, useEffect, useCallback } from "react";
import { X, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "hero-dapp-explainer-dismissed";
const SKIP_DELAY_MS = 4000; // Skip button appears after 4 seconds

interface ExplainerVideoModalProps {
  videoUrl?: string;
}

export function ExplainerVideoModal({ videoUrl }: ExplainerVideoModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    // Check if user has already dismissed the modal
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay before showing so page loads first
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Countdown timer for skip button
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setShowSkip(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  }, []);

  if (!isOpen) return null;

  // Placeholder content when no video URL is provided yet
  const hasVideo = !!videoUrl;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={showSkip ? handleDismiss : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl mx-4 bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/10 animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center">
              <Play className="w-4 h-4 text-white ml-0.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Welcome to HERO Dapp</h3>
              <p className="text-xs text-muted-foreground">Quick overview of the ecosystem</p>
            </div>
          </div>

          {/* Skip / Close button */}
          {showSkip ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4 mr-1" />
              Skip
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground/60 tabular-nums">
              Skip in {countdown}s
            </span>
          )}
        </div>

        {/* Video Area */}
        <div className="aspect-video bg-black relative">
          {hasVideo ? (
            <video
              src={videoUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
            />
          ) : (
            /* Placeholder with infographic-style content */
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center mb-4 animate-pulse">
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                The <span className="text-orange-500">HERO</span> Ecosystem
              </h2>
              <p className="text-zinc-400 max-w-md mb-6">
                A DEX aggregator, NFT collection, and DeFi farm ecosystem built for military veterans and first responders on PulseChain and BASE.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="text-orange-500 font-bold text-lg">Swap</div>
                  <div className="text-zinc-500 text-xs">Best DEX rates</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="text-green-500 font-bold text-lg">Farm</div>
                  <div className="text-zinc-500 text-xs">Yield farming</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="text-blue-500 font-bold text-lg">NFTs</div>
                  <div className="text-zinc-500 text-xs">Military ranks</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="text-purple-500 font-bold text-lg">501(c)(3)</div>
                  <div className="text-zinc-500 text-xs">Charity mission</div>
                </div>
              </div>
              <p className="text-zinc-600 text-xs mt-4">
                Explainer video coming soon — stay tuned!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-card/50 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Join the community: <a href="https://t.me/VetsInCrypto/1" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">t.me/VetsInCrypto</a>
          </p>
          <Button
            size="sm"
            onClick={handleDismiss}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Enter Dapp
          </Button>
        </div>
      </div>
    </div>
  );
}
