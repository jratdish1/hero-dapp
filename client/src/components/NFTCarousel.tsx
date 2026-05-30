/*
 * HEROBASE.IO — NFT Carousel
 * Auto-scrolling carousel for Military Rank and First Responder NFT collections
 * Pauses on hover, smooth infinite scroll
 */
import { useState, useEffect, useRef, useCallback } from 'react';

interface NFTItem {
  id?: string | number;
  image?: string;
  name?: string;
  rank?: string;
}

interface NFTCarouselProps {
  title: string;
  nfts?: NFTItem[];
  autoScrollSpeed?: number;
}

export default function NFTCarousel({ title, nfts = [], autoScrollSpeed = 3000 }: NFTCarouselProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const itemsToShow = typeof window !== 'undefined' && window.innerWidth < 768 ? 2 : 4;
  const startAutoScroll = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!isPaused && nfts.length > itemsToShow) {
        setCurrentIndex(prev => (prev + 1) % nfts.length);
      }
    }, autoScrollSpeed);
  }, [isPaused, nfts.length, autoScrollSpeed, itemsToShow]);
  useEffect(() => {
    startAutoScroll();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startAutoScroll]);
  const goTo = (idx: number) => setCurrentIndex(idx % nfts.length);
  const goPrev = () => setCurrentIndex(prev => prev === 0 ? nfts.length - 1 : prev - 1);
  const goNext = () => setCurrentIndex(prev => (prev + 1) % nfts.length);
  if (nfts.length === 0) {
    return (
      <div className="py-8 text-center text-white/40 text-sm">
        No NFTs loaded for {title}. Collection coming soon.
      </div>
    );
  }
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white uppercase tracking-wider">{title}</h3>
        <div className="flex gap-2">
          <button
            onClick={goPrev}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Previous"
          >
            &larr;
          </button>
          <button
            onClick={goNext}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Next"
          >
            &rarr;
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${(currentIndex * 100) / itemsToShow}%)`,
          }}
        >
          {nfts.map((nft, idx) => (
            <div
              key={String(nft.id || idx)}
              className="shrink-0 px-2"
              style={{ width: `${100 / itemsToShow}%` }}
            >
              <div className="bg-white/5 border border-white/10 overflow-hidden hover:border-yellow-500/50 transition-all cursor-pointer group">
                <div className="aspect-square bg-gray-800 overflow-hidden">
                  {nft.image ? (
                    <img
                      src={nft.image}
                      alt={nft.name || 'NFT #' + idx}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-4xl">
                      &#127894;
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-white text-sm font-medium truncate">
                    {nft.name || '#' + (idx + 1)}
                  </div>
                  {nft.rank && (
                    <div className="text-yellow-400 text-xs mt-1">{nft.rank}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {nfts.length > itemsToShow && (
        <div className="flex justify-center gap-1.5 mt-4">
          {nfts.slice(0, Math.min(nfts.length, 10)).map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex % nfts.length
                  ? 'bg-yellow-400 w-4'
                  : 'bg-white/20 hover:bg-white/40'
              }`}
              aria-label={'Go to slide ' + (idx + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
