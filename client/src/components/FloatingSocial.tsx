/**
 * FloatingSocial — Floating social media sidebar (right side)
 * Adapted from vicfoundation.com for herobase.io
 */
import { ExternalLink } from "lucide-react";

const SOCIAL_LINKS = [
  { label: "X (Twitter)", href: "https://x.com/hero501c3", icon: "𝕏" },
  { label: "Telegram", href: "https://t.me/VetsInCrypto/1", icon: "✈" },
  { label: "YouTube", href: "https://www.youtube.com/@LIFEWAVEPATCH1", icon: "▶" },
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61574659498767", icon: "f" },
  { label: "Instagram", href: "https://www.instagram.com/vicfoundation", icon: "📷" },
  { label: "TikTok", href: "https://www.tiktok.com/@vicfoundation", icon: "♪" },
];

export default function FloatingSocial() {
  return (
    <div
      className="hidden md:flex flex-col fixed right-3 top-1/2 -translate-y-1/2 z-50 gap-2"
      role="navigation"
      aria-label="Social media links"
    >
      {SOCIAL_LINKS.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          title={link.label}
          className="flex items-center justify-center w-10 h-10 rounded-lg text-base
                     bg-card/90 border border-border/40 text-[#e8b84b]
                     hover:bg-[#e8b84b] hover:text-[#1a2410] hover:scale-110
                     transition-all duration-300 backdrop-blur-sm shadow-lg"
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
}
