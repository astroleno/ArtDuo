import React, { useState } from 'react';
import { FlipWords } from './FlipWords';
import { SunIcon, MoonIcon } from './Icons';

const QUESTIONS = [
  '此刻你是何种颜色？',
  '你的心像圆还是碎片？',
  '今天属于冷色还是暖调？',
  '心绪更像山脊还是海浪？',
  '现在的你是线条还是涂抹？',
  '若是旋律，你轻快吗？',
  '今天，你的心声像什么？',
  '现在像耳语还是合唱？',
  '今天闪过的光点是什么？',
  '你更像晨光还是夜色？',
  '你的心情像风还是雨？',
  '此刻是一句怎样的诗？',
  '今天，你更像火还是水？',
  '若添一件作品，会是什么？',
  '此刻的你，会在想些什么？'
];

interface LandingPageProps {
  onStart: (mood: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart, isDarkMode, toggleTheme }) => {
  const [mood, setMood] = useState('');
  const [isExiting, setIsExiting] = useState(false);

  const handleStart = () => {
    setIsExiting(true);
    setTimeout(() => {
      onStart(mood);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStart();
    }
  };

  return (
    <div className={`
      relative w-full h-screen flex flex-col items-center justify-center 
      overflow-hidden transition-colors duration-1000 ease-in-out
      ${isDarkMode ? 'bg-[#050505] text-[#e5e5e5]' : 'bg-[#e8e8e5] text-neutral-900'}
      ${isExiting ? 'opacity-0 scale-105 filter blur-lg' : 'opacity-100 scale-100'}
    `}>
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
         {/* Noise Texture */}
         <div 
            className="absolute inset-0 opacity-[0.06] mix-blend-overlay z-0" 
            style={{ 
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
            }}
          />
          {/* Subtle vignette */}
          <div className={`absolute inset-0 transition-opacity duration-1000 ${isDarkMode ? 'opacity-100 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,rgba(0,0,0,0.8)_100%)]' : 'opacity-40 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.01)_0%,rgba(0,0,0,0.1)_100%)]'}`} />
      </div>

      {/* Header */}
      <div className="absolute top-12 w-full text-center z-20 animate-in fade-in slide-in-from-top-4 duration-1000">
        <h1 className={`font-title text-3xl font-bold tracking-widest mb-2 transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>ArtDuo</h1>
        <p className={`font-serif text-xs tracking-[0.3em] transition-colors duration-500 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>沉浸画廊 · 探索之旅</p>
      </div>

      {/* Top Right Control */}
      <div className="absolute top-6 right-6 z-[100]">
        <button 
          onClick={toggleTheme}
          className={`p-3 rounded-full transition-all duration-300 cursor-pointer shadow-xl hover:scale-110 ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white ring-1 ring-white/10' : 'bg-white/50 hover:bg-white/80 text-[#168866] ring-1 ring-[#168866]/20'}`}
        >
          {isDarkMode ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {/* Main Content */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-3xl px-6">
        
        {/* Dynamic Question with Flip Effect */}
        <div className="h-32 flex items-center justify-center mb-10">
           <FlipWords 
             words={QUESTIONS} 
             isDarkMode={isDarkMode}
             duration={3000}
             className="font-display text-2xl md:text-4xl tracking-wide leading-relaxed text-center"
           />
        </div>

        {/* Input Field */}
        <div className="relative w-full max-w-lg group animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
          <input
            type="text"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你的情绪..."
            className={`w-full border rounded-lg px-6 py-4 text-center text-lg md:text-xl focus:outline-none transition-all duration-300 backdrop-blur-sm
              ${isDarkMode 
                ? 'bg-[#1a1a1a]/40 border-white/10 placeholder-gray-600 text-gray-200 focus:border-white/30 focus:bg-[#1a1a1a]/60' 
                : 'bg-white/60 border-black/10 placeholder-neutral-500 text-neutral-800 focus:border-black/20 focus:bg-white/80'}
            `}
          />
          {/* Decorative focus line */}
          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] w-0 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-focus-within:w-2/3 
            ${isDarkMode ? 'bg-white/40' : 'bg-black/40'}`} 
          />
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          className={`mt-12 px-12 py-3 rounded text-sm md:text-base font-medium tracking-widest transition-all duration-500 hover:scale-110 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500
            ${isDarkMode 
              ? 'bg-white text-black hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.4)]' 
              : 'bg-black text-white hover:shadow-[0_0_40px_-10px_rgba(0,0,0,0.2)]'}
          `}
        >
          开始艺术之旅
        </button>
      </div>

      {/* Footer */}
      <div className={`absolute bottom-8 text-[10px] font-mono tracking-widest uppercase z-20 ${isDarkMode ? 'text-gray-700' : 'text-gray-400'}`}>
        LessLand · ArtDuo
      </div>
    </div>
  );
};