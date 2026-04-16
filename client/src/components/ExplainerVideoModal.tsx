import { useState, useEffect, useCallback, useRef } from "react";
import { X, Shield, AlertTriangle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "hero-dapp-explainer-dismissed";
const YOUTUBE_VIDEO_ID = "zpwKPiA1r20";
const YOUTUBE_EMBED_URL = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
const POSTER_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/HerobannerUN_342fe48e.jpg";

type ModalStep = "video" | "disclaimer";

// Detect mobile/tablet
const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
};

// iOS detection for scroll lock
const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export function ExplainerVideoModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("video");
  const [showSkip, setShowSkip] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [videoStarted, setVideoStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // iOS viewport height fix
  useEffect(() => {
    if (!isOpen) return;
    if (isIOS()) {
      const setHeight = () => {
        document.documentElement.style.setProperty('--isl-vh', window.innerHeight * 0.01 + 'px');
      };
      setHeight();
      window.addEventListener('resize', setHeight);
      return () => {
        window.removeEventListener('resize', setHeight);
        document.documentElement.style.removeProperty('--isl-vh');
      };
    }
  }, [isOpen]);

  // On mobile: show skip IMMEDIATELY
  // On desktop: 3 second countdown
  useEffect(() => {
    if (!isOpen || step !== "video") return;

    if (isMobile) {
      setShowSkip(true);
      setCountdown(0);
      return;
    }

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
  }, [isOpen, step, isMobile]);

  const handleSkipVideo = useCallback(() => {
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

  if (!isOpen) return null;

  // ═══════════════════════════════════════════════════════════════
  // MOBILE: Bottom sheet style — NO body scroll lock
  // Uses pointer-events to block interaction with background
  // but does NOT touch body overflow at all
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <>
        {/* Backdrop — tappable to dismiss, NO scroll lock */}
        <div
          className="fixed inset-0 z-[100] bg-black/80"
          onClick={handleClose}
          style={{ touchAction: 'none' }}
        />
        {/* Bottom sheet modal */}
        <div
          className="fixed bottom-0 left-0 right-0 z-[101] bg-card border-t border-border rounded-t-2xl shadow-2xl shadow-orange-500/10 animate-in slide-in-from-bottom duration-300"
          style={{ maxHeight: '85vh', touchAction: 'auto' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {step === "video" && (
            <>
              {/* Header with close */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png"
                    alt="HERO"
                    className="w-6 h-6 rounded-full border border-orange-500/40"
                  />
                  <span className="font-bold text-sm text-foreground">Welcome to HERO</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSkipVideo}
                    className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 px-3"
                  >
                    Continue →
                  </Button>
                  <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground" aria-label="Close">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Video poster — tap to play */}
              <div className="relative w-full aspect-video bg-black">
                {!videoStarted ? (
                  <div className="relative w-full h-full cursor-pointer" onClick={() => setVideoStarted(true)}>
                    <img src={POSTER_IMAGE} alt="HERO Overview" className="w-full h-full object-cover" loading="eager" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-14 h-14 rounded-full bg-orange-500/90 flex items-center justify-center shadow-lg">
                        <Play className="w-6 h-6 text-white ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-0 right-0 text-center">
                      <span className="text-xs text-white/70 bg-black/50 px-3 py-1 rounded-full">
                        Tap to play · Swipe down or tap Continue to skip
                      </span>
                    </div>
                  </div>
                ) : (
                  <iframe
                    src={YOUTUBE_EMBED_URL}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="HERO Explainer"
                  />
                )}
              </div>
              {/* Quick links */}
              <div className="px-4 py-2 flex items-center justify-between border-t border-border">
                <a href="https://t.me/VetsInCrypto/1" target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:underline">
                  Join Telegram
                </a>
                <button onClick={handleSkipVideo} className="text-xs text-muted-foreground hover:text-foreground">
                  Skip →
                </button>
              </div>
            </>
          )}

          {step === "disclaimer" && (
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 40px)' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border sticky top-0 bg-card z-10">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <span className="font-bold text-sm text-foreground">Beta Disclaimer</span>
                </div>
                <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Content */}
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-muted-foreground text-xs">
                    This app is in <strong className="text-foreground">BETA</strong> — provided as-is for testing and educational purposes.
                  </p>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p><strong className="text-foreground">No Financial Advice:</strong> Nothing here constitutes financial advice. DYOR.</p>
                  <p><strong className="text-foreground">Risk:</strong> Crypto/DeFi involves significant risk including total loss.</p>
                  <p><strong className="text-foreground">Beta:</strong> Features may change or break without notice.</p>
                  <p><strong className="text-foreground">No Warranties:</strong> HERO ecosystem provides no warranties of any kind.</p>
                  <p><strong className="text-foreground">Compliance:</strong> Users are responsible for their jurisdiction's laws.</p>
                </div>
              </div>
              {/* Accept */}
              <div className="px-4 py-3 border-t border-border sticky bottom-0 bg-card">
                <Button
                  size="sm"
                  onClick={handleAcceptDisclaimer}
                  className="bg-orange-500 hover:bg-orange-600 text-white w-full"
                >
                  I Understand & Accept
                </Button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP: Full modal with ISL scroll lock technique
  // ═══════════════════════════════════════════════════════════════
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        height: 'min(calc(var(--isl-vh, 1vh) * 100), 100%)',
        overflow: 'hidden',
      }}
    >
      {/* ISL scroller layer — captures all scroll events */}
      <div
        ref={scrollerRef}
        className="absolute inset-0"
        style={{
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehavior: 'none',
        }}
      >
        <div style={{ height: 'calc(100% + 1px)', minHeight: 'calc(100% + 1px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'sticky', top: 0, bottom: 0, height: 'calc(100% - 1px)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={handleClose} />
            {/* Modal card */}
            <div className="relative w-full max-w-3xl mx-4 bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/10 animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
              {step === "video" && (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
                    <div className="flex items-center gap-2">
                      <img
                        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663472861536/XieYK2a8rpN3wLQcLrDc5d/hero-logo-official_808c9ab8.png"
                        alt="HERO Logo"
                        className="w-7 h-7 rounded-full object-cover border border-orange-500/40"
                      />
                      <div>
                        <h3 className="font-bold text-sm text-foreground">Welcome to HERO Dapp</h3>
                        <p className="text-xs text-muted-foreground">Quick overview of the ecosystem</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {showSkip ? (
                        <Button size="sm" onClick={handleSkipVideo} className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 px-3">
                          Continue →
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 tabular-nums mr-1">{countdown}s</span>
                      )}
                      <button onClick={handleClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Close">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Video */}
                  <div className="relative w-full aspect-video bg-black shrink-0">
                    {!videoStarted ? (
                      <div className="relative w-full h-full cursor-pointer group" onClick={() => setVideoStarted(true)}>
                        <img src={POSTER_IMAGE} alt="HERO Ecosystem Overview" className="w-full h-full object-cover" loading="eager" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                          <div className="w-16 h-16 rounded-full bg-orange-500/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-7 h-7 text-white ml-1" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <iframe
                        src={YOUTUBE_EMBED_URL}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="HERO Ecosystem Explainer"
                      />
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
      </div>
    </div>
  );
}
