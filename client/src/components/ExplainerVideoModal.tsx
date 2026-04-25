import { useState, useEffect, useRef, useCallback } from "react";
import { X, Play, Volume2, VolumeX, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "hero-dapp-intro-completed";
const VIDEO_URL = "/hero-explainer-edited.mp4";
const POSTER_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-explainer-poster-CzrKcJsSYT6UbY94V4mnyE.png";
const HERO_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HerologowithSoldier_092f3ebf.jpg";

type Step = "video" | "disclaimer";

export default function ExplainerVideoModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("video");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showPlayButton, setShowPlayButton] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  // Auto-play video when modal opens (Edge/Chrome/Safari compatible)
  // Must be muted for autoplay to work across all browsers
  useEffect(() => {
    if (isOpen && step === "video" && videoRef.current) {
      const video = videoRef.current;
      // Workaround for React muted prop bug — set via DOM directly
      video.muted = true;
      video.defaultMuted = true;
      // Small delay to ensure DOM is ready
      const playTimer = setTimeout(() => {
        video.play().then(() => {
          setIsPlaying(true);
          setShowPlayButton(false);
        }).catch(() => {
          // Autoplay still blocked — keep play button visible for manual click
          setShowPlayButton(true);
        });
      }, 300);
      return () => clearTimeout(playTimer);
    }
  }, [isOpen, step]);

  const handlePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // Ensure muted for autoplay compatibility
    video.muted = true;
    video.play().then(() => {
      setIsPlaying(true);
      setShowPlayButton(false);
    }).catch(() => {
      // Autoplay blocked — keep play button visible
      setShowPlayButton(true);
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleSkipVideo = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setStep("disclaimer");
  }, []);

  const handleContinue = useCallback(() => {
    setStep("disclaimer");
  }, []);

  const handleAcceptDisclaimer = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
  }, []);

  const handleVideoEnded = useCallback(() => {
    setStep("disclaimer");
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>

          {step === "video" && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
                <div className="flex items-center gap-2">
                  <img src={HERO_LOGO_URL} alt="HERO" className="w-7 h-7 rounded-full object-cover border border-orange-500/40" />
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Welcome to HERO Dapp</h3>
                    <p className="text-xs text-muted-foreground">Quick overview of the ecosystem</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleContinue} className="text-xs h-7 border-orange-500/40 text-orange-400 hover:bg-orange-500/10">
                    Continue →
                  </Button>
                  <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Close">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Video Player */}
              <div className="aspect-video bg-black relative">
                <video
                  ref={videoRef}
                  src={VIDEO_URL}
                  className="w-full h-full object-contain"
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  poster={POSTER_URL}
                  onEnded={handleVideoEnded}
                  onPlay={() => { setIsPlaying(true); setShowPlayButton(false); }}
                  onPause={() => setIsPlaying(false)}
                />

                {/* Play overlay */}
                {showPlayButton && (
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/40"
                    onClick={handlePlay}
                  >
                    <div className="w-16 h-16 rounded-full bg-orange-500/90 flex items-center justify-center shadow-lg hover:bg-orange-500 transition-colors">
                      <Play className="w-7 h-7 text-white ml-1" />
                    </div>
                  </div>
                )}

                {/* Mute toggle (bottom-right) */}
                {isPlaying && (
                  <button
                    onClick={handleToggleMute}
                    className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-border bg-card/50 flex items-center justify-between shrink-0">
                <p className="text-xs text-muted-foreground">
                  Join:{" "}
                  <a href="https://t.me/VetsInCrypto/1" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">
                    t.me/VetsInCrypto
                  </a>
                </p>
                <Button size="sm" variant="ghost" onClick={handleSkipVideo} className="text-muted-foreground hover:text-foreground text-xs h-7">
                  Skip Video →
                </Button>
              </div>
            </>
          )}

          {step === "disclaimer" && (
            <>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Beta Disclaimer</h3>
                    <p className="text-xs text-muted-foreground">Please read before proceeding</p>
                  </div>
                </div>
                <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-amber-400 font-semibold text-sm">Important Notice</h4>
                    <p className="text-muted-foreground text-sm mt-1">
                      This application is currently in <strong className="text-foreground">BETA</strong> and is provided as-is for testing and educational purposes.
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">No Financial Advice:</strong> Nothing on this platform constitutes financial, investment, or trading advice. Always do your own research (DYOR).</p>
                  <p><strong className="text-foreground">Risk Acknowledgment:</strong> Cryptocurrency and DeFi involve significant risk, including the potential loss of all invested capital.</p>
                  <p><strong className="text-foreground">Beta Software:</strong> This dApp is under active development. Features may change, break, or be removed without notice.</p>
                  <p><strong className="text-foreground">No Warranties:</strong> The HERO ecosystem, VIC Foundation, and all associated parties provide no warranties of any kind.</p>
                  <p><strong className="text-foreground">Regulatory Compliance:</strong> Users are responsible for ensuring compliance with all applicable laws in their jurisdiction.</p>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-border bg-card/50 flex items-center justify-between shrink-0">
                <p className="text-xs text-muted-foreground hidden sm:block">
                  By clicking "I Understand & Accept", you agree to the above terms.
                </p>
                <Button size="sm" onClick={handleAcceptDisclaimer} className="bg-orange-500 hover:bg-orange-600 text-white whitespace-nowrap w-full sm:w-auto">
                  I Understand & Accept
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
