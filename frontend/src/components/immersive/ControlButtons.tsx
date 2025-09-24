'use client';

import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';

interface ControlButtonsProps {
  showDetails: boolean;
  isPlayingAudio: boolean;
  onToggleDetails: () => void;
  onToggleAudio: () => void;
}

export default function ControlButtons({
  showDetails,
  isPlayingAudio,
  onToggleDetails,
  onToggleAudio
}: ControlButtonsProps) {
  return (
    <motion.div
      className="flex items-center gap-4 mb-8 h-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      role="group"
      aria-label="作品控制按钮"
    >
      <button
        onClick={onToggleDetails}
        className={`px-6 py-2.5 h-10 rounded-lg border-none cursor-pointer text-sm transition-all duration-300 flex items-center justify-center min-w-[100px] focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-background-primary ${
          showDetails
            ? 'bg-background-secondary text-text-primary hover:bg-background-tertiary'
            : 'bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30'
        }`}
        aria-expanded={showDetails}
        aria-controls="detailed-analysis"
      >
        {showDetails ? '收起详情' : '深入了解'}
      </button>

      <button
        onClick={onToggleAudio}
        className={`px-6 py-2.5 h-10 rounded-lg border-none cursor-pointer text-sm transition-all duration-300 flex items-center gap-2 min-w-[100px] justify-center focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-background-primary ${
          isPlayingAudio
            ? 'bg-accent-primary text-text-primary hover:bg-accent-secondary'
            : 'bg-background-secondary/50 text-text-primary hover:bg-background-secondary/80'
        }`}
        aria-pressed={isPlayingAudio}
        aria-label={isPlayingAudio ? '停止音频讲解' : '播放音频讲解'}
      >
        {isPlayingAudio ? (
          <>
            <span className="w-2 h-2 bg-text-primary rounded-full pulse"></span>
            <span className="sr-only">播放中</span>
            <VolumeX className="w-4 h-4" />
          </>
        ) : (
          <>
            <Volume2 className="w-4 h-4" />
            讲解
          </>
        )}
      </button>
    </motion.div>
  );
}