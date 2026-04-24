import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PAINTINGS } from '../constants';
import { AIAnalysis } from '../types';
import { analyzePainting, streamPaintingDescription } from '../services/geminiService';
import { ParticleSystem } from './ParticleSystem';
import { LightingOverlay, Vignette, NoiseTexture } from './Spotlight';
import { Label } from './Label';
import { ChevronLeft, ChevronRight, SunIcon, MoonIcon } from './Icons';

interface GalleryProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  userMood: string;
}

export const Gallery: React.FC<GalleryProps> = ({ isDarkMode, toggleTheme, userMood }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [streamedText, setStreamedText] = useState<string>(""); 
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Parallax State (For background lighting only)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const isTransitioningRef = useRef(isTransitioning);
  useEffect(() => { isTransitioningRef.current = isTransitioning; }, [isTransitioning]);

  const currentPainting = PAINTINGS[currentIndex];

  // --- Parallax Logic ---
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth) * 2 - 1;
    const y = (e.clientY / innerHeight) * 2 - 1;
    setMousePos({ x, y });
  }, []);

  // --- Preload Images ---
  useEffect(() => {
    const nextIndex = (currentIndex + 1) % PAINTINGS.length;
    const prevIndex = (currentIndex - 1 + PAINTINGS.length) % PAINTINGS.length;
    const preloadImage = (src: string) => { const img = new Image(); img.src = src; };
    preloadImage(PAINTINGS[nextIndex].url);
    preloadImage(PAINTINGS[prevIndex].url);
  }, [currentIndex]);

  // --- Fetch AI Data ---
  useEffect(() => {
    let mounted = true;
    setAnalysis(null);
    setStreamedText(""); 
    
    const fetchAnalysis = async () => {
      // 1. Initial metadata fetch (Cached)
      const metaResult = await analyzePainting(currentPainting);
      if (!mounted) return;
      setAnalysis(metaResult);

      // 2. Stream the poetic description
      await new Promise(r => setTimeout(r, 200)); 
      if (!mounted) return;

      const stream = streamPaintingDescription(currentPainting);
      for await (const chunk of stream) {
        if (!mounted) break;
        setStreamedText(prev => prev + chunk);
      }
    };

    if (!isTransitioning) {
      fetchAnalysis();
    }
    
    return () => { mounted = false; };
  }, [currentIndex, currentPainting, isTransitioning]);

  // --- Navigation Logic ---
  const changePainting = useCallback((direction: 'next' | 'prev') => {
    if (isTransitioningRef.current) return;
    setIsTransitioning(true);
    
    setTimeout(() => {
      setCurrentIndex((prev) => {
        if (direction === 'next') return (prev + 1) % PAINTINGS.length;
        return (prev - 1 + PAINTINGS.length) % PAINTINGS.length;
      });
      setIsTransitioning(false);
    }, 600);
  }, []);

  // --- Keyboard Control ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        changePainting('next');
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        changePainting('prev');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changePainting]);

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`
        relative w-full h-screen overflow-hidden select-none transition-colors duration-700 ease-in-out 
        animate-in fade-in duration-1000
        ${isDarkMode ? 'bg-[#0a0a0c] text-white' : 'bg-[#e8e8e5] text-neutral-900'}
      `}
    >
      {/* --- Environment Layers --- */}
      <NoiseTexture />
      <Vignette isDarkMode={isDarkMode} />
      <LightingOverlay isDarkMode={isDarkMode} mousePos={mousePos} />
      
      <div className={`transition-opacity duration-1000 ${isDarkMode ? 'opacity-100' : 'opacity-30'}`}>
        <ParticleSystem mousePos={mousePos} />
      </div>

      {/* --- Controls --- */}
      <div className="absolute top-6 right-6 z-[100]">
        <button 
          onClick={toggleTheme}
          className={`p-3 rounded-full transition-all duration-300 cursor-pointer shadow-xl hover:scale-110 ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white ring-1 ring-white/10' : 'bg-white/50 hover:bg-white/80 text-[#168866] ring-1 ring-[#168866]/20'}`}
        >
          {isDarkMode ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {/* --- Main Layout --- */}
      <div className="relative z-30 w-full h-full flex flex-col md:flex-row">
        
        {/* Left Pane: Painting */}
        <div className="w-full h-[55%] md:h-full md:w-[65%] flex items-center justify-center md:justify-end p-8 md:pr-16 lg:pr-24 relative pointer-events-none">
          <div 
            className={`
              relative transition-all duration-700 ease-out transform-gpu pointer-events-auto
              ${isTransitioning ? 'opacity-0 translate-y-4 blur-sm scale-95' : 'opacity-100 translate-y-0 blur-0 scale-100'}
            `}
          >
            <div className="relative group">
              {/* Floor Shadow */}
              <div 
                className={`absolute -bottom-12 left-1/2 -translate-x-1/2 w-[120%] h-[50px] blur-[60px] rounded-[100%] transition-opacity duration-500
                  ${isDarkMode ? 'bg-black/90 opacity-80' : 'bg-neutral-600/40 opacity-60'}`} 
              />
              
              {/* Image Container */}
              <div className="relative shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)]">
                  <img 
                    src={currentPainting.url} 
                    alt={currentPainting.title}
                    className="max-h-[45vh] md:max-h-[75vh] max-w-[85vw] md:max-w-[50vw] object-contain relative z-10"
                    style={{ 
                       maskImage: isDarkMode 
                         ? 'linear-gradient(135deg, black 60%, rgba(0,0,0,0.9) 100%)' 
                         : 'none'
                    }}
                  />
                  <div className="absolute inset-0 z-20 pointer-events-none mix-blend-overlay bg-gradient-to-br from-white/10 to-transparent" />
                  <div className="absolute inset-0 z-20 pointer-events-none mix-blend-overlay opacity-10 bg-[url('https://www.transparenttextures.com/patterns/canvas-orange.png')]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Label */}
        <div className="w-full h-[45%] md:h-full md:w-[35%] flex items-start md:items-center justify-center md:justify-start p-8 md:pl-8 md:pr-32 relative pointer-events-none">
             <div className="pointer-events-auto w-full">
                <Label 
                  painting={currentPainting} 
                  analysis={analysis} 
                  streamedContent={streamedText}
                  visible={!isTransitioning} 
                  isDarkMode={isDarkMode}
                />
             </div>
        </div>
      </div>

      {/* --- Navigation Zones --- */}
      <div 
        className="absolute top-1/2 left-0 -translate-y-1/2 w-16 md:w-24 h-full flex items-center justify-center group cursor-pointer z-50" 
        onClick={() => changePainting('prev')}
      >
         <div className={`p-3 rounded-full transition-all duration-300 opacity-20 group-hover:opacity-100 transform group-hover:-translate-x-2 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-black/10 text-neutral-800'}`}>
            <ChevronLeft />
         </div>
      </div>
      
      <div 
        className="absolute top-1/2 right-0 -translate-y-1/2 w-16 md:w-24 h-full flex items-center justify-center group cursor-pointer z-50" 
        onClick={() => changePainting('next')}
      >
         <div className={`p-3 rounded-full transition-all duration-300 opacity-20 group-hover:opacity-100 transform group-hover:translate-x-2 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-black/10 text-neutral-800'}`}>
            <ChevronRight />
         </div>
      </div>
    </div>
  );
};