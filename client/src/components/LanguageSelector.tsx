/**
 * LanguageSelector — Dropdown language picker for HeroBase.io
 * 
 * Uses the LanguageContext for proper React-based i18n.
 * Replaces the broken Google Translate approach.
 */
import { useState, useEffect, useRef } from 'react';
import { useLanguage, type Language } from '../contexts/LanguageContext';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
];

export default function LanguageSelector({ className = '' }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (lang: typeof LANGUAGES[0]) => {
    setLanguage(lang.code);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-black/20 hover:bg-black/30
                   border border-white/10 text-white text-xs font-medium
                   transition-all rounded-sm"
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span>{selected.flag}</span>
        <span className="hidden sm:inline">{selected.label}</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-gray-900 border border-white/10
                        shadow-xl z-50 max-h-64 overflow-y-auto rounded-md">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm
                         transition-colors hover:bg-white/10
                         ${selected.code === lang.code
                           ? 'text-yellow-400 bg-white/5'
                           : 'text-white/80'
                         }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.label}</span>
              {selected.code === lang.code && (
                <svg className="w-4 h-4 ml-auto text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
