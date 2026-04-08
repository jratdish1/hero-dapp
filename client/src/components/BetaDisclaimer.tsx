import { useState, useEffect } from "react";
import { Shield, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "hero_beta_disclaimer_accepted";

export default function BetaDisclaimer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show on every new session (sessionStorage clears on tab close)
    const accepted = sessionStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #0d1a0d 0%, #1a2a1a 50%, #0d1a0d 100%)",
          border: "1px solid #3d5a3d",
          boxShadow: "0 0 40px rgba(200,168,75,0.15), 0 0 80px rgba(200,168,75,0.05)",
        }}
      >
        {/* Header icon */}
        <div className="flex flex-col items-center mb-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "rgba(200,168,75,0.15)", border: "1px solid rgba(200,168,75,0.3)" }}
          >
            <Shield className="w-8 h-8" style={{ color: "#C8A84B" }} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Beta Disclaimer</h2>
          <p className="text-sm mt-1" style={{ color: "#8a9a8a" }}>Please read before continuing</p>
        </div>

        {/* Content box */}
        <div
          className="rounded-xl p-4 mb-5 space-y-3 text-sm leading-relaxed"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(61,90,61,0.5)" }}
        >
          <p style={{ color: "#d4d4c0" }}>
            <span style={{ color: "#C8A84B", fontWeight: 700 }}>HERO Protocol</span> is currently in{" "}
            <strong className="text-white">beta</strong>. While every effort has been made to ensure
            the platform is secure and reliable, software in beta may contain bugs or unexpected
            behaviour.
          </p>
          <p style={{ color: "#d4d4c0" }}>
            Cryptocurrency trading carries{" "}
            <strong className="text-white">inherent risk</strong>. Token prices are volatile, smart
            contract interactions are irreversible, and losses — including total loss of funds — are
            possible.
          </p>
          <p style={{ color: "#d4d4c0" }}>
            By using this platform you acknowledge that you do so{" "}
            <strong className="text-white">entirely at your own risk</strong>. The HERO Protocol
            developers and contributors accept no liability for any financial losses incurred.
          </p>
        </div>

        {/* Alert row */}
        <div
          className="flex items-start gap-2 rounded-lg p-3 mb-5 text-xs"
          style={{ background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.2)" }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#C8A84B" }} />
          <span style={{ color: "#b8a870" }}>
            This notice will appear each time you open a new session. Not financial advice. DYOR.
          </span>
        </div>

        {/* Accept button */}
        <button
          onClick={handleAccept}
          className="w-full py-3 rounded-xl font-bold text-base tracking-wide transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #C8A84B 0%, #a8882b 100%)",
            color: "#0d1a0d",
            boxShadow: "0 4px 20px rgba(200,168,75,0.3)",
          }}
        >
          I Understand &amp; Accept
        </button>

        <p className="text-center text-xs mt-3" style={{ color: "#5a6a5a" }}>
          Built for Veterans, First Responders &amp; Heroes 🇺🇸
        </p>
      </div>
    </div>
  );
}
