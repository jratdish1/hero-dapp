/*
 * HEROBASE.IO — Intro Video Overlay
 * One-time fullscreen overlay on homepage
 * Cookie-based "seen" flag prevents repeat display
 * Flow: Video plays -> Skip/End -> Beta Disclaimer -> Accept -> Cookie set -> Enter site
 */
import { useState, useEffect, useRef } from 'react';
const COOKIE_NAME = 'herobase_intro_seen';
const COOKIE_DAYS = 365;
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}
function setCookie(name: string, value: string, days: number): void {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/';
}
interface IntroOverlayProps {
  videoSrc?: string;
}
export default function IntroOverlay({ videoSrc }: IntroOverlayProps) {
  const [phase, setPhase] = useState<'video' | 'disclaimer' | 'hidden'>('video');
  const [visible, setVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!getCookie(COOKIE_NAME)) {
      setVisible(true);
      document.body.style.overflow = 'hidden';
    }
  }, []);
  const handleSkip = () => {
    if (videoRef.current) videoRef.current.pause();
    setPhase('disclaimer');
  };
  const handleVideoEnd = () => {
    setPhase('disclaimer');
  };
  const handleAccept = () => {
    setCookie(COOKIE_NAME, 'true', COOKIE_DAYS);
    setVisible(false);
    document.body.style.overflow = '';
  };
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      {phase === 'video' && videoSrc && (
        <>
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            playsInline
            onEnded={handleVideoEnd}
            className="w-full h-full object-contain"
          />
          <button
            onClick={handleSkip}
            className="absolute bottom-8 right-8 px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-bold uppercase tracking-wider text-sm border border-white/30 hover:bg-white/20 transition-all"
          >
            Skip &rarr;
          </button>
        </>
      )}
      {(phase === 'disclaimer' || (phase === 'video' && !videoSrc)) && (
        <div className="max-w-lg mx-auto p-8 text-center">
          <div className="text-4xl mb-4">&#9888;&#65039;</div>
          <h2 className="text-2xl font-bold text-white mb-4 uppercase tracking-wider">
            Beta Disclaimer
          </h2>
          <p className="text-white/70 text-sm leading-relaxed mb-6">
            HeroBase.io is currently in <strong className="text-yellow-400">BETA</strong>.
            Features may change, and there may be bugs. Use at your own risk. This is not
            financial advice. Always do your own research (DYOR). The VIC Foundation and
            HeroBase.io are not responsible for any financial losses.
          </p>
          <p className="text-white/50 text-xs mb-8">
            By clicking &quot;Accept &amp; Enter,&quot; you acknowledge that you understand the risks
            associated with using a beta product and interacting with decentralized protocols.
          </p>
          <button
            onClick={handleAccept}
            className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold uppercase tracking-wider text-sm hover:from-yellow-400 hover:to-orange-400 transition-all shadow-lg hover:shadow-xl"
          >
            Accept &amp; Enter
          </button>
        </div>
      )}
    </div>
  );
}
