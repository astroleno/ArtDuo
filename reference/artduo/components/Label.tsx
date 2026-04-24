import React, { useState, useRef, useEffect } from 'react';
import { AIAnalysis, Painting } from '../types';
import { askPaintingQuestion } from '../services/geminiService';

interface LabelProps {
  painting: Painting;
  analysis: AIAnalysis | null;
  streamedContent?: string;
  visible: boolean;
  isDarkMode: boolean;
}

export const Label: React.FC<LabelProps> = ({ painting, analysis, streamedContent, visible, isDarkMode }) => {
  const accentColor = '#d4af37'; // Gold accent
  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when painting changes
  useEffect(() => {
    setChatOpen(false);
    setAnswer('');
    setQuestion('');
    setIsAsking(false);
  }, [painting.id]);

  useEffect(() => {
    if (chatOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [chatOpen]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsAsking(true);
    setAnswer('');
    
    try {
      const stream = askPaintingQuestion(painting, question);
      for await (const chunk of stream) {
        setAnswer(prev => prev + chunk);
      }
    } catch (err) {
      setAnswer("The curator is currently unavailable.");
    } finally {
      setIsAsking(false);
    }
  };

  // Keep expanded if user is interacting with chat
  const isExpanded = chatOpen || isAsking || !!question || !!answer;

  return (
    <div 
      className={`
        relative group/label flex flex-col origin-top-left
        transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]
        shadow-2xl backdrop-blur-md overflow-hidden
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
        ${isDarkMode 
          ? 'bg-[#141415]/90 text-gray-300 shadow-black/50 border-l-2 border-transparent hover:border-[#d4af37]' 
          : 'bg-[#fcfcfb]/95 text-neutral-800 shadow-neutral-400/20 border-l-2 border-transparent hover:border-[#d4af37]'}
        
        /* Width Logic: 
           Start small (220px). 
           On hover/expand, fill the available container width (max-w-md).
           The container in App.tsx has padding-right to ensure this never hits the arrow.
        */
        w-[220px] h-[120px] 
        ${isExpanded 
          ? 'w-full max-w-md h-auto' 
          : 'hover:w-full hover:max-w-md hover:h-auto hover:pb-6'}
      `}
    >
      <div className="p-6 flex flex-col h-full relative z-10">
        
        {/* Header Section (Always Visible) */}
        <div className="flex-shrink-0">
          <div className="flex justify-between items-start">
            <div 
              className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 transition-colors duration-300"
              style={{ color: isDarkMode ? '#888' : '#999' }}
            >
              {painting.artist}
            </div>
            {/* Indicator Dot */}
            <div className={`w-1.5 h-1.5 rounded-full bg-[#d4af37] transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover/label:opacity-100'}`}></div>
          </div>
          
          <h2 className={`font-display text-2xl leading-none italic mb-1 transition-colors duration-300 ${isDarkMode ? 'text-gray-100' : 'text-neutral-900'}`}>
            {painting.title}
          </h2>
          <span className={`text-[10px] font-mono ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>{painting.year}</span>
        </div>

        {/* Content Section (Revealed on Hover/Expand) */}
        <div className={`
            mt-4 space-y-4 transition-all duration-500 delay-75
            ${isExpanded 
               ? 'opacity-100 translate-y-0 block' 
               : 'opacity-0 translate-y-4 hidden group-hover/label:block group-hover/label:opacity-100 group-hover/label:translate-y-0'}
        `}>
          {/* Analysis Text */}
          <div className="min-h-[40px]">
            {analysis ? (
              <>
                <p className={`text-xs lg:text-sm leading-relaxed font-serif text-justify ${isDarkMode ? 'text-gray-400' : 'text-neutral-600'}`}>
                   {streamedContent || "Analyzing composition..."}
                   {!streamedContent && <span className="inline-block w-1.5 h-1.5 ml-1 rounded-full bg-current animate-ping"/>}
                   {streamedContent && streamedContent.length < 20 && <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse align-middle" />}
                </p>
                
                <div className="flex flex-wrap gap-2 pt-3">
                  {[analysis.mood, analysis.technique].map((tag, i) => (
                    tag && <span 
                      key={i}
                      className="text-[9px] uppercase tracking-widest px-2 py-1 border rounded-sm"
                      style={{ 
                        borderColor: isDarkMode ? '#333' : '#e5e5e5',
                        color: accentColor,
                        backgroundColor: `${accentColor}08`
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-2 animate-pulse py-1">
                <div className={`h-2 rounded w-full ${isDarkMode ? 'bg-white/10' : 'bg-neutral-200'}`}></div>
                <div className={`h-2 rounded w-5/6 ${isDarkMode ? 'bg-white/10' : 'bg-neutral-200'}`}></div>
              </div>
            )}
          </div>

          {/* Q&A / Chat Section */}
          <div className={`pt-3 border-t ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
             {!chatOpen ? (
                <button 
                  onClick={() => setChatOpen(true)}
                  className={`text-[10px] uppercase tracking-wider flex items-center gap-2 hover:text-[#d4af37] transition-colors ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}
                >
                  <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[8px]">?</span>
                  Ask the Curator
                </button>
             ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {answer && (
                    <div className={`p-3 rounded-sm text-[11px] leading-relaxed italic border-l-2 ${isDarkMode ? 'bg-white/5 border-[#d4af37]/50 text-gray-300' : 'bg-black/5 border-[#d4af37]/50 text-gray-700'}`}>
                       "{answer}"
                    </div>
                  )}
                  
                  <form onSubmit={handleAsk} className="relative mt-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g. What does the light symbolize?"
                      disabled={isAsking}
                      className={`w-full bg-transparent border-b text-xs py-2 pr-6 focus:outline-none focus:border-[#d4af37] transition-colors
                        ${isDarkMode 
                          ? 'border-white/20 text-white placeholder-white/20' 
                          : 'border-black/20 text-black placeholder-black/30'
                        }`}
                    />
                    <button 
                      type="submit" 
                      disabled={!question || isAsking}
                      className="absolute right-0 bottom-2 text-[#d4af37] disabled:opacity-30 hover:scale-110 transition-transform"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
                    </button>
                  </form>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}