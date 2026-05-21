import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 300);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-[var(--hero-orange)] text-white shadow-lg hover:bg-[var(--hero-orange)]/80 transition-all flex items-center justify-center"
      aria-label="Return to top"
      title="Return to top"
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
}
