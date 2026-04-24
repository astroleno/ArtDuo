import React from 'react';

interface SpotlightProps {
  isDarkMode: boolean;
  mousePos: { x: number, y: number };
}

export const LightingOverlay: React.FC<SpotlightProps> = ({ isDarkMode, mousePos }) => {
  // Parallax Logic: Move lights opposite to mouse to create room depth behind the painting
  const moveX = mousePos.x * -40; 
  const moveY = mousePos.y * -20;

  return (
    <>
      {/* 1. Top Source Glow */}
      <div 
        className={`
          absolute top-[-80px] left-[40%] w-[200px] h-[150px] blur-[80px] pointer-events-none z-10 animate-breathe transition-transform duration-100 ease-out
          ${isDarkMode ? 'bg-white opacity-20' : 'bg-white opacity-90'}
        `}
        style={{ transform: `translate(${moveX * 0.5}px, ${moveY * 0.5}px)` }}
      />

      {/* 2. Main Beam Shaft */}
      <div 
        className="absolute top-[-10%] left-[30%] w-[500px] h-[130vh] pointer-events-none z-0 origin-top-left animate-breathe transition-transform duration-300 ease-out"
        style={{ 
          transform: `translate(${moveX}px, ${moveY}px) rotate(${-12 + (mousePos.x * 2)}deg)`,
          animationDelay: '0.5s' 
        }}
      >
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[150px] h-full bg-gradient-to-b blur-2xl
          ${isDarkMode ? 'from-white/10 via-white/5 to-transparent' : 'from-white/40 via-white/10 to-transparent'}`} 
        />
        <div className={`w-full h-full bg-gradient-to-b blur-3xl
          ${isDarkMode ? 'from-white/5 via-white/0 to-transparent' : 'from-white/20 via-white/5 to-transparent'}`} 
        />
      </div>

      {/* 3. Wall Wash (IES Cone Shape) */}
      <div 
        className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[140vh] h-[140vh] pointer-events-none z-0 mix-blend-screen animate-breathe transition-transform duration-700 ease-out"
        style={{
            background: isDarkMode 
              ? 'conic-gradient(from 180deg at 50% 0%, transparent 160deg, rgba(255,255,255,0.15) 180deg, transparent 200deg)'
              : 'conic-gradient(from 180deg at 50% 0%, transparent 160deg, rgba(255,255,255,0.6) 180deg, transparent 200deg)',
            filter: 'blur(90px)',
            animationDelay: '1s',
            transform: `translate(${moveX * 0.2}px, ${moveY * 0.2}px)`
        }}
      />

      {/* 4. Floor Reflection */}
      <div className={`absolute bottom-0 left-0 w-full h-[35vh] bg-gradient-to-t pointer-events-none z-10 transition-opacity duration-700
         ${isDarkMode ? 'from-[#050505] to-transparent opacity-100' : 'from-neutral-200 to-transparent opacity-60'}`} 
      />
    </>
  );
};

export const Vignette: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => (
  <div 
    className="absolute inset-0 pointer-events-none z-40 mix-blend-multiply transition-opacity duration-700"
    style={{
      background: 'radial-gradient(circle at 50% 45%, transparent 25%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.85) 100%)',
      opacity: isDarkMode ? 1 : 0.2
    }}
  />
);

export const NoiseTexture: React.FC = () => (
  <div 
    className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-overlay z-50" 
    style={{ 
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
    }}
  />
);